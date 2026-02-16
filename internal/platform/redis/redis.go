package redisx

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

// NewFromURL initializes a go-redis client from a redis URL (e.g., redis://localhost:6379/0)
// and performs a quick ping to validate connectivity.
func NewFromURL(ctx context.Context, url string) (*redis.Client, error) {
	opt, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	client := redis.NewClient(opt)
	c, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	if err := client.Ping(c).Err(); err != nil {
		_ = client.Close()
		return nil, err
	}
	return client, nil
}
