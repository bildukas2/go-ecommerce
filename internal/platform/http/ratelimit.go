package httpx

import (
	"context"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

type rateLimitEntry struct {
	count  int
	expiry time.Time
}

type RateLimiter struct {
	redis         *redis.Client
	fallbackStore sync.Map
	limit         int
	window        time.Duration
}

func NewRateLimiter(redis *redis.Client, limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		redis:  redis,
		limit:  limit,
		window: window,
	}
}

func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := extractIP(r)
		if ip == "" {
			Error(w, http.StatusBadRequest, "cannot determine client IP")
			return
		}

		allowed, err := rl.checkLimit(r.Context(), ip)
		if err != nil {
			Error(w, http.StatusInternalServerError, "rate limit check failed")
			return
		}

		if !allowed {
			Error(w, http.StatusTooManyRequests, "rate limit exceeded")
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (rl *RateLimiter) checkLimit(ctx context.Context, ip string) (bool, error) {
	if rl.redis != nil {
		return rl.checkRedis(ctx, ip)
	}
	return rl.checkFallback(ip), nil
}

func (rl *RateLimiter) checkRedis(ctx context.Context, ip string) (bool, error) {
	key := "ratelimit:" + ip
	pipe := rl.redis.Pipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, rl.window)
	_, err := pipe.Exec(ctx)
	if err != nil {
		return rl.checkFallback(ip), nil
	}
	count := incr.Val()
	return count <= int64(rl.limit), nil
}

func (rl *RateLimiter) checkFallback(ip string) bool {
	now := time.Now()
	key := "fallback:" + ip

	val, loaded := rl.fallbackStore.LoadOrStore(key, &rateLimitEntry{count: 1, expiry: now.Add(rl.window)})
	entry := val.(*rateLimitEntry)

	if !loaded {
		return true
	}

	if now.After(entry.expiry) {
		rl.fallbackStore.Store(key, &rateLimitEntry{count: 1, expiry: now.Add(rl.window)})
		return true
	}

	entry.count++
	return entry.count <= rl.limit
}

func extractIP(r *http.Request) string {
	// TODO: For production, only trust X-Forwarded-For if behind a known/trusted proxy.
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			ip := strings.TrimSpace(parts[0])
			if ip != "" {
				return stripPort(ip)
			}
		}
	}

	return stripPort(r.RemoteAddr)
}

func stripPort(addr string) string {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return addr
	}
	return host
}
