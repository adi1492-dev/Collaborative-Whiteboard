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

func (r *Room) AddClient(client *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	if len(r.clients) == 0 {
		client.IsHost = true
		// Notify the client that they are the host
		msg := Message{
			Type: "host_assigned",
		}
		data, _ := json.Marshal(msg)
		select {
		case client.Send <- data:
		default:
		}
	} else {
		client.IsHost = false
	}
	
	r.clients[client] = true
}

// RemoveClient removes a client from this room.
func (r *Room) RemoveClient(client *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	if _, exists := r.clients[client]; !exists {
		return
	}
	
	delete(r.clients, client)
	close(client.Send)
	
	// Reassign host if the host left
	if client.IsHost && len(r.clients) > 0 {
		client.IsHost = false
		for c := range r.clients {
			c.IsHost = true
			
			// Notify the new host
			msg := Message{
				Type: "host_assigned",
			}
			data, _ := json.Marshal(msg)
			select {
			case c.Send <- data:
			default:
			}
			break
		}
	}
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
func (r *Room) GetUserList() []map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()

	users := make([]map[string]interface{}, 0, len(r.clients))
	for client := range r.clients {
		users = append(users, map[string]interface{}{
			"userId":      client.UserID,
			"displayName": client.UserName,
			"avatarColor": client.AvatarColor,
			"isHost":      client.IsHost,
		})
	}
	return users
}

// GetUserListWithClientID returns all existing members including their clientId.
// Used when a new joiner needs to know who is already in the room.
func (r *Room) GetUserListWithClientID() []map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()

	users := make([]map[string]interface{}, 0, len(r.clients))
	for client := range r.clients {
		users = append(users, map[string]interface{}{
			"userId":      client.UserID,
			"clientId":    client.ClientID,
			"displayName": client.UserName,
			"isHost":      client.IsHost,
		})
	}
	return users
}
