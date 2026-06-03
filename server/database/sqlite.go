package database

import (
	"database/sql"
	"log"

	"github.com/canvasflow/server/config"
	_ "modernc.org/sqlite"
	_ "github.com/tursodatabase/libsql-client-go/libsql"
)

var (
	sqliteDB *sql.DB
)

// InitSQLite initializes the local SQLite database or Turso.
func InitSQLite(dbPath string) error {
	var db *sql.DB
	var err error

	if config.AppConfig.TursoURL != "" {
		url := config.AppConfig.TursoURL
		if config.AppConfig.TursoToken != "" {
			url += "?authToken=" + config.AppConfig.TursoToken
		}
		db, err = sql.Open("libsql", url)
		log.Println("🔌 Connecting to Turso Database...")
	} else {
		db, err = sql.Open("sqlite", dbPath)
		log.Println("✅ Local SQLite DB initialized")
	}

	if err != nil {
		return err
	}

	sqliteDB = db

	// Initialize full store schema (users, boards, elements)
	if err := InitSQLiteStore(); err != nil {
		log.Printf("⚠️  SQLite store init error: %v", err)
		return err
	}
	
	log.Println("✅ Database tables ready")
	return nil
}

// CloseSQLite closes the connection.
func CloseSQLite() {
	if sqliteDB != nil {
		sqliteDB.Close()
	}
}
