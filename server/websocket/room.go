package websocket

import (
	"encoding/json"
	"sync"
)

// Room represents a per-board WebSocket room with connected clients.
type Room struct {
	BoardID string
	clients map[*Client]bool
	mu      sync.RWMutex
}

// NewRoom creates a new room for a board.
func NewRoom(boardID string) *Room {
	return &Room{
		BoardID: boardID,
		clients: make(map[*Client]bool),
	}
}

// AddClient registers a client in this room.
func (r *Room) AddClient(client *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.clients[client] = true
}

// RemoveClient removes a client from this room.
func (r *Room) RemoveClient(client *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.clients, client)
	close(client.Send)
}

// ClientCount returns the number of connected clients.
func (r *Room) ClientCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.clients)
}

// Broadcast sends a message to all clients in the room except the sender.
func (r *Room) Broadcast(msg Message, sender *Client) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	for client := range r.clients {
		if client != sender {
			select {
			case client.Send <- data:
			default:
				// Client's send buffer is full — skip
			}
		}
	}
}

// BroadcastAll sends a message to ALL clients in the room (including sender).
func (r *Room) BroadcastAll(msg Message) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	for client := range r.clients {
		select {
		case client.Send <- data:
		default:
		}
	}
}

// GetUserList returns a list of connected user info for presence display.
func (r *Room) GetUserList() []map[string]string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	users := make([]map[string]string, 0, len(r.clients))
	for client := range r.clients {
		users = append(users, map[string]string{
			"userId":      client.UserID,
			"displayName": client.UserName,
			"avatarColor": client.AvatarColor,
		})
	}
	return users
}
