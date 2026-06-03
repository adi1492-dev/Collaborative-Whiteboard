package auth

import (
	"fmt"
	"math/rand"
	"net/http"
	"regexp"
	"time"

	"github.com/canvasflow/server/config"
	"github.com/canvasflow/server/database"
	"github.com/canvasflow/server/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Pre-defined avatar colors for new users.
var avatarColors = []string{
	"#c0c1ff", "#4cd7f6", "#ffb2b7", "#8083ff", "#03b5d3",
	"#ff516a", "#e1e0ff", "#acedff", "#ffdadb", "#6366F1",
}

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

// RegisterRequest is the expected JSON body for user registration.
type RegisterRequest struct {
	Email       string `json:"email" binding:"required"`
	Password    string `json:"password" binding:"required,min=8"`
	DisplayName string `json:"displayName" binding:"required,min=2"`
}

// LoginRequest is the expected JSON body for user login.
type LoginRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// AuthResponse is the JSON response after successful auth.
type AuthResponse struct {
	User         models.UserResponse `json:"user"`
	AccessToken  string              `json:"accessToken"`
	RefreshToken string              `json:"refreshToken"`
}

// Register handles POST /api/auth/register
func Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	// Validate email format
	if !emailRegex.MatchString(req.Email) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid email format"})
		return
	}

	avatarColor := avatarColors[rand.Intn(len(avatarColors))]

	// Hash password with Argon2id
	hash, salt, err := HashPassword(req.Password, config.AppConfig.AuthPepper)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	userID := uuid.New().String()

	if database.SQLiteUserExists(req.Email) {
		c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
		return
	}

	if err := database.SQLiteCreateUser(userID, req.Email, req.DisplayName, avatarColor, hash, salt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	accessToken, err := GenerateAccessToken(userID, req.Email, req.DisplayName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}
	rawRefresh, refreshHash, err := GenerateRefreshToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate refresh token"})
		return
	}

	tokenID := uuid.New().String()
	_ = database.SQLiteStoreRefreshToken(tokenID, userID, refreshHash, time.Now().Add(7*24*time.Hour))

	c.JSON(http.StatusCreated, AuthResponse{
		User: models.UserResponse{
			ID:          userID,
			Email:       req.Email,
			DisplayName: req.DisplayName,
			AvatarColor: avatarColor,
		},
		AccessToken:  accessToken,
		RefreshToken: rawRefresh,
	})
}

// Login handles POST /api/auth/login
func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	user, err := database.SQLiteFindUserByEmail(req.Email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	if !VerifyPassword(req.Password, config.AppConfig.AuthPepper, user.PasswordHash, user.PasswordSalt) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	accessToken, err := GenerateAccessToken(user.ID, user.Email, user.DisplayName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}
	rawRefresh, refreshHash, err := GenerateRefreshToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate refresh token"})
		return
	}

	tokenID := uuid.New().String()
	_ = database.SQLiteStoreRefreshToken(tokenID, user.ID, refreshHash, time.Now().Add(7*24*time.Hour))

	c.JSON(http.StatusOK, AuthResponse{
		User: models.UserResponse{
			ID:          user.ID,
			Email:       user.Email,
			DisplayName: user.DisplayName,
			AvatarColor: user.AvatarColor,
		},
		AccessToken:  accessToken,
		RefreshToken: rawRefresh,
	})
}

// RefreshTokenHandler handles POST /api/auth/refresh
func RefreshTokenHandler(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refreshToken" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Refresh token required"})
		return
	}

	tokenHash := HashRefreshToken(req.RefreshToken)

	storedToken, err := database.SQLiteFindRefreshToken(tokenHash)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid refresh token"})
		return
	}
	if time.Now().After(storedToken.ExpiresAt) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Refresh token expired"})
		return
	}
	_ = database.SQLiteDeleteRefreshToken(tokenHash)

	user, err := database.SQLiteFindUserByID(storedToken.UserID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	accessToken, _ := GenerateAccessToken(user.ID, user.Email, user.DisplayName)
	rawRefresh, refreshHash, _ := GenerateRefreshToken()
	tokenID := uuid.New().String()
	_ = database.SQLiteStoreRefreshToken(tokenID, user.ID, refreshHash, time.Now().Add(7*24*time.Hour))

	c.JSON(http.StatusOK, AuthResponse{
		User: models.UserResponse{
			ID:          user.ID,
			Email:       user.Email,
			DisplayName: user.DisplayName,
			AvatarColor: user.AvatarColor,
		},
		AccessToken:  accessToken,
		RefreshToken: rawRefresh,
	})
}

// Logout handles POST /api/auth/logout
func Logout(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refreshToken"`
	}
	if err := c.ShouldBindJSON(&req); err == nil && req.RefreshToken != "" {
		tokenHash := HashRefreshToken(req.RefreshToken)
		_ = database.SQLiteDeleteRefreshToken(tokenHash)
	}
	c.JSON(http.StatusOK, gin.H{"message": "Logged out"})
}

// Me handles GET /api/auth/me — returns current user profile.
func Me(c *gin.Context) {
	userID := GetUserID(c)

	user, err := database.SQLiteFindUserByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": models.UserResponse{
		ID:          user.ID,
		Email:       user.Email,
		DisplayName: user.DisplayName,
		AvatarColor: user.AvatarColor,
	}})
}

func init() {
	// Seed random for avatar color selection
	rand.New(rand.NewSource(time.Now().UnixNano()))
	fmt.Println() // avoid unused import
}
