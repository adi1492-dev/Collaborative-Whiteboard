package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/canvasflow/server/auth"
	"github.com/canvasflow/server/config"
	"github.com/canvasflow/server/database"
	"github.com/canvasflow/server/handlers"
	ws "github.com/canvasflow/server/websocket"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// Load configuration
	config.Load()

	// Connect to MongoDB
	if err := database.Connect(config.AppConfig.MongoURI); err != nil {
		log.Printf("⚠️  MongoDB connection failed: %v", err)
		log.Println("🔄 Running without database (in-memory mode)")
	}
	defer database.Disconnect()

	// Initialize SQLite Fallback DB
	if err := database.InitSQLite("./offline_queue.db"); err != nil {
		log.Printf("⚠️  SQLite fallback DB failed to initialize: %v", err)
	} else {
		defer database.CloseSQLite()
	}

	// Start Background Sync Worker for HA
	database.StartBackgroundSyncWorker()

	// Create WebSocket Hub
	hub := ws.NewHub()
	go hub.Run()

	// Setup Gin router
	router := gin.Default()

	// CORS middleware
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3001"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Database Connection Check Middleware
	router.Use(func(c *gin.Context) {
		// Exclude health check and assets from DB check
		if c.Request.URL.Path == "/api/health" || c.Request.URL.Path == "/assets" {
			c.Next()
			return
		}
		if !database.IsConnected() {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"error": "MongoDB is not running locally. Please start a MongoDB server on port 27017 or update MONGODB_URI in .env",
			})
			return
		}
		c.Next()
	})

	// Health check
	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"service": "canvasflow",
			"time":    time.Now().Format(time.RFC3339),
		})
	})

	// Auth routes (public)
	authGroup := router.Group("/api/auth")
	{
		authGroup.POST("/register", auth.Register)
		authGroup.POST("/login", auth.Login)
		authGroup.POST("/refresh", auth.RefreshTokenHandler)
		authGroup.POST("/logout", auth.Logout)
		authGroup.GET("/me", auth.JWTMiddleware(), auth.Me)
	}

	// Board routes (JWT protected)
	boardGroup := router.Group("/api/boards")
	boardGroup.Use(auth.JWTMiddleware())
	{
		boardGroup.POST("", handlers.CreateBoard)
		boardGroup.GET("", handlers.ListBoards)
		boardGroup.GET("/:id", handlers.GetBoard)
		boardGroup.PUT("/:id", handlers.UpdateBoard)
		boardGroup.DELETE("/:id", handlers.DeleteBoard)
		boardGroup.POST("/:id/share", handlers.UpdateShareLink)
		boardGroup.POST("/:id/sync", handlers.SyncBoardElements)
		boardGroup.POST("/:id/ai/summarize", handlers.SummarizeBoard)
	}

	// Upload route (JWT protected)
	router.POST("/api/upload", auth.JWTMiddleware(), handlers.UploadImage)

	// WebSocket route (JWT via query param)
	router.GET("/ws/board/:id", ws.HandleWebSocket(hub))

	// Serve uploaded files
	router.Static("/uploads", config.AppConfig.UploadDir)

	// Serve frontend static files (production mode)
	if _, err := os.Stat("../dist"); err == nil {
		router.Static("/assets", "../dist/assets")
		router.NoRoute(func(c *gin.Context) {
			c.File("../dist/index.html")
		})
		log.Println("📁 Serving frontend from ../dist")
	}

	// Start server
	srv := &http.Server{
		Addr:    ":" + config.AppConfig.Port,
		Handler: router,
	}

	// Graceful shutdown
	go func() {
		log.Printf("🚀 CanvasFlow server running on http://localhost:%s", config.AppConfig.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("🛑 Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced shutdown: %v", err)
	}

	log.Println("👋 Server stopped")
}
