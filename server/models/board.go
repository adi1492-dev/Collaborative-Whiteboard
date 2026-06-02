package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Collaborator represents a user with specific permissions on a board.
type Collaborator struct {
	UserID     primitive.ObjectID `bson:"userId" json:"userId"`
	Permission string             `bson:"permission" json:"permission"` // "edit" or "view"
}

// Board represents a whiteboard workspace.
type Board struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	BoardID         string             `bson:"boardId" json:"boardId"`
	Title           string             `bson:"title" json:"title"`
	OwnerID         primitive.ObjectID `bson:"ownerId" json:"ownerId"`
	Collaborators   []Collaborator     `bson:"collaborators" json:"collaborators"`
	ShareLink       string             `bson:"shareLink" json:"shareLink"`
	SharePermission  string             `bson:"sharePermission" json:"sharePermission"` // "edit", "view", "none"
	RoomKey          string             `bson:"roomKey" json:"roomKey"`
	RoomKeyExpiresAt time.Time          `bson:"roomKeyExpiresAt" json:"roomKeyExpiresAt"`
	Background       string             `bson:"background" json:"background"`           // "grid", "dots", "lines", "blank"
	CreatedAt        time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt        time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// BoardResponse is the public-facing board data.
type BoardResponse struct {
	ID              string         `json:"id"`
	BoardID         string         `json:"boardId"`
	Title           string         `json:"title"`
	OwnerID         string         `json:"ownerId"`
	Collaborators   []Collaborator `json:"collaborators"`
	ShareLink       string         `json:"shareLink"`
	SharePermission string         `json:"sharePermission"`
	Background      string         `json:"background"`
	CreatedAt       time.Time      `json:"createdAt"`
	UpdatedAt       time.Time      `json:"updatedAt"`
}
