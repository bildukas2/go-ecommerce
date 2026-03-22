package main

import (
	"context"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"goecommerce/internal/app"
	"goecommerce/internal/modules/admin"
	"goecommerce/internal/modules/adminauth"
	"goecommerce/internal/modules/cart"
	"goecommerce/internal/modules/catalog"
	"goecommerce/internal/modules/checkout"
	"goecommerce/internal/modules/cms"
	"goecommerce/internal/modules/customers"
	moduleemail "goecommerce/internal/modules/email"
	"goecommerce/internal/modules/orders"
	"goecommerce/internal/modules/payments"
	"goecommerce/internal/modules/settings"
	"goecommerce/internal/modules/shipping"
	platformdb "goecommerce/internal/platform/db"
	platformredis "goecommerce/internal/platform/redis"
	storemail "goecommerce/internal/storage/email"

	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Printf("No .env file found: %v", err)
	}

	socketPath := os.Getenv("UNIX_SOCKET")
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	var (
		ln  net.Listener
		err error
	)

	if socketPath != "" {
		_ = os.Remove(socketPath)
		ln, err = net.Listen("unix", socketPath)
		if err != nil {
			log.Fatalf("unix listen error: %v", err)
		}
		if err := os.Chmod(socketPath, 0660); err != nil {
			log.Printf("chmod socket failed: %v", err)
		}
		log.Printf("http server listening on unix:%s", socketPath)
	} else {
		addr := ":" + port
		ln, err = net.Listen("tcp", addr)
		if err != nil {
			log.Fatalf("tcp listen error: %v", err)
		}
		log.Printf("http server listening on %s", addr)
	}

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

	var emailService *moduleemail.Service
	if deps.DB != nil {
		emailStore, err := storemail.NewStore(ctx, deps.DB)
		if err != nil {
			log.Printf("email store init error: %v", err)
		} else {
			emailService = moduleemail.NewService(emailStore)
			defer emailStore.Close()
		}
	}

	app.RegisterModule(catalog.NewModule(deps))
	app.RegisterModule(cart.NewModule(deps))
	if emailService != nil {
		app.RegisterModule(customers.NewModule(deps, customers.WithEmailService(emailService)))
	} else {
		app.RegisterModule(customers.NewModule(deps))
	}
	app.RegisterModule(orders.NewModule(deps))
	app.RegisterModule(shipping.NewModule(deps))
	app.RegisterModule(payments.NewModule(deps))
	app.RegisterModule(settings.NewModule(deps))
	app.RegisterModule(moduleemail.NewModule(deps))
	if emailService != nil {
		app.RegisterModule(checkout.NewModule(deps, checkout.WithEmailService(emailService)))
	} else {
		app.RegisterModule(checkout.NewModule(deps))
	}
	app.RegisterModule(cms.NewModule(deps))
	app.RegisterModule(adminauth.NewModule(deps))
	app.RegisterModule(admin.NewModule(deps))
	router := app.NewRouter(deps)

	srv := &http.Server{
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
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
	_ = app.CloseModules()

	// Cleanup socket on exit (optional but nice)
	if socketPath != "" {
		_ = os.Remove(socketPath)
	}

	log.Printf("server stopped")
}
