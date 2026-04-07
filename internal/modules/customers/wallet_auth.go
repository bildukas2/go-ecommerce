package customers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/btcsuite/btcd/btcec/v2/ecdsa"
	platformhttp "goecommerce/internal/platform/http"
	storcustomers "goecommerce/internal/storage/customers"
	"golang.org/x/crypto/sha3"
)

const walletNonceTTL = 5 * time.Minute

// walletStore is the subset of customerStore used by wallet auth handlers.
type walletStore interface {
	SaveWalletNonce(ctx context.Context, nonce string, expiresAt time.Time) error
	ConsumeWalletNonce(ctx context.Context, nonce string) error
	GetCustomerByWalletAddress(ctx context.Context, address string) (storcustomers.Customer, error)
	CreateCustomerWithWallet(ctx context.Context, walletAddress string) (storcustomers.Customer, error)
	CreateSession(ctx context.Context, customerID, tokenHash string, expiresAt time.Time) (storcustomers.Session, error)
}

// handleWalletNonce generates a one-time challenge nonce for SIWE login.
//
// POST /auth/wallet/nonce → { "nonce": "hex string" }
func (m *module) handleWalletNonce(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.URL.Path != "/auth/wallet/nonce" {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "nonce error")
		return
	}
	nonce := hex.EncodeToString(b)
	expiresAt := m.now().Add(walletNonceTTL)

	ws, ok := m.store.(walletStore)
	if !ok {
		platformhttp.Error(w, http.StatusInternalServerError, "wallet auth unavailable")
		return
	}
	if err := ws.SaveWalletNonce(r.Context(), nonce, expiresAt); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "nonce error")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"nonce": nonce})
}

type walletVerifyRequest struct {
	Address   string `json:"address"`
	Message   string `json:"message"`
	Signature string `json:"signature"`
}

// handleWalletVerify verifies a SIWE signature, then finds or creates the customer
// and starts a session — exactly like email login but keyed by wallet address.
//
// POST /auth/wallet/verify  body: { address, message, signature }
func (m *module) handleWalletVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.URL.Path != "/auth/wallet/verify" {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	var body walletVerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	body.Address = strings.ToLower(strings.TrimSpace(body.Address))
	body.Signature = strings.TrimSpace(body.Signature)
	body.Message = strings.TrimSpace(body.Message)

	if body.Address == "" || body.Message == "" || body.Signature == "" {
		platformhttp.Error(w, http.StatusBadRequest, "address, message, and signature are required")
		return
	}
	if !strings.HasPrefix(body.Address, "0x") || len(body.Address) != 42 {
		platformhttp.Error(w, http.StatusBadRequest, "invalid wallet address")
		return
	}

	// 1. Verify the signature recovers to the claimed address.
	recovered, err := recoverEIP191Address(body.Message, body.Signature)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid signature")
		return
	}
	if recovered != body.Address {
		platformhttp.Error(w, http.StatusUnauthorized, "signature does not match address")
		return
	}

	// 2. Extract and consume the nonce from the message.
	nonce, err := extractSiweNonce(body.Message)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "missing nonce in message")
		return
	}

	ws, ok := m.store.(walletStore)
	if !ok {
		platformhttp.Error(w, http.StatusInternalServerError, "wallet auth unavailable")
		return
	}

	if err := ws.ConsumeWalletNonce(r.Context(), nonce); err != nil {
		if errors.Is(err, storcustomers.ErrNotFound) {
			platformhttp.Error(w, http.StatusUnauthorized, "nonce expired or invalid")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "nonce error")
		return
	}

	// 3. Find or create the customer for this wallet address.
	customer, err := ws.GetCustomerByWalletAddress(r.Context(), body.Address)
	if errors.Is(err, storcustomers.ErrNotFound) {
		customer, err = ws.CreateCustomerWithWallet(r.Context(), body.Address)
	}
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "auth error")
		return
	}
	if strings.EqualFold(customer.Status, "disabled") {
		platformhttp.Error(w, http.StatusForbidden, "account disabled")
		return
	}

	// 4. Create session (same flow as email login).
	token, err := generateSessionToken()
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "session error")
		return
	}
	tokenHash := hashSessionToken(token)
	expiresAt := m.now().Add(m.sessionTTL)
	if _, err := ws.CreateSession(r.Context(), customer.ID, tokenHash, expiresAt); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "session error")
		return
	}
	setSessionCookie(w, r, token, int(m.sessionTTL.Seconds()))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(authCustomerResponse{
		ID:        customer.ID,
		Email:     customer.Email,
		CreatedAt: customer.CreatedAt,
	})
}

// recoverEIP191Address recovers the Ethereum address that produced sig over msg
// using the EIP-191 personal_sign prefix.
func recoverEIP191Address(msg, sigHex string) (string, error) {
	sigHex = strings.TrimPrefix(sigHex, "0x")
	sig, err := hex.DecodeString(sigHex)
	if err != nil || len(sig) != 65 {
		return "", errors.New("invalid signature")
	}

	// EIP-191 prefix
	prefixed := fmt.Sprintf("\x19Ethereum Signed Message:\n%d%s", len(msg), msg)
	hash := ethKeccak256([]byte(prefixed))

	// Normalize v: MetaMask uses 27/28, some wallets use 0/1
	v := sig[64]
	if v >= 27 {
		v -= 27
	}
	if v > 1 {
		return "", errors.New("invalid recovery id")
	}

	// BTC compact format: [27 + recovery_id, r(32), s(32)]
	btcSig := make([]byte, 65)
	btcSig[0] = 27 + v
	copy(btcSig[1:33], sig[0:32])
	copy(btcSig[33:65], sig[32:64])

	pubKey, _, err := ecdsa.RecoverCompact(btcSig, hash)
	if err != nil {
		return "", fmt.Errorf("recovery failed: %w", err)
	}

	// Ethereum address = last 20 bytes of keccak256(uncompressed pubkey without 04 prefix)
	uncompressed := pubKey.SerializeUncompressed() // [04, x(32), y(32)]
	addrHash := ethKeccak256(uncompressed[1:])
	return "0x" + hex.EncodeToString(addrHash[12:]), nil
}

// ethKeccak256 returns the Ethereum-compatible keccak256 hash (pre-NIST SHA3).
func ethKeccak256(data []byte) []byte {
	h := sha3.NewLegacyKeccak256()
	h.Write(data)
	return h.Sum(nil)
}

// extractSiweNonce pulls the value from the "Nonce: <value>" line of a SIWE message.
func extractSiweNonce(message string) (string, error) {
	for _, line := range strings.Split(message, "\n") {
		if strings.HasPrefix(line, "Nonce: ") {
			nonce := strings.TrimPrefix(line, "Nonce: ")
			nonce = strings.TrimSpace(nonce)
			if nonce != "" {
				return nonce, nil
			}
		}
	}
	return "", errors.New("nonce not found")
}
