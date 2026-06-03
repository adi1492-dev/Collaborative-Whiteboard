package database

import (
	"encoding/json"
	"log"
	"time"
)

// InitSQLiteStore creates tables for users, boards, and elements to support full local operation.
func InitSQLiteStore() error {
	if sqliteDB == nil {
		return nil
	}

	queries := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			email TEXT UNIQUE NOT NULL,
			display_name TEXT NOT NULL,
			avatar_color TEXT NOT NULL DEFAULT '#c0c1ff',
			password_hash TEXT NOT NULL,
			password_salt TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS boards (
			id TEXT PRIMARY KEY,
			board_id TEXT UNIQUE NOT NULL,
			title TEXT NOT NULL,
			background TEXT NOT NULL DEFAULT 'grid',
			owner_id TEXT NOT NULL,
			share_link TEXT,
			share_permission TEXT NOT NULL DEFAULT 'none',
			room_key TEXT,
			room_key_expires_at DATETIME,
			collaborators TEXT NOT NULL DEFAULT '[]',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS elements (
			id TEXT PRIMARY KEY,
			board_id TEXT NOT NULL,
			element_id TEXT NOT NULL,
			data TEXT NOT NULL,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(board_id, element_id)
		);`,
		`CREATE TABLE IF NOT EXISTS refresh_tokens (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			token_hash TEXT UNIQUE NOT NULL,
			expires_at DATETIME NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
	}

	for _, q := range queries {
		if _, err := sqliteDB.Exec(q); err != nil {
			return err
		}
	}

	log.Println("✅ SQLite local store tables ready")
	return nil
}

// ---- USER STORE ----

func SQLiteCreateUser(id, email, displayName, avatarColor, passwordHash, passwordSalt string) error {
	_, err := sqliteDB.Exec(
		`INSERT INTO users (id, email, display_name, avatar_color, password_hash, password_salt) VALUES (?, ?, ?, ?, ?, ?)`,
		id, email, displayName, avatarColor, passwordHash, passwordSalt,
	)
	return err
}

type SQLiteUser struct {
	ID           string
	Email        string
	DisplayName  string
	AvatarColor  string
	PasswordHash string
	PasswordSalt string
	CreatedAt    time.Time
}

func SQLiteFindUserByEmail(email string) (*SQLiteUser, error) {
	row := sqliteDB.QueryRow(`SELECT id, email, display_name, avatar_color, password_hash, password_salt, created_at FROM users WHERE email = ?`, email)
	u := &SQLiteUser{}
	err := row.Scan(&u.ID, &u.Email, &u.DisplayName, &u.AvatarColor, &u.PasswordHash, &u.PasswordSalt, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func SQLiteFindUserByID(id string) (*SQLiteUser, error) {
	row := sqliteDB.QueryRow(`SELECT id, email, display_name, avatar_color, password_hash, password_salt, created_at FROM users WHERE id = ?`, id)
	u := &SQLiteUser{}
	err := row.Scan(&u.ID, &u.Email, &u.DisplayName, &u.AvatarColor, &u.PasswordHash, &u.PasswordSalt, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func SQLiteUserExists(email string) bool {
	var count int
	sqliteDB.QueryRow(`SELECT COUNT(*) FROM users WHERE email = ?`, email).Scan(&count)
	return count > 0
}

// ---- REFRESH TOKEN STORE ----

func SQLiteStoreRefreshToken(id, userID, tokenHash string, expiresAt time.Time) error {
	_, err := sqliteDB.Exec(
		`INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
		id, userID, tokenHash, expiresAt,
	)
	return err
}

type SQLiteRefreshToken struct {
	ID        string
	UserID    string
	TokenHash string
	ExpiresAt time.Time
}

func SQLiteFindRefreshToken(tokenHash string) (*SQLiteRefreshToken, error) {
	row := sqliteDB.QueryRow(`SELECT id, user_id, token_hash, expires_at FROM refresh_tokens WHERE token_hash = ?`, tokenHash)
	t := &SQLiteRefreshToken{}
	err := row.Scan(&t.ID, &t.UserID, &t.TokenHash, &t.ExpiresAt)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func SQLiteDeleteRefreshToken(tokenHash string) error {
	_, err := sqliteDB.Exec(`DELETE FROM refresh_tokens WHERE token_hash = ?`, tokenHash)
	return err
}

// ---- BOARD STORE ----

type SQLiteBoard struct {
	ID                string
	BoardID           string
	Title             string
	Background        string
	OwnerID           string
	ShareLink         string
	SharePermission   string
	RoomKey           string
	RoomKeyExpiresAt  time.Time
	Collaborators     []map[string]interface{}
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

func SQLiteCreateBoard(board *SQLiteBoard) error {
	collabJSON, _ := json.Marshal(board.Collaborators)
	_, err := sqliteDB.Exec(
		`INSERT INTO boards (id, board_id, title, background, owner_id, share_link, share_permission, collaborators) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		board.ID, board.BoardID, board.Title, board.Background, board.OwnerID, board.ShareLink, board.SharePermission, string(collabJSON),
	)
	return err
}

func SQLiteGetBoard(boardID string) (*SQLiteBoard, error) {
	row := sqliteDB.QueryRow(`SELECT id, board_id, title, background, owner_id, share_link, share_permission, room_key, room_key_expires_at, collaborators, created_at, updated_at FROM boards WHERE board_id = ?`, boardID)
	b := &SQLiteBoard{}
	var collabJSON string
	var roomKeyExpiresAt *time.Time
	err := row.Scan(&b.ID, &b.BoardID, &b.Title, &b.Background, &b.OwnerID, &b.ShareLink, &b.SharePermission, &b.RoomKey, &roomKeyExpiresAt, &collabJSON, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if roomKeyExpiresAt != nil {
		b.RoomKeyExpiresAt = *roomKeyExpiresAt
	}
	json.Unmarshal([]byte(collabJSON), &b.Collaborators)
	return b, nil
}

func SQLiteListBoards(userID string) ([]*SQLiteBoard, error) {
	rows, err := sqliteDB.Query(`SELECT id, board_id, title, background, owner_id, share_link, share_permission, room_key, room_key_expires_at, collaborators, created_at, updated_at FROM boards WHERE owner_id = ? ORDER BY updated_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var boards []*SQLiteBoard
	for rows.Next() {
		b := &SQLiteBoard{}
		var collabJSON string
		var roomKeyExpiresAt *time.Time
		if err := rows.Scan(&b.ID, &b.BoardID, &b.Title, &b.Background, &b.OwnerID, &b.ShareLink, &b.SharePermission, &b.RoomKey, &roomKeyExpiresAt, &collabJSON, &b.CreatedAt, &b.UpdatedAt); err != nil {
			continue
		}
		if roomKeyExpiresAt != nil {
			b.RoomKeyExpiresAt = *roomKeyExpiresAt
		}
		json.Unmarshal([]byte(collabJSON), &b.Collaborators)
		boards = append(boards, b)
	}
	return boards, nil
}

func SQLiteUpdateBoardTitle(boardID, ownerID, title string) error {
	_, err := sqliteDB.Exec(`UPDATE boards SET title = ?, updated_at = ? WHERE board_id = ? AND owner_id = ?`, title, time.Now(), boardID, ownerID)
	return err
}

func SQLiteUpdateBoardRoomKey(boardID, ownerID, roomKey string, expiresAt time.Time) error {
	_, err := sqliteDB.Exec(`UPDATE boards SET room_key = ?, room_key_expires_at = ?, updated_at = ? WHERE board_id = ? AND owner_id = ?`, roomKey, expiresAt, time.Now(), boardID, ownerID)
	return err
}

func SQLiteGetBoardByRoomKey(roomKey string) (*SQLiteBoard, error) {
	row := sqliteDB.QueryRow(`SELECT id, board_id, title, background, owner_id, share_link, share_permission, room_key, room_key_expires_at, collaborators, created_at, updated_at FROM boards WHERE room_key = ? AND room_key_expires_at > ?`, roomKey, time.Now())
	b := &SQLiteBoard{}
	var collabJSON string
	var roomKeyExpiresAt *time.Time
	err := row.Scan(&b.ID, &b.BoardID, &b.Title, &b.Background, &b.OwnerID, &b.ShareLink, &b.SharePermission, &b.RoomKey, &roomKeyExpiresAt, &collabJSON, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if roomKeyExpiresAt != nil {
		b.RoomKeyExpiresAt = *roomKeyExpiresAt
	}
	json.Unmarshal([]byte(collabJSON), &b.Collaborators)
	return b, nil
}

func SQLiteAddCollaborator(boardID, userID string) error {
	b, err := SQLiteGetBoard(boardID)
	if err != nil {
		return err
	}
	for _, c := range b.Collaborators {
		if c["userId"] == userID {
			return nil // already joined
		}
	}
	b.Collaborators = append(b.Collaborators, map[string]interface{}{"userId": userID, "permission": "edit"})
	collabJSON, _ := json.Marshal(b.Collaborators)
	_, err = sqliteDB.Exec(`UPDATE boards SET collaborators = ?, updated_at = ? WHERE board_id = ?`, string(collabJSON), time.Now(), boardID)
	return err
}

func SQLiteDeleteBoard(boardID, ownerID string) error {
	_, err := sqliteDB.Exec(`DELETE FROM boards WHERE board_id = ? AND owner_id = ?`, boardID, ownerID)
	if err == nil {
		sqliteDB.Exec(`DELETE FROM elements WHERE board_id = ?`, boardID)
	}
	return err
}

// ---- ELEMENT STORE ----

func SQLiteSaveElement(boardID, elementID string, data map[string]interface{}) error {
	dataJSON, _ := json.Marshal(data)
	id := boardID + "_" + elementID
	_, err := sqliteDB.Exec(
		`INSERT INTO elements (id, board_id, element_id, data, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
		id, boardID, elementID, string(dataJSON), time.Now(),
	)
	return err
}

func SQLiteGetElements(boardID string) ([]map[string]interface{}, error) {
	rows, err := sqliteDB.Query(`SELECT data FROM elements WHERE board_id = ? ORDER BY updated_at ASC`, boardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var elements []map[string]interface{}
	for rows.Next() {
		var dataJSON string
		if err := rows.Scan(&dataJSON); err != nil {
			continue
		}
		var el map[string]interface{}
		if err := json.Unmarshal([]byte(dataJSON), &el); err != nil {
			continue
		}
		elements = append(elements, el)
	}
	return elements, nil
}

func SQLiteDeleteElement(boardID, elementID string) error {
	_, err := sqliteDB.Exec(`DELETE FROM elements WHERE board_id = ? AND element_id = ?`, boardID, elementID)
	return err
}
