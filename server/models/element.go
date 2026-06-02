package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ElementStyle holds the visual styling for an element.
type ElementStyle struct {
	StrokeColor string  `bson:"strokeColor,omitempty" json:"strokeColor,omitempty"`
	FillColor   string  `bson:"fillColor,omitempty" json:"fillColor,omitempty"`
	StrokeWidth float64 `bson:"strokeWidth,omitempty" json:"strokeWidth,omitempty"`
	FontSize    float64 `bson:"fontSize,omitempty" json:"fontSize,omitempty"`
	FontFamily  string  `bson:"fontFamily,omitempty" json:"fontFamily,omitempty"`
	TextAlign   string  `bson:"textAlign,omitempty" json:"textAlign,omitempty"`
}

// Element represents a single item on the whiteboard canvas.
type Element struct {
	ID        primitive.ObjectID     `bson:"_id,omitempty" json:"id"`
	BoardID   string                 `bson:"boardId" json:"boardId"`
	ElementID string                 `bson:"elementId" json:"elementId"`
	Type      string                 `bson:"type" json:"type"` // "freehand", "shape", "sticky", "text", "image"
	X         float64                `bson:"x" json:"x"`
	Y         float64                `bson:"y" json:"y"`
	Width     float64                `bson:"width" json:"width"`
	Height    float64                `bson:"height" json:"height"`
	Rotation  float64                `bson:"rotation" json:"rotation"`
	ZIndex    int                    `bson:"zIndex" json:"zIndex"`
	Locked    bool                   `bson:"locked" json:"locked"`
	Opacity   float64                `bson:"opacity" json:"opacity"`
	Visible   bool                   `bson:"visible" json:"visible"`
	Data      map[string]interface{} `bson:"data,omitempty" json:"data,omitempty"`
	Style     ElementStyle           `bson:"style" json:"style"`
	CreatedBy primitive.ObjectID     `bson:"createdBy" json:"createdBy"`
	UpdatedAt int64                  `bson:"updatedAt" json:"updatedAt"` // Lamport timestamp
	CreatedAt time.Time              `bson:"createdAt" json:"createdAt"`
}
