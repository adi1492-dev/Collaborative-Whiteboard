package websocket

import (
	"encoding/json"
	"log"
	"sync"
	"time"
)

// Message represents a WebSocket message exchanged between clients and server.
type Message struct {
	Type      string          `json:"type"`
	Payload   json.RawMessage `json:"payload,omitempty"`
	UserID    string          `json:"userId,omitempty"`
	ClientID  string          `json:"clientId,omitempty"`
	UserName  string          `json:"userName,omitempty"`
	Timestamp int64           `json:"timestamp,omitempty"`
}

// Hub manages all WebSocket rooms and clients.
type Hub struct {
	rooms      map[string]*Room
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

var DefaultHub *Hub

// NewHub creates a new WebSocket Hub.
func NewHub() *Hub {
	return &Hub{
		rooms:      make(map[string]*Room),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the hub's main event loop (run as goroutine).
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.addClient(client)

		case client := <-h.unregister:
			h.removeClient(client)
		}
	}
}

func (h *Hub) addClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	room, exists := h.rooms[client.BoardID]
	if !exists {
		room = NewRoom(client.BoardID)
		h.rooms[client.BoardID] = room
		log.Printf("🏠 Room created: %s", client.BoardID)
	}

	// Capture existing members BEFORE adding the new client
	existingMembers := room.GetUserListWithClientID()

	room.AddClient(client)
	client.Room = room
	log.Printf("👤 User %s joined room %s (%d users)", client.UserName, client.BoardID, room.ClientCount())

	// Broadcast peer_joined to existing clients ONLY (not the new joiner)
	// This prevents the new joiner from counting themselves in activeUsers
	joinMsg := Message{
		Type:      "peer_joined",
		UserID:    client.UserID,
		ClientID:  client.ClientID,
		UserName:  client.UserName,
		Timestamp: time.Now().UnixMilli(),
	}
	room.Broadcast(joinMsg, client) // Only send to others, NOT the new client

	// Send the new joiner a room_state message with all EXISTING members
	// so they can populate their activeUsers map correctly
	if len(existingMembers) > 0 {
		payload, _ := json.Marshal(map[string]interface{}{
			"members": existingMembers,
		})
		roomStateMsg := Message{
			Type:    "room_state",
			Payload: json.RawMessage(payload),
		}
		data, _ := json.Marshal(roomStateMsg)
		select {
		case client.Send <- data:
		default:
		}
	}
}

func (h *Hub) removeClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if client.Room != nil {
		room := client.Room
		room.RemoveClient(client)
		log.Printf("👋 User %s left room %s (%d users)", client.UserName, client.BoardID, room.ClientCount())

		// Broadcast peer_left
		leaveMsg := Message{
			Type:      "peer_left",
			UserID:    client.UserID,
			ClientID:  client.ClientID,
			Timestamp: time.Now().UnixMilli(),
		}
		room.BroadcastAll(leaveMsg)

		// Clean up empty rooms
		if room.ClientCount() == 0 {
			delete(h.rooms, client.BoardID)
			log.Printf("🏚️  Room destroyed: %s", client.BoardID)
		}
	}
}

// BroadcastToUser sends a message to all clients of a specific user in a room.
func (h *Hub) BroadcastToUser(boardID, userID string, msg Message) {
	h.mu.RLock()
	room, exists := h.rooms[boardID]
	h.mu.RUnlock()

	if !exists {
		return
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	room.mu.RLock()
	defer room.mu.RUnlock()
	for client := range room.clients {
		if client.UserID == userID {
			select {
			case client.Send <- data:
			default:
			}
		}
	}
}
