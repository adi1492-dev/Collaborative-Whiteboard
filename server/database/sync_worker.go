package database

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	mongoConnected bool
	syncing        bool
)

// StartBackgroundSyncWorker continuously pings MongoDB and replays the offline queue when connected.
func StartBackgroundSyncWorker() {
	ticker := time.NewTicker(5 * time.Second)
	
	// Initial state check
	mongoConnected = IsConnected()

	go func() {
		for range ticker.C {
			checkConnectionAndSync()
		}
	}()
}

func checkConnectionAndSync() {
	if client == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	err := client.Ping(ctx, nil)
	cancel()

	wasConnected := mongoConnected

	if err != nil {
		if wasConnected {
			log.Println("🚨 MongoDB connection lost! Entering Fallback Mode.")
			mongoConnected = false
		}
		return
	}

	if !wasConnected {
		log.Println("✅ MongoDB connection restored! Exiting Fallback Mode.")
		mongoConnected = true
	}

	if mongoConnected && !syncing {
		syncing = true
		go ReplayOfflineQueue()
	}
}

// ReplayOfflineQueue reads from SQLite and applies to MongoDB.
func ReplayOfflineQueue() {
	defer func() { syncing = false }()

	for {
		ops, err := ReadQueue(50) // Process in batches of 50
		if err != nil || len(ops) == 0 {
			break
		}

		for _, op := range ops {
			success := applyOperationToMongo(op)
			if success {
				RemoveFromQueue(op.ID)
			} else {
				// If we fail to apply, we should stop and try again later
				log.Println("⚠️  Stopping replay due to MongoDB apply error")
				return
			}
		}
		
		log.Printf("🔄 Synced %d offline operations to MongoDB", len(ops))
	}
}

func applyOperationToMongo(op OfflineOperation) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	col := GetCollection(op.Collection)
	if col == nil {
		return false
	}

	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(op.Payload), &payload); err != nil {
		log.Printf("⚠️  Invalid payload in queue op %d: %v", op.ID, err)
		return true // Return true to delete it, it's malformed
	}

	var filter map[string]interface{}
	if op.Filter != "" && op.Filter != "null" {
		if err := json.Unmarshal([]byte(op.Filter), &filter); err != nil {
			log.Printf("⚠️  Invalid filter in queue op %d: %v", op.ID, err)
			return true
		}
	}

	switch op.Action {
	case "insert":
		_, err := col.InsertOne(ctx, payload)
		return err == nil
	case "update":
		updateDoc := bson.M{"$set": payload}
		opts := options.Update().SetUpsert(true)
		_, err := col.UpdateOne(ctx, filter, updateDoc, opts)
		return err == nil
	case "delete":
		_, err := col.DeleteOne(ctx, filter)
		return err == nil
	default:
		return true // Unknown action, discard
	}
}

// SafeSaveElement attempts to save to Mongo, falls back to SQLite queue
func SafeSaveElement(element interface{}) {
	// Normally we would update the element in MongoDB here.
	// For this architecture demo, we serialize the element and try MongoDB.
	
	payloadBytes, _ := json.Marshal(element)
	var payload map[string]interface{}
	json.Unmarshal(payloadBytes, &payload)
	
	elementId, ok := payload["elementId"].(string)
	if !ok {
		return
	}
	boardId, ok := payload["boardId"].(string)
	if !ok {
		return
	}

	filter := bson.M{"boardId": boardId, "elementId": elementId}

	if mongoConnected {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		
		opts := options.Update().SetUpsert(true)
		_, err := Elements().UpdateOne(ctx, filter, bson.M{"$set": payload}, opts)
		if err == nil {
			return // Success
		}
		log.Printf("⚠️  Mongo save failed, falling back to SQLite: %v", err)
	}

	// Fallback to SQLite
	QueueOperation("elements", "update", filter, payload)
}

func SafeDeleteElement(boardId, elementId string) {
	filter := bson.M{"boardId": boardId, "elementId": elementId}

	if mongoConnected {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		
		_, err := Elements().DeleteOne(ctx, filter)
		if err == nil {
			return // Success
		}
		log.Printf("⚠️  Mongo delete failed, falling back to SQLite: %v", err)
	}

	// Fallback to SQLite
	QueueOperation("elements", "delete", filter, nil)
}
