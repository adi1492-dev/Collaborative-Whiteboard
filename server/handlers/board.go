package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/canvasflow/server/auth"
	"github.com/canvasflow/server/database"
	"github.com/canvasflow/server/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// CreateBoardRequest is the expected body for creating a new board.
type CreateBoardRequest struct {
	Title      string `json:"title" binding:"required"`
	Background string `json:"background"`
}

// CreateBoard handles POST /api/boards
func CreateBoard(c *gin.Context) {
	var req CreateBoardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Title is required"})
		return
	}

	userID := auth.GetUserID(c)
	ownerObjID, _ := primitive.ObjectIDFromHex(userID)

	bg := req.Background
	if bg == "" {
		bg = "grid"
	}

	now := time.Now()
	board := models.Board{
		BoardID:         uuid.New().String(),
		Title:           req.Title,
		OwnerID:         ownerObjID,
		Collaborators:   []models.Collaborator{},
		ShareLink:       uuid.New().String(),
		SharePermission: "none",
		Background:      bg,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := database.Boards().InsertOne(ctx, board)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create board"})
		return
	}

	board.ID = result.InsertedID.(primitive.ObjectID)
	c.JSON(http.StatusCreated, gin.H{"board": board})
}

// ListBoards handles GET /api/boards — returns all boards the user owns or collaborates on.
func ListBoards(c *gin.Context) {
	userID := auth.GetUserID(c)
	ownerObjID, _ := primitive.ObjectIDFromHex(userID)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Find boards where user is owner OR a collaborator
	filter := bson.M{
		"$or": []bson.M{
			{"ownerId": ownerObjID},
			{"collaborators.userId": ownerObjID},
		},
	}

	opts := options.Find().SetSort(bson.D{{Key: "updatedAt", Value: -1}})
	cursor, err := database.Boards().Find(ctx, filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch boards"})
		return
	}
	defer cursor.Close(ctx)

	var boards []models.Board
	if err := cursor.All(ctx, &boards); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse boards"})
		return
	}

	if boards == nil {
		boards = []models.Board{}
	}

	c.JSON(http.StatusOK, gin.H{"boards": boards})
}

// GetBoard handles GET /api/boards/:id — returns board details with elements.
func GetBoard(c *gin.Context) {
	boardID := c.Param("id")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var board models.Board
	err := database.Boards().FindOne(ctx, bson.M{"boardId": boardID}).Decode(&board)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Board not found"})
		return
	}

	// Fetch elements for this board
	cursor, err := database.Elements().Find(ctx,
		bson.M{"boardId": boardID},
		options.Find().SetSort(bson.D{{Key: "zIndex", Value: 1}}),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch elements"})
		return
	}
	defer cursor.Close(ctx)

	var elements []bson.M
	if err := cursor.All(ctx, &elements); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse elements"})
		return
	}

	if elements == nil {
		elements = []bson.M{}
	}

	c.JSON(http.StatusOK, gin.H{"board": board, "elements": elements})
}

// UpdateBoard handles PUT /api/boards/:id
func UpdateBoard(c *gin.Context) {
	boardID := c.Param("id")
	userID := auth.GetUserID(c)
	ownerObjID, _ := primitive.ObjectIDFromHex(userID)

	var req struct {
		Title      string `json:"title"`
		Background string `json:"background"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	update := bson.M{"$set": bson.M{"updatedAt": time.Now()}}
	if req.Title != "" {
		update["$set"].(bson.M)["title"] = req.Title
	}
	if req.Background != "" {
		update["$set"].(bson.M)["background"] = req.Background
	}

	result, err := database.Boards().UpdateOne(ctx,
		bson.M{"boardId": boardID, "ownerId": ownerObjID},
		update,
	)
	if err != nil || result.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Board not found or not authorized"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Board updated"})
}

// DeleteBoard handles DELETE /api/boards/:id (owner only)
func DeleteBoard(c *gin.Context) {
	boardID := c.Param("id")
	userID := auth.GetUserID(c)
	ownerObjID, _ := primitive.ObjectIDFromHex(userID)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := database.Boards().DeleteOne(ctx, bson.M{"boardId": boardID, "ownerId": ownerObjID})
	if err != nil || result.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Board not found or not authorized"})
		return
	}

	// Also delete all elements for this board
	_, _ = database.Elements().DeleteMany(ctx, bson.M{"boardId": boardID})

	// And snapshots
	_, _ = database.Snapshots().DeleteMany(ctx, bson.M{"boardId": boardID})

	c.JSON(http.StatusOK, gin.H{"message": "Board deleted"})
}

// UpdateShareLink handles POST /api/boards/:id/share
func UpdateShareLink(c *gin.Context) {
	boardID := c.Param("id")
	userID := auth.GetUserID(c)
	ownerObjID, _ := primitive.ObjectIDFromHex(userID)

	var req struct {
		Permission string `json:"permission"` // "edit", "view", "none"
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Permission = "view"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := database.Boards().UpdateOne(ctx,
		bson.M{"boardId": boardID, "ownerId": ownerObjID},
		bson.M{"$set": bson.M{
			"sharePermission": req.Permission,
			"shareLink":       uuid.New().String(),
			"updatedAt":       time.Now(),
		}},
	)
	if err != nil || result.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Board not found or not authorized"})
		return
	}

	// Fetch updated board to return the new share link
	var board models.Board
	_ = database.Boards().FindOne(ctx, bson.M{"boardId": boardID}).Decode(&board)

	c.JSON(http.StatusOK, gin.H{"shareLink": board.ShareLink, "sharePermission": board.SharePermission})
}

// SyncElementsRequest is the expected body for bulk syncing elements.
type SyncElementsRequest struct {
	Elements []map[string]interface{} `json:"elements"`
}

// SyncBoardElements handles POST /api/boards/:id/sync
func SyncBoardElements(c *gin.Context) {
	boardID := c.Param("id")
	userID := auth.GetUserID(c)
	ownerObjID, _ := primitive.ObjectIDFromHex(userID)

	// Verify user is owner or collaborator (simple check for now, can be expanded)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var board models.Board
	err := database.Boards().FindOne(ctx, bson.M{
		"boardId": boardID,
		"$or": []bson.M{
			{"ownerId": ownerObjID},
			{"collaborators.userId": ownerObjID},
		},
	}).Decode(&board)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Board not found or not authorized"})
		return
	}

	var req SyncElementsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	// For bulk write, we can use individual updates
	for _, el := range req.Elements {
		elementId, ok := el["id"].(string)
		if !ok || elementId == "" {
			continue
		}
		
		el["boardId"] = boardID
		el["elementId"] = elementId
		
		// Use SafeSaveElement for consistency and offline fallback
		database.SafeSaveElement(el)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Synced", "count": len(req.Elements)})
}
