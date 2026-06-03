package handlers

import (
	"crypto/rand"
	"math/big"
	"net/http"
	"time"

	"github.com/canvasflow/server/auth"
	"github.com/canvasflow/server/database"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// CreateBoardRequest is the expected body for creating a new board.
type CreateBoardRequest struct {
	Title      string `json:"title" binding:"required"`
	Background string `json:"background"`
}

// helper to build a JSON-friendly board map from SQLiteBoard
func sqliteBoardToMap(b *database.SQLiteBoard) gin.H {
	return gin.H{
		"id":               b.ID,
		"boardId":          b.BoardID,
		"title":            b.Title,
		"background":       b.Background,
		"ownerId":          b.OwnerID,
		"shareLink":        b.ShareLink,
		"sharePermission":  b.SharePermission,
		"roomKey":          b.RoomKey,
		"roomKeyExpiresAt": b.RoomKeyExpiresAt,
		"collaborators":    b.Collaborators,
		"createdAt":        b.CreatedAt,
		"updatedAt":        b.UpdatedAt,
	}
}

// CreateBoard handles POST /api/boards
func CreateBoard(c *gin.Context) {
	var req CreateBoardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Title is required"})
		return
	}

	userID := auth.GetUserID(c)
	bg := req.Background
	if bg == "" {
		bg = "grid"
	}

	boardID := uuid.New().String()
	shareLink := uuid.New().String()

	sqliteBoard := &database.SQLiteBoard{
		ID:              uuid.New().String(),
		BoardID:         boardID,
		Title:           req.Title,
		Background:      bg,
		OwnerID:         userID,
		ShareLink:       shareLink,
		SharePermission: "none",
		Collaborators:   []map[string]interface{}{},
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if err := database.SQLiteCreateBoard(sqliteBoard); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create board: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"board": sqliteBoardToMap(sqliteBoard)})
}

// ListBoards handles GET /api/boards
func ListBoards(c *gin.Context) {
	userID := auth.GetUserID(c)

	boards, err := database.SQLiteListBoards(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch boards"})
		return
	}
	boardMaps := make([]gin.H, 0, len(boards))
	for _, b := range boards {
		boardMaps = append(boardMaps, sqliteBoardToMap(b))
	}
	c.JSON(http.StatusOK, gin.H{"boards": boardMaps})
}

// GetBoard handles GET /api/boards/:id
func GetBoard(c *gin.Context) {
	boardID := c.Param("id")
	userID := auth.GetUserID(c)

	board, err := database.SQLiteGetBoard(boardID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Board not found"})
		return
	}

	// Authorization check
	isOwner := board.OwnerID == userID
	isCollaborator := false
	for _, c := range board.Collaborators {
		if cid, ok := c["userId"].(string); ok && cid == userID {
			isCollaborator = true
			break
		}
	}
	if !isOwner && !isCollaborator {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	if !isOwner {
		board.RoomKey = ""
	}

	elements, _ := database.SQLiteGetElements(boardID)
	if elements == nil {
		elements = []map[string]interface{}{}
	}
	c.JSON(http.StatusOK, gin.H{"board": sqliteBoardToMap(board), "elements": elements})
}

// UpdateBoard handles PUT /api/boards/:id
func UpdateBoard(c *gin.Context) {
	boardID := c.Param("id")
	userID := auth.GetUserID(c)

	var req struct {
		Title      string `json:"title"`
		Background string `json:"background"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if req.Title != "" {
		if err := database.SQLiteUpdateBoardTitle(boardID, userID, req.Title); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update board"})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"message": "Board updated"})
}

// DeleteBoard handles DELETE /api/boards/:id
func DeleteBoard(c *gin.Context) {
	boardID := c.Param("id")
	userID := auth.GetUserID(c)

	if err := database.SQLiteDeleteBoard(boardID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete board"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Board deleted"})
}

// UpdateShareLink handles POST /api/boards/:id/share
func UpdateShareLink(c *gin.Context) {
	var req struct {
		Permission string `json:"permission"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Permission = "view"
	}

	c.JSON(http.StatusOK, gin.H{"message": "Share updated (Local mock)"})
}

// SyncElementsRequest is the expected body for bulk syncing elements.
type SyncElementsRequest struct {
	Elements []map[string]interface{} `json:"elements"`
}

// SyncBoardElements handles POST /api/boards/:id/sync
func SyncBoardElements(c *gin.Context) {
	boardID := c.Param("id")
	userID := auth.GetUserID(c)

	var req SyncElementsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	// Quick auth check
	board, err := database.SQLiteGetBoard(boardID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Board not found"})
		return
	}
	isAuthorized := board.OwnerID == userID
	if !isAuthorized {
		for _, col := range board.Collaborators {
			if cid, ok := col["userId"].(string); ok && cid == userID {
				isAuthorized = true
				break
			}
		}
	}
	if !isAuthorized {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	for _, el := range req.Elements {
		elementId, ok := el["id"].(string)
		if !ok || elementId == "" {
			continue
		}
		_ = database.SQLiteSaveElement(boardID, elementId, el)
	}
	c.JSON(http.StatusOK, gin.H{"message": "Synced", "count": len(req.Elements)})
}

// JoinBoard handles POST /api/rooms/join
func JoinBoard(c *gin.Context) {
	var req struct {
		Key string `json:"key" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Room key is required"})
		return
	}

	userID := auth.GetUserID(c)

	board, err := database.SQLiteGetBoardByRoomKey(req.Key)
	if err != nil || time.Now().After(board.RoomKeyExpiresAt) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invalid or expired room key"})
		return
	}

	if board.OwnerID != userID {
		isCollab := false
		for _, col := range board.Collaborators {
			if cid, ok := col["userId"].(string); ok && cid == userID {
				isCollab = true
				break
			}
		}
		if !isCollab {
			user, _ := database.SQLiteFindUserByID(userID)
			if user != nil {
				_ = database.SQLiteAddCollaborator(board.BoardID, user.ID)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"boardId": board.BoardID})
}

// RefreshRoomKey handles POST /api/boards/:id/key/refresh
func RefreshRoomKey(c *gin.Context) {
	boardID := c.Param("id")
	userID := auth.GetUserID(c)

	board, err := database.SQLiteGetBoard(boardID)
	if err != nil || board.OwnerID != userID {
		c.JSON(http.StatusNotFound, gin.H{"error": "Board not found or unauthorized"})
		return
	}

	newKey := generateRandomRoomKey(6)
	expiresAt := time.Now().Add(24 * time.Hour)

	if err := database.SQLiteUpdateBoardRoomKey(boardID, userID, newKey, expiresAt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update room key"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"roomKey":          newKey,
		"roomKeyExpiresAt": expiresAt,
	})
}

// generateRandomRoomKey creates a random alphanumeric string of a given length
func generateRandomRoomKey(length int) string {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return ""
		}
		b[i] = charset[num.Int64()]
	}
	return string(b)
}


