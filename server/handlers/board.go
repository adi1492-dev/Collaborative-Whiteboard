package handlers

import (
	"crypto/rand"
	"encoding/json"
	"math/big"
	"net/http"
	"time"

	"github.com/canvasflow/server/auth"
	"github.com/canvasflow/server/database"
	ws "github.com/canvasflow/server/websocket"
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
		"id":                b.ID,
		"boardId":           b.BoardID,
		"title":             b.Title,
		"background":        b.Background,
		"ownerId":           b.OwnerID,
		"shareLink":         b.ShareLink,
		"sharePermission":   b.SharePermission,
		"publicViewEnabled": b.PublicViewEnabled,
		"publicViewToken":   b.PublicViewToken,
		"roomKey":           b.RoomKey,
		"roomKeyExpiresAt":  b.RoomKeyExpiresAt,
		"collaborators":     b.Collaborators,
		"createdAt":         b.CreatedAt,
		"updatedAt":         b.UpdatedAt,
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
	role := "editor"
	if !isOwner && !isCollaborator {
		role = "viewer"
	}

	if !isOwner {
		board.RoomKey = ""
	}

	elements, _ := database.SQLiteGetElements(boardID)
	if elements == nil {
		elements = []map[string]interface{}{}
	}
	c.JSON(http.StatusOK, gin.H{
		"board":    sqliteBoardToMap(board),
		"elements": elements,
		"role":     role,
	})
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

// EnablePublicView handles POST /api/boards/:id/share/public
// Generates a long-lived view-only JWT and stores it on the board.
func EnablePublicView(c *gin.Context) {
	boardID := c.Param("id")
	userID := auth.GetUserID(c)

	board, err := database.SQLiteGetBoard(boardID)
	if err != nil || board.OwnerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the board owner can enable public view"})
		return
	}

	viewToken, err := auth.GenerateViewOnlyToken(boardID, board.Title)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate view token"})
		return
	}

	if err := database.SQLiteSetPublicViewToken(boardID, viewToken, true); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"publicViewToken": viewToken, "publicViewEnabled": true})
}

// DisablePublicView handles DELETE /api/boards/:id/share/public
func DisablePublicView(c *gin.Context) {
	boardID := c.Param("id")
	userID := auth.GetUserID(c)

	board, err := database.SQLiteGetBoard(boardID)
	if err != nil || board.OwnerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the board owner can disable public view"})
		return
	}

	if err := database.SQLiteSetPublicViewToken(boardID, "", false); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revoke token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"publicViewEnabled": false})
}

// InviteCollaborator handles POST /api/boards/:id/invite
// Adds a user by email as an editor collaborator.
func InviteCollaborator(c *gin.Context) {
	boardID := c.Param("id")
	userID := auth.GetUserID(c)

	var req struct {
		Email string `json:"email" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email is required"})
		return
	}

	// Ensure requester owns the board
	board, err := database.SQLiteGetBoard(boardID)
	if err != nil || board.OwnerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the board owner can invite collaborators"})
		return
	}

	// Find user by email
	targetUser, err := database.SQLiteFindUserByEmail(req.Email)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No account found with that email address"})
		return
	}

	if targetUser.ID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You cannot invite yourself"})
		return
	}

	// Check if already a collaborator
	for _, col := range board.Collaborators {
		if cid, ok := col["userId"].(string); ok && cid == targetUser.ID {
			c.JSON(http.StatusConflict, gin.H{"error": "User is already a collaborator"})
			return
		}
	}

	if err := database.SQLiteAddCollaborator(boardID, targetUser.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add collaborator"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "Collaborator added successfully",
		"userId":      targetUser.ID,
		"displayName": targetUser.DisplayName,
		"email":       targetUser.Email,
	})
}

// RequestAccess handles POST /api/boards/:id/access/request
func RequestAccess(c *gin.Context) {
	boardID := c.Param("id")
	userID := auth.GetUserID(c)

	board, err := database.SQLiteGetBoard(boardID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Board not found"})
		return
	}

	// Cannot request if owner
	if board.OwnerID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You are the owner"})
		return
	}
	// Check if already collaborator
	for _, col := range board.Collaborators {
		if cid, ok := col["userId"].(string); ok && cid == userID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Already an editor"})
			return
		}
	}

	reqID := uuid.New().String()
	if err := database.SQLiteCreateAccessRequest(reqID, boardID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request"})
		return
	}

	// Notify owner via WebSocket
	user, _ := database.SQLiteFindUserByID(userID)
	userName := "Unknown"
	if user != nil {
		userName = user.DisplayName
	}
	payload, _ := json.Marshal(map[string]string{
		"requestId": reqID,
		"userId":    userID,
		"userName":  userName,
	})
	if ws.DefaultHub != nil {
		ws.DefaultHub.BroadcastToUser(boardID, board.OwnerID, ws.Message{
			Type:      "access_request",
			Payload:   json.RawMessage(payload),
			Timestamp: time.Now().UnixMilli(),
		})
	}

	c.JSON(http.StatusOK, gin.H{"message": "Access requested"})
}

// ApproveAccess handles POST /api/boards/:id/access/approve
func ApproveAccess(c *gin.Context) {
	boardID := c.Param("id")
	userID := auth.GetUserID(c)

	var req struct {
		RequestID string `json:"requestId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Request ID required"})
		return
	}

	board, err := database.SQLiteGetBoard(boardID)
	if err != nil || board.OwnerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only owner can approve"})
		return
	}

	accessReq, err := database.SQLiteGetAccessRequest(req.RequestID)
	if err != nil || accessReq.BoardID != boardID {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}

	if err := database.SQLiteUpdateAccessRequestStatus(req.RequestID, "approved"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update status"})
		return
	}
	
	if err := database.SQLiteAddCollaborator(boardID, accessReq.UserID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add collaborator"})
		return
	}

	// Notify the requesting user
	payload, _ := json.Marshal(map[string]string{
		"status": "approved",
	})
	if ws.DefaultHub != nil {
		ws.DefaultHub.BroadcastToUser(boardID, accessReq.UserID, ws.Message{
			Type:      "access_decision",
			Payload:   json.RawMessage(payload),
			Timestamp: time.Now().UnixMilli(),
		})
	}

	c.JSON(http.StatusOK, gin.H{"message": "Access approved", "userId": accessReq.UserID})
}

// RejectAccess handles POST /api/boards/:id/access/reject
func RejectAccess(c *gin.Context) {
	boardID := c.Param("id")
	userID := auth.GetUserID(c)

	var req struct {
		RequestID string `json:"requestId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Request ID required"})
		return
	}

	board, err := database.SQLiteGetBoard(boardID)
	if err != nil || board.OwnerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only owner can reject"})
		return
	}

	if err := database.SQLiteUpdateAccessRequestStatus(req.RequestID, "rejected"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update status"})
		return
	}

	accessReq, _ := database.SQLiteGetAccessRequest(req.RequestID)
	if accessReq != nil && ws.DefaultHub != nil {
		payload, _ := json.Marshal(map[string]string{
			"status": "rejected",
		})
		ws.DefaultHub.BroadcastToUser(boardID, accessReq.UserID, ws.Message{
			Type:      "access_decision",
			Payload:   json.RawMessage(payload),
			Timestamp: time.Now().UnixMilli(),
		})
	}

	c.JSON(http.StatusOK, gin.H{"message": "Access rejected"})
}

// ListAccessRequests handles GET /api/boards/:id/access/requests
func ListAccessRequests(c *gin.Context) {
	boardID := c.Param("id")
	userID := auth.GetUserID(c)

	board, err := database.SQLiteGetBoard(boardID)
	if err != nil || board.OwnerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only owner can view requests"})
		return
	}

	status := c.Query("status") // optional filter
	reqs, err := database.SQLiteListAccessRequests(boardID, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch requests"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"requests": reqs})
}

// ViewBoardPublic handles GET /api/boards/:id/view?token=... (no auth required)
// Returns board elements if the token is a valid view-only JWT for this board.
func ViewBoardPublic(c *gin.Context) {
	boardID := c.Param("id")
	tokenStr := c.Query("token")

	if tokenStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "View token required"})
		return
	}

	claims, err := auth.ValidateAccessToken(tokenStr)
	if err != nil || claims.Role != "viewer" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired view token"})
		return
	}

	board, err := database.SQLiteGetBoard(boardID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Board not found"})
		return
	}

	if !board.PublicViewEnabled {
		c.JSON(http.StatusForbidden, gin.H{"error": "Public view is not enabled for this board"})
		return
	}

	elements, _ := database.SQLiteGetElements(boardID)
	if elements == nil {
		elements = []map[string]interface{}{}
	}

	// Return board without sensitive data (no room key)
	board.RoomKey = ""
	c.JSON(http.StatusOK, gin.H{
		"board":    sqliteBoardToMap(board),
		"elements": elements,
		"role":     "viewer",
	})
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

// RemoveCollaborator handles DELETE /api/boards/:id/collaborators/:userId
func RemoveCollaborator(c *gin.Context) {
	boardID := c.Param("id")
	targetUserID := c.Param("userId")
	userID := auth.GetUserID(c)

	board, err := database.SQLiteGetBoard(boardID)
	if err != nil || board.OwnerID != userID {
		c.JSON(http.StatusNotFound, gin.H{"error": "Board not found or unauthorized"})
		return
	}

	if err := database.SQLiteRemoveCollaborator(boardID, targetUserID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove collaborator"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Collaborator removed successfully"})
}


