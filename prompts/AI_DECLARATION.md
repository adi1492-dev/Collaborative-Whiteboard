# AI Generation Declaration

## Developer
This project was implemented with assistance from AI development tools.

## Tools Used
- **Agent:** Google DeepMind Antigravity AI Assistant
- **Roles:** Full Stack Development, Architecture Design, Debugging, Bug Fixing, Feature Engineering
- **Timeline:** June 2026

## Usage Extent
The AI assistant was actively utilized for:
1. **Architecture Planning:** Designing the hybrid WebRTC + WebSocket sync model, Lamport timestamp-based LWW conflict resolution, dual-canvas rendering architecture, and the full feature roadmap for CanvasFlow 2.0.
2. **Code Generation:** Generating core infrastructure code in both JavaScript (Frontend) and Go (Backend) including all element types, sync managers, canvas renderers, UI components, and API handlers.
3. **Debugging & Bug Fixing:** Diagnosing memory leaks, resolving infinite WebSocket reconnection loops, fixing canvas rendering race conditions, tracking down cursor de-duplication logic, and establishing proper Undo/Redo historical stacks.
4. **Refactoring:** Integrating SQLite as a persistent store, retrofitting MongoDB features, resolving Turso/local DB compatibility, and implementing the WebSocket fallback relay.
5. **Feature Expansion (CanvasFlow 2.0):**
   - Template boards (Brainstorming, Wireframe, Retrospective, Mind Map)
   - Comment threads with threaded replies, author avatars, and resolve/re-open
   - SVG export (vector-quality) and SVG import (shape/path/text parsing)
   - UI Builder Mode: 8 canvas-rendered UI components (Button, Input, Card, Badge, Toggle, Dropdown, Navbar, Modal)
   - Shareable public view-only links (JWT-based, 30-day expiry)
   - Email-based collaborator invites
   - Background settings (Grid, Dots, Lines, None) and Dark/Light theme toggle

## Prompts & Methodology
The assistant operated in a conversational pair-programming mode. The workflow typically involved providing a core project requirement and receiving an initial scaffold, followed by iterative requests for bug fixes, performance improvements, and feature expansions.

A selection of the critical instructions provided to the AI:
- "Build a real-time collaborative whiteboard where multiple users can draw, place sticky notes, add shapes..."
- "when i leave the canvas the it actually wont leave if i move cursor on dashboard it reflect on the canvas and also eraser wont work and undo feature wont work in eraser..."
- "remove mongo db completely and use turso only"
- "make the canvas p2p means no server involve while working on server except saving..."
- "there are only 2 people in room but it shows 4 to 5 cursors... fix it"
- "AI declaration and prompts folder, Template boards (brainstorming, wireframe, retro, mindmap), Comment threads attached to specific elements, Dark mode and multiple canvas backgrounds, Shareable board links with view/edit permissions, Layer management with z-order controls, Undo/redo history for the entire session, Export must preserve vector quality (SVG-based export), add all this to project"
- "svg import also"
- "allow user to build their app ui in this canvas also provide this features"

## Architecture Overview

### Frontend
- **Rendering:** Dual-canvas system — Static background canvas (persistent elements) + Active foreground canvas (tools, cursors, overlays)
- **Sync:** Hybrid WebRTC P2P (low latency) + WebSocket relay fallback (guaranteed delivery)
- **Conflict Resolution:** Lamport Logical Clocks + Last-Write-Wins (LWW) on property level
- **Elements:** FreehandElement, ShapeElement, StickyNote, TextElement, ImageElement, CommentElement, UIElement (8 component types)
- **Tools:** Select, Pan, Pen, Rectangle/Ellipse/Triangle/Diamond/Star/Polygon, Line/Arrow, Sticky, Text, Eraser, Image
- **UI Builder:** Button, Input, Card, Badge, Toggle, Dropdown, Navbar, Modal — all canvas-rendered with Dark/Light themes

### Backend (Go + Gin)
- **Database:** SQLite (local) with automatic schema migrations
- **Auth:** JWT access tokens (15-min) + opaque refresh tokens (SHA-256 hashed)
- **Permissions:** Role-encoded JWTs (`editor` | `viewer`) for share link access control
- **WebSocket:** Per-room hub with client broadcast, presence tracking, and relay fallback
- **Storage:** Per-board element persistence with Last-Write-Wins semantics

All code has been verified and curated to ensure stability, performance, and fulfillment of the project requirements.
