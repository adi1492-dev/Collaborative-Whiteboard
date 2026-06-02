package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// User represents a registered user in the system.
type User struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Email        string             `bson:"email" json:"email"`
	DisplayName  string             `bson:"displayName" json:"displayName"`
	AvatarColor  string             `bson:"avatarColor" json:"avatarColor"`
	PasswordHash string             `bson:"passwordHash" json:"-"`
	PasswordSalt string             `bson:"passwordSalt" json:"-"`
	CreatedAt    time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt    time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// UserResponse is the public-facing user profile (no password fields).
type UserResponse struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"displayName"`
	AvatarColor string `json:"avatarColor"`
}

// ToResponse converts a User to a safe public response.
func (u *User) ToResponse() UserResponse {
	return UserResponse{
		ID:          u.ID.Hex(),
		Email:       u.Email,
		DisplayName: u.DisplayName,
		AvatarColor: u.AvatarColor,
	}
}
