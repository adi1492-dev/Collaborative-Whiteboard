# Collaborative Whiteboard — Implementation Plan (v2)

A real-time collaborative whiteboard where multiple users can draw, place sticky notes, add shapes, and write text simultaneously. Features infinite pan/zoom canvas, cursor presence, WebSocket sync, and export to PNG/SVG/PDF.

> [!IMPORTANT]
> **Changes from v1**: Go backend (replacing Node.js), MongoDB for persistence (replacing JSON files), full JWT authentication with Argon2id + salt + pepper.

---

## Architecture Overview

```mermaid
graph TB
    subgraph "Client — Vite + Vanilla JS"
        UI["UI Shell<br/>Toolbar, Panels, Auth Pages"]
        CM["Canvas Manager<br/>Rendering, Transform, Input"]
        EM["Element Manager<br/>CRUD, Selection, Layers"]
        HM["History Manager<br/>Undo/Redo Stack"]
        WC["WebSocket Client<br/>Sync, Presence, Reconnect"]
        AC["Auth Client<br/>JWT Tokens, Login/Register"]
    end
    
    subgraph "Server — Go (Gin + gorilla/websocket)"
        GIN["HTTP Router (Gin)<br/>REST API + Static Files"]
        AUTH["Auth Handler<br/>Register, Login, Refresh"]
        MW["JWT Middleware<br/>Token Validation"]
        WSH["WebSocket Hub<br/>Room Management"]
        BH["Board Handler<br/>CRUD API"]
        PM["Presence Manager<br/>Cursor Tracking"]
    end

    subgraph "Data Layer"
        MDB["MongoDB<br/>Users, Boards, Elements"]
    end
    
    UI --> CM
    UI --> AC
    CM --> EM
    EM --> HM
    EM --> WC
    AC -->|"REST"| GIN
    WC <-->|"WebSocket"| WSH
    GIN --> AUTH
    GIN --> MW
    GIN --> BH
    WSH --> PM
    AUTH --> MDB
    BH --> MDB
    WSH --> MDB
```

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Vite + Vanilla JS | Zero-framework overhead for canvas; max 60fps perf |
| **Styling** | Vanilla CSS | Full control, glassmorphism, dark mode |
| **Backend** | Go 1.22+ with Gin | High concurrency via goroutines, low latency WebSocket |
| **WebSocket** | `gorilla/websocket` | Industry standard Go WebSocket library |
| **Database** | MongoDB | Flexible document model fits whiteboard elements perfectly |
| **Auth** | JWT (HS256) + Argon2id | Stateless auth with modern password hashing |
| **Font** | Google Fonts (Inter) | Clean, modern typography |

---

## User Review Required

> [!IMPORTANT]
> **MongoDB Connection**: The plan is designed so you can plug in your MongoDB connection string via a `.env` file (`MONGODB_URI`). I'll use a fallback in-memory mode during development until you provide it, so we can still build and test everything.

> [!IMPORTANT]
> **Pepper Storage**: The password pepper (`AUTH_PEPPER`) will be loaded from an environment variable. This must be set before first user registration and **never changed** after, or all existing passwords become unverifiable.

---

## Authentication System — Deep Dive

### Security Architecture

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Go Server
    participant DB as MongoDB

    Note over C,DB: Registration Flow
    C->>S: POST /api/auth/register {email, password, displayName}
    S->>S: Validate input (email format, password strength)
    S->>S: Generate 16-byte crypto random salt
    S->>S: Hash: Argon2id(password + pepper, salt)
    S->>DB: Store {email, displayName, hash, salt, createdAt}
    S->>S: Generate JWT access token (15min) + refresh token (7d)
    S->>C: Set HttpOnly cookies + return user profile

    Note over C,DB: Login Flow
    C->>S: POST /api/auth/login {email, password}
    S->>DB: Fetch user by email
    S->>S: Hash: Argon2id(password + pepper, storedSalt)
    S->>S: Compare hash with stored hash (constant-time)
    S->>S: Generate JWT access + refresh tokens
    S->>C: Set HttpOnly cookies + return user profile

    Note over C,DB: Token Refresh
    C->>S: POST /api/auth/refresh (HttpOnly cookie)
    S->>S: Validate refresh token
    S->>S: Issue new access + refresh tokens (rotation)
    S->>C: Set new HttpOnly cookies

    Note over C,DB: WebSocket Auth
    C->>S: WS upgrade /ws/board/:id?token=<accessToken>
    S->>S: Validate JWT from query param
    S->>S: Check board permissions for user
    S->>C: Upgrade to WebSocket connection
```

### Password Hashing Details

| Parameter | Value | Purpose |
|-----------|-------|---------|
| **Algorithm** | Argon2id | Memory-hard, GPU/ASIC resistant |
| **Memory** | 64 MB | High memory cost for brute-force resistance |
| **Iterations** | 3 | Time cost parameter |
| **Parallelism** | 4 | CPU thread usage |
| **Salt Length** | 16 bytes | Unique per user, crypto/rand generated |
| **Key Length** | 32 bytes | Output hash length |
| **Pepper** | Env var `AUTH_PEPPER` | Server-side secret, prepended to password before hashing |

### JWT Token Structure

**Access Token** (15 min expiry):
```json
{
  "sub": "userId",
  "email": "user@example.com",
  "name": "Display Name",
  "iat": 1700000000,
  "exp": 1700000900,
  "jti": "unique-token-id"
}
```

**Refresh Token** (7 day expiry):
- Stored in MongoDB `refresh_tokens` collection
- Rotated on every use (old token invalidated)
- Linked to user ID and device fingerprint

---

## MongoDB Schema Design

### Collections

#### `users`
```json
{
  "_id": "ObjectId",
  "email": "user@example.com",
  "displayName": "John Doe",
  "avatarColor": "#4f8cff",
  "passwordHash": "base64-encoded-argon2id-hash",
  "passwordSalt": "base64-encoded-16-byte-salt",
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}
```
Index: `{ email: 1 }` (unique)

#### `refresh_tokens`
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "tokenHash": "sha256-of-refresh-token",
  "expiresAt": "ISODate",
  "createdAt": "ISODate"
}
```
Index: `{ tokenHash: 1 }` (unique), `{ expiresAt: 1 }` (TTL)

#### `boards`
```json
{
  "_id": "ObjectId",
  "boardId": "uuid-string",
  "title": "My Board",
  "ownerId": "ObjectId",
  "collaborators": [
    { "userId": "ObjectId", "permission": "edit" | "view" }
  ],
  "shareLink": "uuid-share-token",
  "sharePermission": "edit" | "view" | "none",
  "background": "grid" | "dots" | "lines" | "blank",
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}
```
Indexes: `{ boardId: 1 }` (unique), `{ ownerId: 1 }`, `{ shareLink: 1 }`

#### `elements`
```json
{
  "_id": "ObjectId",
  "boardId": "uuid-string",
  "elementId": "uuid-string",
  "type": "freehand" | "shape" | "sticky" | "text" | "image",
  "x": 100, "y": 200,
  "width": 300, "height": 150,
  "rotation": 0,
  "zIndex": 5,
  "locked": false,
  "opacity": 1.0,
  "visible": true,
  "data": { /* type-specific data */ },
  "style": {
    "strokeColor": "#ffffff",
    "fillColor": "#4f8cff",
    "strokeWidth": 2,
    "fontSize": 16
  },
  "createdBy": "ObjectId",
  "updatedAt": 42,
  "createdAt": "ISODate"
}
```
Indexes: `{ boardId: 1, zIndex: 1 }`, `{ boardId: 1, elementId: 1 }` (unique)

---

## Project Structure

```
collabrative whighte board/
├── server/                         # Go backend
│   ├── go.mod
│   ├── go.sum
│   ├── main.go                     # Entry point, server startup
│   ├── .env.example                # Environment variable template
│   ├── config/
│   │   └── config.go               # Load env vars, app configuration
│   ├── models/
│   │   ├── user.go                 # User model + BSON tags
│   │   ├── board.go                # Board model
│   │   ├── element.go              # Element model (all types)
│   │   └── token.go                # Refresh token model
│   ├── database/
│   │   └── mongo.go                # MongoDB client singleton, collections
│   ├── auth/
│   │   ├── handler.go              # Register, Login, Refresh, Logout endpoints
│   │   ├── middleware.go           # JWT validation middleware
│   │   ├── jwt.go                  # Token generation & validation
│   │   └── password.go             # Argon2id hashing with salt+pepper
│   ├── handlers/
│   │   ├── board.go                # Board CRUD REST endpoints
│   │   ├── element.go              # Element CRUD (used by WS internally)
│   │   └── upload.go               # Image upload handler
│   ├── websocket/
│   │   ├── hub.go                  # Central Hub managing all rooms
│   │   ├── client.go               # Single WS client: read/write pumps
│   │   ├── room.go                 # Per-board room with user tracking
│   │   ├── message.go              # Message types & serialization
│   │   └── presence.go             # Cursor position broadcasting
│   ├── uploads/                    # Uploaded images (gitignored)
│   └── data/                       # Fallback JSON snapshots (dev mode)
│
├── src/                            # Frontend (Vite)
│   ├── index.html                  # Entry HTML
│   ├── main.js                     # App bootstrap & routing
│   ├── styles/
│   │   ├── index.css               # Design system, tokens, dark mode
│   │   ├── auth.css                # Login/Register page styles
│   │   ├── toolbar.css             # Toolbar styles
│   │   ├── panels.css              # Side panels
│   │   └── modals.css              # Modal dialogs
│   ├── pages/
│   │   ├── LoginPage.js            # Login form
│   │   ├── RegisterPage.js         # Registration form
│   │   ├── DashboardPage.js        # Board list + create
│   │   └── BoardPage.js            # Main whiteboard view
│   ├── auth/
│   │   └── AuthManager.js          # JWT storage, refresh, API calls
│   ├── canvas/
│   │   ├── CanvasManager.js        # Core rendering engine
│   │   ├── Transform.js            # Pan/zoom transform matrix
│   │   ├── InputHandler.js         # Mouse/touch/keyboard input
│   │   ├── GridRenderer.js         # Background grid/dots/lines
│   │   └── SelectionBox.js         # Multi-select lasso
│   ├── elements/
│   │   ├── Element.js              # Base element class
│   │   ├── FreehandElement.js      # Pen strokes
│   │   ├── ShapeElement.js         # Rect, circle, arrow, line
│   │   ├── StickyNote.js           # Colored sticky notes
│   │   ├── TextElement.js          # Text boxes
│   │   ├── ImageElement.js         # Uploaded images
│   │   └── ElementManager.js       # Collection + spatial index
│   ├── tools/
│   │   ├── Tool.js                 # Base tool interface
│   │   ├── PenTool.js              # Freehand drawing
│   │   ├── ShapeTool.js            # Shape placement
│   │   ├── StickyTool.js           # Sticky note placement
│   │   ├── TextTool.js             # Text editing
│   │   ├── SelectTool.js           # Select & transform
│   │   ├── PanTool.js              # Hand/pan tool
│   │   ├── EraserTool.js           # Eraser
│   │   └── ImageTool.js            # Image upload
│   ├── ui/
│   │   ├── Toolbar.js              # Main toolbar
│   │   ├── PropertyPanel.js        # Element properties
│   │   ├── LayerPanel.js           # Layer management
│   │   ├── UserPresence.js         # Online users display
│   │   ├── ExportModal.js          # Export dialog
│   │   ├── ShareModal.js           # Share/invite dialog
│   │   ├── TemplateModal.js        # Board templates
│   │   └── Toast.js                # Notifications
│   ├── sync/
│   │   ├── WebSocketClient.js      # WS connection + JWT auth
│   │   ├── SyncManager.js          # Operation serialization
│   │   └── PresenceSync.js         # Cursor sync
│   ├── history/
│   │   └── HistoryManager.js       # Undo/redo
│   ├── export/
│   │   ├── PNGExporter.js          # PNG export
│   │   ├── SVGExporter.js          # SVG export (vector)
│   │   └── PDFExporter.js          # PDF export
│   └── utils/
│       ├── math.js                 # Geometry helpers
│       ├── colors.js               # Color utilities
│       ├── shortcuts.js            # Keyboard shortcuts
│       └── uid.js                  # Client-side ID generation
│
├── package.json                    # Frontend dependencies (Vite)
├── vite.config.js                  # Vite config with Go server proxy
├── ARCHITECTURE.md                 # Architecture documentation
└── prompts/
    └── ai-declaration.md           # AI declaration
```

---

## Proposed Changes — Detailed

### Go Server

---

#### [NEW] server/main.go
- Initialize Gin router with CORS middleware
- Connect to MongoDB (from `MONGODB_URI` env var)
- Register route groups:
  - `/api/auth/*` — Register, Login, Refresh, Logout
  - `/api/boards/*` — Board CRUD (JWT protected)
  - `/api/upload` — Image upload (JWT protected)
  - `/ws/board/:id` — WebSocket upgrade (JWT via query param)
- Start WebSocket Hub goroutine
- Graceful shutdown with `os.Signal`

#### [NEW] server/config/config.go
- Load `.env` file using `godotenv`
- Struct: `Config { Port, MongoURI, JWTSecret, AuthPepper, UploadDir }`
- Validation: panic on missing required vars

#### [NEW] server/database/mongo.go
- Singleton `*mongo.Client` with connection pooling
- Collections: `users`, `boards`, `elements`, `refresh_tokens`
- Index creation on startup
- `Connect()`, `Disconnect()`, `GetCollection()` helpers

#### [NEW] server/auth/password.go
- `HashPassword(password, pepper string) → (hash, salt string, err)`
  - Generate 16-byte crypto/rand salt
  - Prepend pepper to password
  - Run Argon2id with params: memory=64MB, iterations=3, parallelism=4, keyLen=32
  - Return base64-encoded hash + salt
- `VerifyPassword(password, pepper, hash, salt string) → bool`
  - Rebuild hash with same params, constant-time compare

#### [NEW] server/auth/jwt.go
- `GenerateAccessToken(user) → (token string, err)`
  - Claims: sub, email, name, jti, iat, exp (15 min)
  - Sign with HS256 + `JWT_SECRET`
- `GenerateRefreshToken(user) → (token, tokenHash string, err)`
  - Opaque 32-byte random token, stored as SHA-256 hash in DB
  - 7-day expiry
- `ValidateAccessToken(tokenStr) → (claims, err)`
  - Verify signature, check expiry

#### [NEW] server/auth/handler.go
- `POST /api/auth/register` — validate, hash password, create user, issue tokens
- `POST /api/auth/login` — verify credentials, issue tokens
- `POST /api/auth/refresh` — validate refresh token, rotate, issue new pair
- `POST /api/auth/logout` — invalidate refresh token
- `GET /api/auth/me` — return current user profile (JWT protected)

#### [NEW] server/auth/middleware.go
- Extract JWT from `Authorization: Bearer <token>` header
- Validate token, inject user claims into Gin context
- Return 401 on invalid/expired token

#### [NEW] server/handlers/board.go
- `POST /api/boards` — create board, set owner
- `GET /api/boards` — list user's boards (owned + collaborated)
- `GET /api/boards/:id` — get board details + elements
- `PUT /api/boards/:id` — update board settings
- `DELETE /api/boards/:id` — delete board (owner only)
- `POST /api/boards/:id/share` — generate/update share link
- `POST /api/boards/:id/collaborators` — add collaborator by email

#### [NEW] server/handlers/upload.go
- `POST /api/upload` — multipart file upload (images only)
- Validate file type (png, jpg, gif, webp), max 10MB
- Save to `server/uploads/` with UUID filename
- Return URL path for the uploaded file

#### [NEW] server/websocket/hub.go
- Central Hub managing all rooms
- Channels: `register`, `unregister`, `broadcast`
- `Run()` goroutine: infinite select loop
- Room creation/cleanup on first join / last leave

#### [NEW] server/websocket/client.go
- `Client` struct: conn, hub, room, user, send channel
- `ReadPump()`: read messages, parse, route to room
- `WritePump()`: drain send channel, write to conn, handle ping/pong
- Read/write deadlines, message size limits

#### [NEW] server/websocket/room.go
- `Room` struct: boardId, clients map, element cache
- Handle message types: `element_create`, `element_update`, `element_delete`, `element_reorder`, `cursor_move`, `selection_change`
- Persist element changes to MongoDB (debounced, batched)
- Send full state to newly joined clients

#### [NEW] server/websocket/message.go
- Message types enum
- JSON serialization structs
- `Message { Type, Payload, UserId, Timestamp }`

#### [NEW] server/websocket/presence.go
- Track cursor positions per room
- Throttle broadcasts to ~30fps
- User join/leave notifications with avatar colors

---

### Frontend

---

#### [NEW] src/pages/LoginPage.js
- Clean dark-mode login form with glassmorphism card
- Email + password fields with validation
- "Remember me" checkbox
- Link to register page
- JWT stored via AuthManager

#### [NEW] src/pages/RegisterPage.js
- Registration form: display name, email, password, confirm password
- Password strength indicator (length, uppercase, number, symbol)
- Client-side validation before API call

#### [NEW] src/pages/DashboardPage.js
- Grid of board cards (title, thumbnail, last edited, collaborator avatars)
- "Create New Board" button + template selection
- Board actions: rename, delete, share
- Search/filter boards

#### [NEW] src/pages/BoardPage.js
- Main whiteboard view — mounts canvas, toolbar, panels
- Loads board data via REST API, connects WebSocket
- Manages tool state and active element

#### [NEW] src/auth/AuthManager.js
- Store access token in memory (not localStorage — XSS safe)
- Refresh token handled via HttpOnly cookie
- `login()`, `register()`, `logout()`, `refreshToken()`
- Auto-refresh access token before expiry
- `getAuthHeaders()` for API calls
- `isAuthenticated()` check
- Redirect to login on 401

#### Canvas, Elements, Tools, UI, Sync, History, Export
*(These remain the same as v1 plan — see below for summary)*

- **Canvas**: Dual-canvas rendering, transform matrix pan/zoom, viewport culling, grid backgrounds
- **Elements**: Freehand (pressure simulation), shapes (rect/ellipse/arrow/line), sticky notes, text, images
- **Tools**: Select, pen, shape, sticky, text, pan, eraser, image — all with keyboard shortcuts
- **UI**: Floating toolbar, property panel, layer panel, user presence, export/share/template modals, toast notifications
- **Sync**: WebSocket client with JWT auth, auto-reconnect with exponential backoff, cursor presence at 30fps, LWW conflict resolution
- **History**: Per-user undo/redo with inverse operations
- **Export**: PNG (canvas.toBlob), SVG (DOM generation), PDF (SVG-to-PDF)

---

### Styling & Design

#### [NEW] src/styles/index.css
- **Dark mode default** with CSS custom properties
- Palette: deep navy `#0a0e1a`, surface `#141825`, accent blue `#4f8cff`, vibrant gradients
- Glassmorphism: `backdrop-filter: blur(20px)`, semi-transparent panels
- Google Font: Inter (400, 500, 600, 700)
- Smooth transitions, micro-animations, custom scrollbars

#### [NEW] src/styles/auth.css
- Full-page auth layouts with animated gradient backgrounds
- Floating card with glassmorphism
- Input animations, validation states, loading spinners

---

### Documentation

#### [NEW] ARCHITECTURE.md
- System architecture diagram (client ↔ Go server ↔ MongoDB)
- Real-time sync protocol specification (WebSocket message types)
- Conflict resolution: LWW with Lamport timestamps per element property
- Authentication flow: Argon2id + JWT lifecycle
- Canvas rendering pipeline & performance optimizations

#### [NEW] prompts/ai-declaration.md
- AI tools and models used
- Development process documentation

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `V` | Select tool |
| `P` | Pen tool |
| `R` | Rectangle |
| `O` | Ellipse |
| `L` | Line |
| `A` | Arrow |
| `S` | Sticky note |
| `T` | Text |
| `H` / Space | Pan/Hand |
| `E` | Eraser |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+A` | Select all |
| `Delete` | Delete selection |
| `Ctrl+D` | Duplicate |
| `[` / `]` | Send back / Bring forward |
| `Ctrl+E` | Export |
| `+` / `-` | Zoom in/out |
| `Ctrl+0` | Reset zoom |

---

## Environment Variables (.env)

```env
# Server
PORT=3001

# MongoDB
MONGODB_URI=mongodb://localhost:27017/whiteboard

# Authentication
JWT_SECRET=your-256-bit-secret-key-here
AUTH_PEPPER=your-secret-pepper-string-here

# Upload
UPLOAD_DIR=./uploads
MAX_UPLOAD_SIZE=10485760
```

---

## Implementation Order

### Phase 1 — Foundation & Auth (~35%)
1. Go project setup (go mod, Gin, gorilla/websocket)
2. MongoDB connection + models + indexes
3. Auth system: Argon2id hashing, JWT generation/validation, middleware
4. Auth endpoints: register, login, refresh, logout, me
5. Vite frontend setup with proxy to Go server
6. Login + Register pages with full validation
7. Dashboard page with board list + create

### Phase 2 — Canvas Engine (~25%)
8. Canvas rendering engine with dual-canvas setup
9. Transform matrix: pan, zoom, coordinate conversion
10. Input handler: mouse, touch, keyboard delegation
11. Grid/dots/lines background renderer
12. Element base class + freehand + shapes
13. Select tool with transform handles
14. All remaining tools (pen, sticky, text, eraser, pan, image)

### Phase 3 — Real-Time Collaboration (~25%)
15. WebSocket Hub + Room + Client architecture (Go)
16. WebSocket client (JS) with JWT auth + auto-reconnect
17. Sync protocol: element create/update/delete/reorder
18. Cursor presence: broadcast + render remote cursors
19. Board REST API: CRUD, share links, collaborator management
20. Layer panel + property panel
21. Undo/redo history

### Phase 4 — Polish & Deliverables (~15%)
22. Export: PNG, SVG, PDF
23. Template boards (brainstorming, wireframe, retro, mindmap)
24. Dark/light mode toggle
25. Share modal with permissions
26. Auto-save + reconnection recovery
27. ARCHITECTURE.md + AI declaration
28. Performance testing (1000+ elements)

---

## Verification Plan

### Automated Tests
1. **Go build**: `go build ./...` completes without errors
2. **Frontend build**: `npm run build` completes without errors
3. **Auth flow test**: Register → Login → Access protected endpoint → Refresh token → Logout
4. **Multi-tab sync test**: Open 2+ browser tabs, verify:
   - Drawing syncs between tabs in real-time
   - Cursor presence visible across tabs
   - Element CRUD syncs correctly
   - Undo/redo works per-tab independently
5. **Performance test**: Create 1000+ elements, verify smooth pan/zoom at 60fps
6. **Export test**: Export board as PNG, SVG — verify output quality
7. **Security test**: Expired JWT returns 401, invalid tokens rejected, password hash is non-reversible

### Manual Verification
- Visual inspection of UI design, animations, dark mode
- Test all drawing tools and keyboard shortcuts
- Test reconnection recovery (disconnect network, reconnect)
- Test shareable link generation and permission enforcement
- Test board collaboration: owner invites collaborator by email

---

## Requirements Traceability Matrix

### Core Requirements

| # | Requirement | Plan Coverage | Location in Plan | Status |
|---|------------|---------------|------------------|--------|
| 1 | Infinite canvas with smooth pan/zoom (transform matrix) | ✅ Full | Canvas — Transform.js, dual-canvas, viewport culling | Covered |
| 2 | Freehand pen with pressure sensitivity simulation | ✅ Full | FreehandElement.js + PenTool.js | Covered |
| 3 | Shape tools (rectangle, circle, arrow, line) | ✅ Full | ShapeElement.js + ShapeTool.js | Covered |
| 4 | Sticky notes (colored, resizable) | ✅ Full | StickyNote.js + StickyTool.js | Covered |
| 5 | Text boxes | ✅ Full | TextElement.js + TextTool.js | Covered |
| 6 | Image uploader | ✅ Full | ImageElement.js + ImageTool.js + upload handler | Covered |
| 7 | Real-time sync via WebSocket | ✅ Full | WebSocket Hub/Client/Room (Go) + SyncManager.js | Covered |
| 8 | Cursor presence | ✅ Full | presence.go + PresenceSync.js + UserPresence.js | Covered |
| 9 | Shareable board links with view/edit permissions | ✅ Full | Board model `shareLink` + `sharePermission` + ShareModal.js | Covered |
| 10 | Layer management with z-order controls | ✅ Full | LayerPanel.js + `zIndex` on elements + `[`/`]` shortcuts | Covered |
| 11 | Undo/redo history per user | ✅ Full | HistoryManager.js with inverse operations | Covered |
| 12 | Auto-save with reconnection recovery | ⚠️ Partial | Mentioned in Phase 4, details below in Gap Analysis | Needs Detail |

### Constraints

| # | Constraint | Plan Coverage | Notes |
|---|-----------|---------------|-------|
| C1 | 60fps with 1000+ elements | ✅ Full | Dual-canvas, viewport culling, spatial index | Performance test in verification |
| C2 | 10+ concurrent users per board | ✅ Full | Go goroutines + room isolation | No load test script yet |
| C3 | Sync latency < 100ms | ⚠️ Partial | Architecture supports it | No explicit latency measurement |
| C4 | Export must preserve vector quality (SVG-based) | ✅ Full | SVGExporter.js generates SVG DOM directly | Covered |

### Bonus Features

| # | Feature | Plan Coverage | Notes |
|---|---------|---------------|-------|
| B1 | Template boards (brainstorming, wireframe, retro, mindmap) | ✅ Full | TemplateModal.js + Phase 4 | Covered |
| B2 | Comment threads on elements | ❌ Missing | Stretch goal — add after Phase 4 if time permits |
| B3 | Dark mode + canvas backgrounds (grid, dots, lined) | ✅ Full | Dark mode default + GridRenderer.js + board.background | Covered |

### Deliverables

| # | Deliverable | Plan Coverage | Notes |
|---|------------|---------------|-------|
| D1 | Git repository with full source code | ✅ | `.git` already initialized | Ready |
| D2 | Live deployment URL | ✅ | Deployment strategy added below | Covered |
| D3 | ARCHITECTURE.md | ✅ Full | Listed in Phase 4 with content outline | Covered |
| D4 | AI declaration and prompts/ folder | ✅ Full | `prompts/ai-declaration.md` planned | Covered |

---

## Gap Analysis & Resolutions

### Gap 1: Auto-Save Implementation (RESOLVED)

**Strategy**: Debounced save-on-change (500ms debounce)

- Every element create/update/delete triggers a debounced save to MongoDB via WebSocket server
- Server-side: Room batches pending changes, flushes to MongoDB every 500ms or on room idle
- Client-side: On WebSocket reconnect, client sends `sync_request` message
- Server responds with full board state (all elements) + current Lamport timestamp
- Client reconciles: server state wins for any conflicts (LWW), local-only changes are re-sent
- Visual indicator in UI: "Saving..." → "Saved ✓" with fade animation

### Gap 2: Deployment Strategy (RESOLVED)

**Approach**: Single binary deployment — Go serves Vite built frontend as static files

```
Deployment Architecture:
┌─────────────────────────────────────┐
│         Go Binary (single)          │
│  ┌────────────┐  ┌───────────────┐  │
│  │  REST API   │  │ Static Files  │  │
│  │  WebSocket  │  │ (Vite build)  │  │
│  └────────────┘  └───────────────┘  │
└──────────────┬──────────────────────┘
               │
       ┌───────┴───────┐
       │   MongoDB      │
       │  (Atlas Free)  │
       └───────────────┘
```

- **Build**: `npm run build` → `dist/` folder, then `go build` embeds or serves `dist/`
- **Hosting**: Railway / Render / Fly.io (free tier)
  - Go binary serves both API and static frontend on single port
  - MongoDB Atlas free tier (512MB) for database
- **Docker**: Add `Dockerfile` for containerized deployment
- **Environment**: Production `.env` with Atlas connection string + secrets

#### [NEW] Dockerfile
```dockerfile
# Multi-stage: build frontend, build Go, run
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src/ src/
COPY index.html vite.config.js ./
RUN npm run build

FROM golang:1.22-alpine AS backend
WORKDIR /app
COPY server/ server/
WORKDIR /app/server
RUN go mod download
RUN CGO_ENABLED=0 go build -o /whiteboard .

FROM alpine:3.19
COPY --from=backend /whiteboard /whiteboard
COPY --from=frontend /app/dist /dist
EXPOSE 3001
CMD ["/whiteboard"]
```

### Gap 3: Conflict Resolution Details (RESOLVED)

**Strategy**: Property-level LWW with Lamport timestamps

- Each element property change carries a Lamport timestamp
- When two users edit the same element simultaneously:
  - If they edit **different properties** (e.g., one moves, one changes color) → both apply
  - If they edit the **same property** → highest Lamport timestamp wins
- Lamport counter: each client maintains a local counter, incremented on every operation, set to `max(local, received) + 1` on message receipt
- Server stores the latest timestamp per element property in the `elements` collection (`updatedAt` field becomes a per-property map when needed)

### Gap 4: Latency Verification (RESOLVED)

- Add `timestamp` to every WebSocket message (client-side `Date.now()`)
- Server logs round-trip time for element operations
- Client-side: measure time between sending operation and receiving server acknowledgment
- Display latency indicator in UI (green < 50ms, yellow < 100ms, red > 100ms)

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Canvas performance degrades with 1000+ elements | Medium | High | Viewport culling + spatial indexing; verify with performance test |
| WebSocket message ordering issues | Medium | High | Lamport timestamps + property-level LWW + sequence numbers |
| MongoDB connection failures in dev | Low | Medium | In-memory fallback mode planned |
| JWT token expiry during active editing | Medium | Medium | Auto-refresh before expiry in AuthManager |
| Image upload size overwhelming server | Low | Medium | 10MB limit enforced; consider CDN for production |
| Sync latency exceeds 100ms under load | Medium | Medium | Throttle presence to 30fps; batch element updates |
| Data loss on simultaneous edits | Medium | High | Property-level LWW ensures granular conflict resolution |

---

## Updated Implementation Order

### Phase 1 — Foundation & Auth (~30%)
1. Go project setup (go mod, Gin, gorilla/websocket)
2. MongoDB connection + models + indexes
3. Auth system: Argon2id hashing, JWT generation/validation, middleware
4. Auth endpoints: register, login, refresh, logout, me
5. Vite frontend setup with proxy to Go server
6. Login + Register pages with full validation
7. Dashboard page with board list + create

### Phase 2 — Canvas Engine (~25%)
8. Canvas rendering engine with dual-canvas setup
9. Transform matrix: pan, zoom, coordinate conversion
10. Input handler: mouse, touch, keyboard delegation
11. Grid/dots/lines background renderer
12. Element base class + freehand + shapes
13. Select tool with transform handles
14. All remaining tools (pen, sticky, text, eraser, pan, image)

---

## [NEW] High Availability (100% Uptime) Architecture

### User Review Required

> [!WARNING]
> **Vercel Limitations for WebSockets**
> Vercel is built for Serverless functions, which have strict execution timeouts (typically 10-60 seconds) and do not support long-lived WebSocket connections natively. 
> 
> **Proposed Solution**: We can deploy the **Vite Frontend** to Vercel (which it is perfect for), but we must deploy the **Go Backend** to a persistent container service like **Render, Railway, or Fly.io**. Does this hybrid deployment approach work for you?

> [!IMPORTANT]
> **Dual-Database Auto-Sync Complexity**
> Building a 100% uptime system that falls back to a local database when MongoDB Atlas goes down is a complex distributed systems challenge.
> 
> **Proposed Solution**: 
> 1. We will integrate **SQLite** (via `mattn/go-sqlite3`) as an embedded local database on the server.
> 2. When the server detects MongoDB is unreachable, it will gracefully degrade into "Fallback Mode", routing all reads/writes to SQLite.
> 3. A background **Sync Worker** will ping MongoDB every 5 seconds. Once Mongo is back online, it will automatically replay the offline queue from SQLite back to MongoDB.
>
> Are you comfortable with this level of complexity being added to the architecture for the internship project?

### Proposed Dual-Database Architecture

```mermaid
sequenceDiagram
    participant C as Client
    participant G as Go Server
    participant SQL as Local SQLite (Fallback)
    participant MDB as MongoDB Atlas (Primary)

    Note over C,MDB: Normal Operation
    C->>G: Write Element
    G->>MDB: Insert/Update (Success)
    G->>C: Ack

    Note over C,MDB: MongoDB Goes Down
    C->>G: Write Element
    G->>MDB: Insert/Update (Timeout/Error)
    G->>SQL: Save to Offline Queue & Local Cache
    G->>C: Ack (Saved Locally)

    Note over C,MDB: MongoDB Recovers
    G->>MDB: Background Ping (Success)
    G->>SQL: Read Offline Queue
    G->>MDB: Replay Queued Writes (Batch Sync)
    G->>SQL: Clear Queue
    G->>C: Broadcast Sync Complete
```

### Phase 3 — Real-Time Collaboration (~25%)
15. WebSocket Hub + Room + Client architecture (Go)
16. WebSocket client (JS) with JWT auth + auto-reconnect
17. Sync protocol: element create/update/delete/reorder with Lamport timestamps
18. Property-level LWW conflict resolution
19. Cursor presence: broadcast + render remote cursors at 30fps
20. Board REST API: CRUD, share links, collaborator management
21. Layer panel + property panel
22. Undo/redo history

### Phase 4 — Polish & Deliverables (~20%)
23. Auto-save with debounced save-on-change (500ms)
24. Reconnection recovery: full state sync on reconnect
25. Export: PNG, SVG, PDF
26. Template boards (brainstorming, wireframe, retro, mindmap)
27. Dark/light mode toggle
28. Share modal with permissions
29. Latency indicator in UI
30. ARCHITECTURE.md + AI declaration
31. Dockerfile + deployment config
32. Performance testing (1000+ elements, 10+ users)
33. Security hardening: rate limiting on auth endpoints

---

## Open Decisions

> [!IMPORTANT]
> **Comment Threads (Bonus B2)**: This feature is NOT included in the current plan. It can be added as a stretch goal after Phase 4 if time permits. Requires: a `comments` MongoDB collection, a comment UI component anchored to elements, and WebSocket message types for comment CRUD.

> [!NOTE]
> **Hosting Provider**: The plan assumes Railway / Render / Fly.io (free tier). Confirm preferred provider before deployment phase.
