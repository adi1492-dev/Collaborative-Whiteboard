package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"

	"golang.org/x/crypto/argon2"
)

// Argon2id parameters — tuned for security per OWASP recommendations.
const (
	argonMemory     = 64 * 1024 // 64 MB
	argonIterations = 3
	argonParallelism = 4
	argonSaltLength = 16
	argonKeyLength  = 32
)

// HashPassword creates an Argon2id hash of the password with a random salt.
// The pepper is prepended to the password before hashing.
// Returns base64-encoded hash and salt.
func HashPassword(password, pepper string) (hash, salt string, err error) {
	// Generate cryptographically random salt
	saltBytes := make([]byte, argonSaltLength)
	if _, err := rand.Read(saltBytes); err != nil {
		return "", "", err
	}

	// Prepend pepper to password
	pepperedPassword := []byte(pepper + password)

	// Compute Argon2id hash
	hashBytes := argon2.IDKey(
		pepperedPassword,
		saltBytes,
		argonIterations,
		argonMemory,
		argonParallelism,
		argonKeyLength,
	)

	// Encode to base64 for storage
	hash = base64.StdEncoding.EncodeToString(hashBytes)
	salt = base64.StdEncoding.EncodeToString(saltBytes)

	return hash, salt, nil
}

// VerifyPassword checks if a password matches the stored hash.
// Uses constant-time comparison to prevent timing attacks.
func VerifyPassword(password, pepper, storedHash, storedSalt string) bool {
	// Decode the stored salt
	saltBytes, err := base64.StdEncoding.DecodeString(storedSalt)
	if err != nil {
		return false
	}

	// Decode the stored hash
	expectedHash, err := base64.StdEncoding.DecodeString(storedHash)
	if err != nil {
		return false
	}

	// Compute hash with same parameters
	pepperedPassword := []byte(pepper + password)
	computedHash := argon2.IDKey(
		pepperedPassword,
		saltBytes,
		argonIterations,
		argonMemory,
		argonParallelism,
		argonKeyLength,
	)

	// Constant-time comparison
	return subtle.ConstantTimeCompare(computedHash, expectedHash) == 1
}
