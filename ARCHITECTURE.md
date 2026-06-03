# Architecture Overview

CanvasFlow is a real-time collaborative whiteboard built to simulate a "Figma-lite" experience. The application is designed to support 10+ concurrent users, 60fps rendering with thousands of elements, and ultra-low latency real-time synchronization.

This document outlines the core architecture, specifically focusing on the hybrid networking model, state synchronization, and render optimizations.

---

## 1. Hybrid Networking Architecture (WebRTC + WebSocket)

CanvasFlow uses a **hybrid peer-to-peer (P2P) and client-server architecture** to achieve real-time presence (cursors) and drawing sync with sub-100ms latency.

### The Role of WebSockets (Client-Server)
The Go backend runs a standard WebSocket hub (`/ws/board/:id`). The WebSocket server is primarily responsible for:
1. **Room Management & Discovery:** When a user joins a board, the WebSocket server broadcasts a `peer_joined` message to all users in the room.
2. **WebRTC Signaling:** The WebSocket server acts as the signaling channel, routing `webrtc_offer`, `webrtc_answer`, and `webrtc_ice` messages between peers to establish direct connections.
3. **Persistence (Host Sync):** To minimize database load and avoid sync conflicts, only **one** client in the room (the "Host") is responsible for saving the board state. The Host batches modifications and sends an HTTP POST request to `/api/boards/:id/sync` every 500ms to persist changes to the SQLite database.

### The Role of WebRTC (Peer-to-Peer)
Once peers discover each other via the WebSocket server, they establish a direct WebRTC DataChannel connection. WebRTC is configured as **unordered and unreliable** (similar to UDP), ensuring the fastest possible delivery times.

WebRTC DataChannels carry the heavy, high-frequency traffic:
1. **Live Cursor Presence:** Mouse coordinates are broadcast to all peers at ~30fps.
2. **Element Updates:** As a user drags an element or draws a freehand stroke, the delta is broadcast instantly to peers, bypassing the Go server entirely.

---

## 2. Conflict Resolution and CRDT-Lite

In a collaborative environment where multiple users can manipulate the same elements simultaneously, race conditions and conflicts are inevitable. CanvasFlow employs a Last-Write-Wins (LWW) conflict resolution strategy powered by a **Lamport Logical Clock**.

### Lamport Logical Clock Implementation
Each `SyncManager` instance maintains a local integer clock (`localClock`). 
1. **Tick on Action:** Whenever a user creates, updates, or deletes an element, the local clock increments by 1.
2. **Attach Timestamp:** The current `localClock` value is attached to the element payload as `updatedAt`.
3. **Tick on Receive:** When a client receives an element update from a remote peer, it updates its own local clock to `max(localClock, remoteTimestamp, Date.now()) + 1`.

### Resolving Conflicts (Last-Write-Wins)
When a remote peer sends an update for an existing element, the local `ElementManager` compares the `updatedAt` timestamp of the incoming element against the locally stored element.
- If `remoteElement.updatedAt > localElement.updatedAt`, the remote update is applied.
- If `remoteElement.updatedAt <= localElement.updatedAt`, the remote update is discarded (the local user's change was more recent).

This ensures eventual consistency across all connected clients without requiring a centralized, authoritative game-server.

---

## 3. Render Optimizations (Dual-Canvas Architecture)

Canvas rendering is traditionally CPU intensive. Redrawing 10,000 shapes 60 times a second will crash most browsers. CanvasFlow solves this using a **Dual-Canvas Rendering Loop**.

The DOM consists of two overlapping `<canvas>` elements:
1. **The Static Canvas (Background):** Renders the background grid and all stationary elements. This canvas is **only** redrawn when a user drops an element, finishes drawing, or deletes an item. It operates on demand (`requestStaticRender`).
2. **The Dynamic Canvas (Foreground):** Renders active selections, bounding boxes, the current element being actively dragged or drawn, and remote peer cursors. This canvas is cleared and redrawn on every single frame (`requestAnimationFrame`), but since it only ever contains a few active items, the render cost is negligible.

By splitting the workload, the application guarantees 60fps performance regardless of how complex the background board becomes.

---

## 4. Element Abstraction

All objects on the board (Shapes, Sticky Notes, Text, Freehand Paths) inherit from a base `Element` class. 

The `ElementManager` treats all items generically. Because every element knows how to serialize itself (`toJSON`) and draw itself (`render`), the core networking loop and renderer do not need to know the specifics of what they are drawing. This makes adding new tools and shapes trivially easy.
