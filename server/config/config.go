package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Config holds all application configuration loaded from environment variables.
type Config struct {
	Port           string
	JWTSecret      string
	AuthPepper     string
	GeminiAPIKey   string
	GeminiModel    string
	UploadDir      string
	MaxUploadSize  int64
	WebRTCEnabled  bool
	TursoURL       string
	TursoToken     string
}

// Global application config (initialized once at startup).
var AppConfig *Config

// Load reads the .env file and populates AppConfig.
func Load() {
	// Load .env file (ignore error if not found — use system env vars)
	_ = godotenv.Load()

	port := getEnv("PORT", "3001")
	jwtSecret := getEnv("JWT_SECRET", "")
	authPepper := getEnv("AUTH_PEPPER", "")
	geminiKey := getEnv("GEMINI_API_KEY", "")
	geminiModel := getEnv("GEMINI_MODEL", "gemini-2.0-flash")
	uploadDir := getEnv("UPLOAD_DIR", "./uploads")
	maxUploadStr := getEnv("MAX_UPLOAD_SIZE", "10485760")
	webrtcStr := getEnv("WEBRTC_ENABLED", "true")

	maxUpload, err := strconv.ParseInt(maxUploadStr, 10, 64)
	if err != nil {
		maxUpload = 10485760 // 10MB default
	}

	webrtcEnabled, _ := strconv.ParseBool(webrtcStr)

	// Generate a default JWT secret for development if not set
	if jwtSecret == "" {
		jwtSecret = "dev-jwt-secret-do-not-use-in-production-change-me"
		log.Println("⚠️  WARNING: Using default JWT_SECRET. Set JWT_SECRET env var for production!")
	}

	if authPepper == "" {
		authPepper = "dev-pepper-do-not-use-in-production"
		log.Println("⚠️  WARNING: Using default AUTH_PEPPER. Set AUTH_PEPPER env var for production!")
	}

	AppConfig = &Config{
		Port:          port,
		JWTSecret:     jwtSecret,
		AuthPepper:    authPepper,
		GeminiAPIKey:  geminiKey,
		GeminiModel:   geminiModel,
		UploadDir:     uploadDir,
		MaxUploadSize: maxUpload,
		WebRTCEnabled: webrtcEnabled,
		TursoURL:      getEnv("TURSO_DATABASE_URL", ""),
		TursoToken:    getEnv("TURSO_AUTH_TOKEN", ""),
	}

	log.Printf("✅ Config loaded: port=%s, turso=%v, gemini=%s, webrtc=%v",
		AppConfig.Port,
		AppConfig.TursoURL != "",
		boolStr(AppConfig.GeminiAPIKey != "", "configured", "not set"),
		AppConfig.WebRTCEnabled,
	)
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

func boolStr(cond bool, t, f string) string {
	if cond {
		return t
	}
	return f
}
