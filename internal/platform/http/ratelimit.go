package httpx

import (
	"context"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/redis/go-redis/v9"
)

type rateLimitEntry struct {
	count  atomic.Int64
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
		ip := ClientIP(r)
		if ip == "" {
			Error(w, http.StatusBadRequest, "cannot determine client IP")
			return
		}
		if isLoopback(ip) {
			next.ServeHTTP(w, r)
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

	newEntry := &rateLimitEntry{expiry: now.Add(rl.window)}
	newEntry.count.Store(1)

	val, loaded := rl.fallbackStore.LoadOrStore(key, newEntry)
	entry := val.(*rateLimitEntry)

	if !loaded {
		return true
	}

	if now.After(entry.expiry) {
		fresh := &rateLimitEntry{expiry: now.Add(rl.window)}
		fresh.count.Store(1)
		rl.fallbackStore.Store(key, fresh)
		return true
	}

	current := entry.count.Add(1)
	return current <= int64(rl.limit)
}
