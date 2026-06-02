package database

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	client   *mongo.Client
	database *mongo.Database
)

// Connect establishes a connection to MongoDB and creates indexes.
func Connect(uri string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOpts := options.Client().ApplyURI(uri).
		SetMaxPoolSize(50).
		SetMinPoolSize(5)

	var err error
	client, err = mongo.Connect(ctx, clientOpts)
	if err != nil {
		return err
	}

	// Ping to verify connection
	if err = client.Ping(ctx, nil); err != nil {
		return err
	}

	database = client.Database("canvasflow")
	log.Println("✅ Connected to MongoDB")

	// Create indexes
	createIndexes(ctx)

	return nil
}

// Disconnect closes the MongoDB connection.
func Disconnect() {
	if client != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = client.Disconnect(ctx)
		log.Println("📦 Disconnected from MongoDB")
	}
}

// GetCollection returns a MongoDB collection by name.
func GetCollection(name string) *mongo.Collection {
	return database.Collection(name)
}

// Users returns the users collection.
func Users() *mongo.Collection {
	return GetCollection("users")
}

// Boards returns the boards collection.
func Boards() *mongo.Collection {
	return GetCollection("boards")
}

// Elements returns the elements collection.
func Elements() *mongo.Collection {
	return GetCollection("elements")
}

// RefreshTokens returns the refresh_tokens collection.
func RefreshTokens() *mongo.Collection {
	return GetCollection("refresh_tokens")
}

// Snapshots returns the board_snapshots collection.
func Snapshots() *mongo.Collection {
	return GetCollection("board_snapshots")
}

func createIndexes(ctx context.Context) {
	// Users: unique email
	_, err := Users().Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "email", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		log.Printf("⚠️  Failed to create users email index: %v", err)
	}

	// Boards: unique boardId
	_, err = Boards().Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "boardId", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "ownerId", Value: 1}}},
		{Keys: bson.D{{Key: "shareLink", Value: 1}}},
	})
	if err != nil {
		log.Printf("⚠️  Failed to create boards indexes: %v", err)
	}

	// Elements: compound indexes
	_, err = Elements().Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "boardId", Value: 1}, {Key: "zIndex", Value: 1}}},
		{Keys: bson.D{{Key: "boardId", Value: 1}, {Key: "elementId", Value: 1}}, Options: options.Index().SetUnique(true)},
	})
	if err != nil {
		log.Printf("⚠️  Failed to create elements indexes: %v", err)
	}

	// Refresh tokens
	_, err = RefreshTokens().Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "tokenHash", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "expiresAt", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(0)},
	})
	if err != nil {
		log.Printf("⚠️  Failed to create refresh_tokens indexes: %v", err)
	}

	// Snapshots
	_, err = Snapshots().Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "boardId", Value: 1}, {Key: "createdAt", Value: -1}},
	})
	if err != nil {
		log.Printf("⚠️  Failed to create snapshots indexes: %v", err)
	}

	log.Println("✅ MongoDB indexes created")
}
