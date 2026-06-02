package database

import (
	"database/sql"
	"encoding/json"
	"log"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

var (
	sqliteDB *sql.DB
	queueMu  sync.Mutex
)

// OfflineOperation represents a database operation that failed to sync to MongoDB.
type OfflineOperation struct {
	ID         int64
	Collection string
	Action     string // "insert", "update", "delete"
	Filter     string // JSON encoded bson.M
	Payload    string // JSON encoded data
	CreatedAt  time.Time
}

// InitSQLite initializes the local SQLite fallback database.
func InitSQLite(dbPath string) error {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return err
	}

	// Create offline_queue table if it doesn't exist
	query := `
	CREATE TABLE IF NOT EXISTS offline_queue (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		collection TEXT NOT NULL,
		action TEXT NOT NULL,
		filter TEXT,
		payload TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`
	_, err = db.Exec(query)
	if err != nil {
		return err
	}

	sqliteDB = db
	log.Println("✅ Local SQLite Fallback DB initialized")
	return nil
}

// QueueOperation saves an operation to the local SQLite database when MongoDB is offline.
func QueueOperation(collection, action string, filter interface{}, payload interface{}) error {
	if sqliteDB == nil {
		log.Println("⚠️  Cannot queue operation: SQLite not initialized")
		return nil
	}

	queueMu.Lock()
	defer queueMu.Unlock()

	var filterJSON, payloadJSON []byte
	var err error

	if filter != nil {
		filterJSON, _ = json.Marshal(filter)
	}
	if payload != nil {
		payloadJSON, _ = json.Marshal(payload)
	}

	query := `INSERT INTO offline_queue (collection, action, filter, payload, created_at) VALUES (?, ?, ?, ?, ?)`
	_, err = sqliteDB.Exec(query, collection, action, string(filterJSON), string(payloadJSON), time.Now())
	
	if err != nil {
		log.Printf("❌ Failed to queue offline operation: %v", err)
		return err
	}
	
	log.Printf("📥 Operation queued locally (%s %s)", action, collection)
	return nil
}

// ReadQueue reads the oldest N operations from the queue.
func ReadQueue(limit int) ([]OfflineOperation, error) {
	if sqliteDB == nil {
		return nil, nil
	}

	queueMu.Lock()
	defer queueMu.Unlock()

	query := `SELECT id, collection, action, filter, payload, created_at FROM offline_queue ORDER BY id ASC LIMIT ?`
	rows, err := sqliteDB.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ops []OfflineOperation
	for rows.Next() {
		var op OfflineOperation
		var filterStr, payloadStr sql.NullString
		
		if err := rows.Scan(&op.ID, &op.Collection, &op.Action, &filterStr, &payloadStr, &op.CreatedAt); err != nil {
			log.Printf("⚠️  Error scanning offline queue row: %v", err)
			continue
		}
		
		op.Filter = filterStr.String
		op.Payload = payloadStr.String
		ops = append(ops, op)
	}

	return ops, nil
}

// RemoveFromQueue deletes an operation from the queue after successful sync.
func RemoveFromQueue(id int64) error {
	if sqliteDB == nil {
		return nil
	}

	queueMu.Lock()
	defer queueMu.Unlock()

	_, err := sqliteDB.Exec(`DELETE FROM offline_queue WHERE id = ?`, id)
	return err
}

// CloseSQLite closes the connection.
func CloseSQLite() {
	if sqliteDB != nil {
		sqliteDB.Close()
	}
}
