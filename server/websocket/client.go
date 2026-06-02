package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/canvasflow/server/auth"
	"github.com/canvasflow/server/database"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period (must be less than pongWait).
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer.
	maxMessageSize = 64 * 1024 // 64KB

	// Send channel buffer size.
	sendBufferSize = 256
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in development
	},
}

// Client represents a single WebSocket connection.
type Client struct {
	conn        *websocket.Conn
	hub         *Hub
	Room        *Room
	Send        chan []byte
	UserID      string
	UserName    string
	AvatarColor string
	BoardID     string
	IsHost      bool
}

// HandleWebSocket upgrades an HTTP connection to WebSocket.
// Authenticates via JWT token in query parameter.
func HandleWebSocket(hub *Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		boardID := c.Param("id")
		tokenStr := c.Query("token")

		if tokenStr == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token required"})
			return
		}

		// Validate JWT
		claims, err := auth.ValidateAccessToken(tokenStr)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}

		// Upgrade to WebSocket
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("WebSocket upgrade error: %v", err)
			return
		}

		client := &Client{
			conn:        conn,
			hub:         hub,
			Send:        make(chan []byte, sendBufferSize),
			UserID:      claims.Subject,
			UserName:    claims.Name,
			AvatarColor: "#c0c1ff", // Default, will be fetched from DB in production
			BoardID:     boardID,
		}

		hub.register <- client

		// Start read and write pumps
		go client.writePump()
		go client.readPump()
	}
}

// readPump reads messages from the WebSocket connection.
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Parse message
		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		// Attach sender info
		msg.UserID = c.UserID
		msg.UserName = c.UserName
		msg.Timestamp = time.Now().UnixMilli()

		// Handle message types
		c.handleMessage(msg)
	}
}

// writePump writes messages to the WebSocket connection.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Channel closed
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Drain queued messages into the current write
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte("\n"))
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage routes incoming messages to the appropriate handler.
func (c *Client) handleMessage(msg Message) {
	switch msg.Type {
	case "element_create", "element_update", "element_reorder":
		// Save to HA Dual-Database
		var element map[string]interface{}
		if err := json.Unmarshal(msg.Payload, &element); err == nil {
			element["boardId"] = c.BoardID
			if id, ok := element["id"]; ok {
				element["elementId"] = id
			}
			database.SafeSaveElement(element)
		}
		
		// Broadcast element operations to all other clients in the room
		if c.Room != nil {
			c.Room.Broadcast(msg, c)
		}
		
	case "element_delete":
		var payload struct {
			ElementID string `json:"elementId"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err == nil {
			database.SafeDeleteElement(c.BoardID, payload.ElementID)
		}
		if c.Room != nil {
			c.Room.Broadcast(msg, c)
		}

	case "webrtc_offer", "webrtc_answer", "webrtc_ice":
		// WebRTC data channel signaling (replaces rtc_offer)
		c.handleRTCSignaling(msg)

	case "cursor_move":
		// Broadcast cursor position to all other clients
		if c.Room != nil {
			c.Room.Broadcast(msg, c)
		}

	case "selection_change":
		if c.Room != nil {
			c.Room.Broadcast(msg, c)
		}

	case "text_insert", "text_delete":
		// CRDT text operations — broadcast to all peers
		if c.Room != nil {
			c.Room.Broadcast(msg, c)
		}

	case "rtc_mute_state":
		// Broadcast mute state to all
		if c.Room != nil {
			c.Room.Broadcast(msg, c)
		}

	case "sync_request":
		// Client requesting full state (on reconnect)
		// TODO: Send full board state from DB
		log.Printf("Sync request from %s in room %s", c.UserName, c.BoardID)

	default:
		log.Printf("Unknown message type: %s from %s", msg.Type, c.UserName)
	}
}

// handleRTCSignaling forwards WebRTC signaling messages to the target user.
func (c *Client) handleRTCSignaling(msg Message) {
	if c.Room == nil {
		return
	}

	// Extract target user ID from payload
	var payload struct {
		TargetUserID string `json:"targetUserId"`
	}
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		return
	}

	// Find target client in room and forward
	c.Room.mu.RLock()
	defer c.Room.mu.RUnlock()

	for client := range c.Room.clients {
		if client.UserID == payload.TargetUserID {
			data, _ := json.Marshal(msg)
			select {
			case client.Send <- data:
			default:
			}
			break
		}
	}
}
