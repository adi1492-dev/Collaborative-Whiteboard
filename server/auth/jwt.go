package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/canvasflow/server/config"
	"github.com/golang-jwt/jwt/v5"
)

// Claims represents the JWT access token claims.
type Claims struct {
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role,omitempty"` // "editor" | "viewer" | "" (default = editor)
	jwt.RegisteredClaims
}

// GenerateAccessToken creates a signed JWT access token (15 min expiry).
func GenerateAccessToken(userID, email, displayName string) (string, error) {
	claims := Claims{
		Email: email,
		Name:  displayName,
		Role:  "editor",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.AppConfig.JWTSecret))
}

// GenerateViewOnlyToken creates a long-lived JWT for public view-only access.
// The token encodes role='viewer' so the server can enforce read-only rules.
func GenerateViewOnlyToken(boardID, boardTitle string) (string, error) {
	claims := Claims{
		Email: "",
		Name:  "Guest Viewer",
		Role:  "viewer",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "view:" + boardID,
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)), // 30 days
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.AppConfig.JWTSecret))
}

// GenerateRefreshToken creates a random opaque refresh token and its SHA-256 hash.
// The raw token is sent to the client; the hash is stored in the database.
func GenerateRefreshToken() (rawToken, tokenHash string, err error) {
	// Generate 32 random bytes
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", "", err
	}

	rawToken = hex.EncodeToString(tokenBytes)
	hash := sha256.Sum256([]byte(rawToken))
	tokenHash = hex.EncodeToString(hash[:])

	return rawToken, tokenHash, nil
}

// HashRefreshToken computes the SHA-256 hash of a raw refresh token.
func HashRefreshToken(rawToken string) string {
	hash := sha256.Sum256([]byte(rawToken))
	return hex.EncodeToString(hash[:])
}

// ValidateAccessToken parses and validates a JWT access token.
func ValidateAccessToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(config.AppConfig.JWTSecret), nil
	})

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}
