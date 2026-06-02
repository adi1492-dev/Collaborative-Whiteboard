package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// SnapshotDelta stores the changes between snapshots.
type SnapshotDelta struct {
	Added    []string               `bson:"added,omitempty" json:"added,omitempty"`
	Modified []map[string]interface{} `bson:"modified,omitempty" json:"modified,omitempty"`
	Removed  []string               `bson:"removed,omitempty" json:"removed,omitempty"`
}

// BoardSnapshot represents a point-in-time snapshot of a board's state.
type BoardSnapshot struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	BoardID        string             `bson:"boardId" json:"boardId"`
	SnapshotType   string             `bson:"snapshotType" json:"snapshotType"` // "auto" or "manual"
	Label          string             `bson:"label,omitempty" json:"label,omitempty"`
	Elements       []Element          `bson:"elements,omitempty" json:"elements,omitempty"`
	Delta          *SnapshotDelta     `bson:"delta,omitempty" json:"delta,omitempty"`
	OperationCount int                `bson:"operationCount" json:"operationCount"`
	CreatedBy      primitive.ObjectID `bson:"createdBy" json:"createdBy"`
	CreatedAt      time.Time          `bson:"createdAt" json:"createdAt"`
}

// SnapshotListItem is a lightweight response for timeline listing.
type SnapshotListItem struct {
	ID             string    `json:"id"`
	SnapshotType   string    `json:"snapshotType"`
	Label          string    `json:"label"`
	OperationCount int       `json:"operationCount"`
	CreatedBy      string    `json:"createdBy"`
	CreatedAt      time.Time `json:"createdAt"`
}
