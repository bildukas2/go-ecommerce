package adminauth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	defaultTurnstileVerifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

	defaultLoginIPLimit       int64 = 5
	defaultLoginEmailLimit    int64 = 5
	defaultLoginIPWindow            = time.Minute
	defaultLoginLockWindow          = 15 * time.Minute
	defaultFailureDelayMin          = 200 * time.Millisecond
	defaultFailureDelayJitter       = 201 * time.Millisecond
)

var errCaptchaSecretMissing = errors.New("captcha secret is not configured")

type CaptchaVerifier interface {
	Verify(ctx context.Context, token string, remoteIP string) (bool, error)
}

type turnstileVerifier struct {
	client   *http.Client
	secret   string
	endpoint string
}

type turnstileVerifyResponse struct {
	Success bool `json:"success"`
}

func newTurnstileVerifierFromEnv() CaptchaVerifier {
	secret := strings.TrimSpace(os.Getenv("TURNSTILE_SECRET_KEY"))
	endpoint := strings.TrimSpace(os.Getenv("TURNSTILE_VERIFY_URL"))
	if endpoint == "" {
		endpoint = defaultTurnstileVerifyURL
	}
	return &turnstileVerifier{
		client:   &http.Client{Timeout: 5 * time.Second},
		secret:   secret,
		endpoint: endpoint,
	}
}

func (v *turnstileVerifier) Verify(ctx context.Context, token string, remoteIP string) (bool, error) {
	if v == nil || strings.TrimSpace(v.secret) == "" {
		return false, errCaptchaSecretMissing
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return false, nil
	}
	form := url.Values{}
	form.Set("secret", v.secret)
	form.Set("response", token)
	if ip := strings.TrimSpace(remoteIP); ip != "" {
		form.Set("remoteip", ip)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, v.endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return false, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := v.client.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return false, errors.New("captcha verification failed")
	}
	var payload turnstileVerifyResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return false, err
	}
	return payload.Success, nil
}

type loginProtectionStore interface {
	Incr(ctx context.Context, key string, ttl time.Duration) (int64, error)
	Set(ctx context.Context, key string, value string, ttl time.Duration) error
	Exists(ctx context.Context, key string) (bool, error)
	Del(ctx context.Context, keys ...string) error
}

type redisLoginProtectionStore struct {
	client *redis.Client
}

func (s *redisLoginProtectionStore) Incr(ctx context.Context, key string, ttl time.Duration) (int64, error) {
	pipe := s.client.Pipeline()
	incrCmd := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, ttl)
	if _, err := pipe.Exec(ctx); err != nil {
		return 0, err
	}
	return incrCmd.Val(), nil
}

func (s *redisLoginProtectionStore) Set(ctx context.Context, key string, value string, ttl time.Duration) error {
	return s.client.Set(ctx, key, value, ttl).Err()
}

func (s *redisLoginProtectionStore) Exists(ctx context.Context, key string) (bool, error) {
	n, err := s.client.Exists(ctx, key).Result()
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

func (s *redisLoginProtectionStore) Del(ctx context.Context, keys ...string) error {
	if len(keys) == 0 {
		return nil
	}
	return s.client.Del(ctx, keys...).Err()
}

type memoryLoginProtectionStore struct {
	mu    sync.Mutex
	items map[string]memoryLoginProtectionEntry
}

type memoryLoginProtectionEntry struct {
	value  string
	count  int64
	expiry time.Time
}

func newMemoryLoginProtectionStore() *memoryLoginProtectionStore {
	return &memoryLoginProtectionStore{items: map[string]memoryLoginProtectionEntry{}}
}

func (s *memoryLoginProtectionStore) Incr(_ context.Context, key string, ttl time.Duration) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	entry, ok := s.items[key]
	if !ok || now.After(entry.expiry) {
		entry = memoryLoginProtectionEntry{
			count:  0,
			expiry: now.Add(ttl),
		}
	}
	entry.count++
	entry.expiry = now.Add(ttl)
	s.items[key] = entry
	return entry.count, nil
}

func (s *memoryLoginProtectionStore) Set(_ context.Context, key string, value string, ttl time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.items[key] = memoryLoginProtectionEntry{
		value:  value,
		count:  1,
		expiry: time.Now().Add(ttl),
	}
	return nil
}

func (s *memoryLoginProtectionStore) Exists(_ context.Context, key string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	entry, ok := s.items[key]
	if !ok {
		return false, nil
	}
	if time.Now().After(entry.expiry) {
		delete(s.items, key)
		return false, nil
	}
	_ = entry.value
	return true, nil
}

func (s *memoryLoginProtectionStore) Del(_ context.Context, keys ...string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, key := range keys {
		delete(s.items, key)
	}
	return nil
}

type loginProtection struct {
	store           loginProtectionStore
	captchaVerifier CaptchaVerifier
	captchaRequired bool
	ipLimit         int64
	ipWindow        time.Duration
	emailFailureMax int64
	emailLockTTL    time.Duration
	emailFailureTTL time.Duration
	sleep           func(time.Duration)
	randomIntn      func(n int) int
}

func newLoginProtection(redisClient *redis.Client, verifier CaptchaVerifier) *loginProtection {
	var store loginProtectionStore
	if redisClient != nil {
		store = &redisLoginProtectionStore{client: redisClient}
	} else {
		store = newMemoryLoginProtectionStore()
	}
	captchaRequired := true
	if verifier == nil {
		captchaRequired = false
	}
	if v, ok := verifier.(*turnstileVerifier); ok && strings.TrimSpace(v.secret) == "" {
		captchaRequired = false
	}
	return &loginProtection{
		store:           store,
		captchaVerifier: verifier,
		captchaRequired: captchaRequired,
		ipLimit:         defaultLoginIPLimit,
		ipWindow:        defaultLoginIPWindow,
		emailFailureMax: defaultLoginEmailLimit,
		emailLockTTL:    defaultLoginLockWindow,
		emailFailureTTL: defaultLoginLockWindow,
		sleep:           time.Sleep,
		randomIntn:      cryptoRandIntn,
	}
}

func (p *loginProtection) IsCaptchaRequired() bool {
	if p == nil {
		return false
	}
	return p.captchaRequired
}

func (p *loginProtection) VerifyCaptcha(ctx context.Context, token string, remoteIP string) (bool, error) {
	if p != nil && !p.captchaRequired {
		return true, nil
	}
	if p == nil || p.captchaVerifier == nil {
		return false, errCaptchaSecretMissing
	}
	return p.captchaVerifier.Verify(ctx, token, remoteIP)
}

func (p *loginProtection) IsIPAllowed(ctx context.Context, ip string) (bool, error) {
	if p == nil || p.store == nil {
		return false, errors.New("protection store unavailable")
	}
	ip = strings.TrimSpace(ip)
	if ip == "" {
		ip = "unknown"
	}
	count, err := p.store.Incr(ctx, p.keyIP(ip), p.ipWindow)
	if err != nil {
		return false, err
	}
	return count <= p.ipLimit, nil
}

func (p *loginProtection) IsEmailLocked(ctx context.Context, email string) (bool, error) {
	if p == nil || p.store == nil {
		return false, errors.New("protection store unavailable")
	}
	return p.store.Exists(ctx, p.keyEmailLock(email))
}

func (p *loginProtection) RegisterEmailFailure(ctx context.Context, email string) (bool, error) {
	if p == nil || p.store == nil {
		return false, errors.New("protection store unavailable")
	}
	count, err := p.store.Incr(ctx, p.keyEmailFailure(email), p.emailFailureTTL)
	if err != nil {
		return false, err
	}
	if count < p.emailFailureMax {
		return false, nil
	}
	if err := p.store.Set(ctx, p.keyEmailLock(email), "1", p.emailLockTTL); err != nil {
		return false, err
	}
	return true, nil
}

func (p *loginProtection) ResetEmailFailures(ctx context.Context, email string) error {
	if p == nil || p.store == nil {
		return errors.New("protection store unavailable")
	}
	return p.store.Del(ctx, p.keyEmailFailure(email), p.keyEmailLock(email))
}

func (p *loginProtection) SleepFailureDelay() {
	if p == nil || p.sleep == nil {
		return
	}
	jitter := 0
	if p.randomIntn != nil {
		jitter = p.randomIntn(int(defaultFailureDelayJitter / time.Millisecond))
		if jitter < 0 {
			jitter = 0
		}
	}
	delay := defaultFailureDelayMin + time.Duration(jitter)*time.Millisecond
	p.sleep(delay)
}

func (p *loginProtection) keyIP(ip string) string {
	return "admin:login:ip:" + hashIdentifier(ip)
}

func (p *loginProtection) keyEmailFailure(email string) string {
	return "admin:login:fail:email:" + hashIdentifier(email)
}

func (p *loginProtection) keyEmailLock(email string) string {
	return "admin:login:lock:email:" + hashIdentifier(email)
}

func hashIdentifier(raw string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(strings.ToLower(raw))))
	return hex.EncodeToString(sum[:])
}

func cryptoRandIntn(n int) int {
	if n <= 1 {
		return 0
	}
	max := big.NewInt(int64(n))
	v, err := rand.Int(rand.Reader, max)
	if err != nil {
		return 0
	}
	return int(v.Int64())
}
