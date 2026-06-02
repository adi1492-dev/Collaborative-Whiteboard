package websocket

import (
	"encoding/json"
	"log"
	"sync"
)

// Message represents a WebSocket message exchanged between clients and server.
type Message struct {
	Type      string          `json:"type"`
	Payload   json.RawMessage `json:"payload,omitempty"`
	UserID    string          `json:"userId,omitempty"`
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

	room.AddClient(client)
	client.Room = room
	log.Printf("👤 User %s joined room %s (%d users)", client.UserName, client.BoardID, room.ClientCount())
}

func (h *Hub) removeClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if client.Room != nil {
		client.Room.RemoveClient(client)
		log.Printf("👋 User %s left room %s (%d users)", client.UserName, client.BoardID, client.Room.ClientCount())

		// Clean up empty rooms
		if client.Room.ClientCount() == 0 {
			delete(h.rooms, client.BoardID)
			log.Printf("🏚️  Room destroyed: %s", client.BoardID)
		}
	}
}
