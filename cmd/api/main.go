package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"goecommerce/internal/app"
	platformdb "goecommerce/internal/platform/db"
	platformredis "goecommerce/internal/platform/redis"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Printf("No .env file found: %v", err)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	addr := ":" + port

	var deps app.Deps
	ctx := context.Background()

	if dsn := os.Getenv("DATABASE_URL"); dsn != "" {
		db, err := platformdb.Open(ctx, dsn)
		if err != nil {
			log.Printf("db connect error: %v", err)
		} else {
			deps.DB = db
			defer db.Close()
		}
	}
	if rurl := os.Getenv("REDIS_URL"); rurl != "" {
		rc, err := platformredis.NewFromURL(ctx, rurl)
		if err != nil {
			log.Printf("redis connect error: %v", err)
		} else {
			deps.Redis = rc
			defer rc.Close()
		}
	}

	router := app.NewRouter(deps)

	srv := &http.Server{
		Addr:         addr,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("http server listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}
	log.Printf("server stopped")
}
