package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/canvasflow/server/config"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AllowedImageTypes lists accepted MIME types for image uploads.
var AllowedImageTypes = map[string]bool{
	"image/png":  true,
	"image/jpeg": true,
	"image/gif":  true,
	"image/webp": true,
	"image/jpg":  true,
	"image/pjpeg": true,
}

// UploadImage handles POST /api/upload — multipart image upload.
// In production (CLOUDINARY_URL set): uploads to Cloudinary CDN.
// In development (no CLOUDINARY_URL): saves to local uploads/ directory.
func UploadImage(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, config.AppConfig.MaxUploadSize)

	file, header, err := c.Request.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read uploaded file"})
		return
	}
	defer file.Close()

	// Validate MIME type
	contentType := header.Header.Get("Content-Type")
	if !AllowedImageTypes[contentType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only PNG, JPEG, GIF, and WebP images are allowed"})
		return
	}

	// Read file into memory (needed for both paths)
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}

	// --- Production path: Cloudinary ---
	if config.AppConfig.CloudinaryURL != "" {
		url, err := uploadToCloudinary(fileBytes, config.AppConfig.CloudinaryURL)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Cloud upload failed: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"url": url, "filename": filepath.Base(url)})
		return
	}

	// --- Development path: local disk ---
	ext := extensionFromMIME(contentType, header.Filename)
	filename := uuid.New().String() + ext

	uploadDir := config.AppConfig.UploadDir
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	destPath := filepath.Join(uploadDir, filename)
	if err := os.WriteFile(destPath, fileBytes, 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"url":      "/uploads/" + filename,
		"filename": filename,
	})
}

// uploadToCloudinary uploads image bytes to Cloudinary using the Upload API.
// cloudinaryURL format: cloudinary://api_key:api_secret@cloud_name
func uploadToCloudinary(data []byte, cloudinaryURL string) (string, error) {
	// Parse cloudinary://api_key:api_secret@cloud_name
	cloudinaryURL = strings.TrimPrefix(cloudinaryURL, "cloudinary://")
	parts := strings.SplitN(cloudinaryURL, "@", 2)
	if len(parts) != 2 {
		return "", fmt.Errorf("invalid CLOUDINARY_URL format (expected cloudinary://api_key:api_secret@cloud_name)")
	}
	cloudName := parts[1]
	credentials := parts[0] // api_key:api_secret

	uploadURL := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/image/upload", cloudName)

	// Build multipart form
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	// Add file field
	part, err := writer.CreateFormFile("file", "upload")
	if err != nil {
		return "", err
	}
	if _, err := part.Write(data); err != nil {
		return "", err
	}

	// Add upload_preset or use unsigned upload
	_ = writer.WriteField("upload_preset", "ml_default") // fallback preset
	writer.Close()

	req, err := http.NewRequest("POST", uploadURL, &body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	// Use Basic Auth with api_key:api_secret
	credParts := strings.SplitN(credentials, ":", 2)
	if len(credParts) == 2 {
		req.SetBasicAuth(credParts[0], credParts[1])
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		SecureURL string `json:"secure_url"`
		Error     *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to parse Cloudinary response")
	}
	if result.Error != nil {
		return "", fmt.Errorf("cloudinary error: %s", result.Error.Message)
	}
	return result.SecureURL, nil
}

func extensionFromMIME(contentType, originalFilename string) string {
	if ext := filepath.Ext(originalFilename); ext != "" {
		return strings.ToLower(ext)
	}
	switch contentType {
	case "image/png":
		return ".png"
	case "image/jpeg":
		return ".jpg"
	case "image/gif":
		return ".gif"
	case "image/webp":
		return ".webp"
	}
	return ".bin"
}
