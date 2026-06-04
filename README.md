<div align="center">
  <img src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1200&auto=format&fit=crop" alt="CanvasFlow Hero" style="border-radius: 12px; margin-bottom: 20px;">
  
  # CanvasFlow: Real-Time Collaborative Whiteboard
  
  *A modern, high-performance collaborative whiteboard and UI prototyping tool built with Go, WebSockets, and HTML5 Canvas.*
</div>

---

**CanvasFlow** allows multiple users to draw, type, and build UI mockups simultaneously in real-time. By eschewing heavy frontend frameworks in favor of Vanilla JS and an optimized HTML5 Canvas render loop, it achieves buttery-smooth 60fps performance even with thousands of elements.

## ✨ Core Features

| Feature | Description |
| :--- | :--- |
| 🚀 **Infinite Canvas** | Hardware-accelerated HTML5 canvas with seamless zooming and panning, fully optimized for Retina (high-DPI) displays. |
| ⚡ **Real-Time Sync** | Instant synchronization across all connected clients via a highly concurrent Go WebSocket server. |
| 🛠️ **Rich Toolset** | Everything you need: Pen, Highlighter, Shapes (Rectangles, Circles, Arrows), Text, and Sticky Notes. |
| 🧩 **UI Builder** | Drag-and-drop modern UI components (Buttons, Inputs, Sliders, Checkboxes) for rapid wireframing. |
| 🤖 **AI Generation** | Type a prompt (e.g., "Login Screen") and our Google Gemini integration will magically generate the UI layout directly onto your canvas. |
| 🖼️ **Image Uploads** | Upload images securely via Cloudinary, with automatic fallback to local disk storage if an API key is absent. |
| 🔗 **Advanced Sharing** | Generate public view-only links. Guests can securely request edit access, which owners can approve seamlessly in real-time. |
| 🔒 **Security** | Robust JWT-based authentication to protect your boards and user data. |
| 💽 **Local-First Database** | Uses Turso / SQLite for lightning-fast edge replication and offline capabilities. |

---

## 🛠 Tech Stack

Our tech stack was carefully chosen for maximum performance and minimum bloat:

- **Frontend**: Vanilla JavaScript (ES6+), HTML5 Canvas, Vite, CSS Variables (for themes).
- **Backend**: Go (Golang), Gin Framework, Gorilla WebSockets.
- **Database**: SQLite (via `modernc.org/sqlite`).
- **AI & Storage**: Google Gemini SDK, Cloudinary REST API.

---

## 🚀 Getting Started

CanvasFlow is designed to be incredibly easy to run locally. **Zero external API keys are strictly required** for the core whiteboard to function (it automatically falls back to local SQLite and local disk storage).

### Prerequisites
- Node.js (v18+)
- Go (1.21+)

### 1. Clone the repository
```bash
git clone https://github.com/your-username/canvasflow.git
cd canvasflow
```

### 2. Frontend Setup
```bash
# Install dependencies
npm install

# Start the Vite development server
npm run dev
```
*The frontend will run on `http://localhost:5173`.*

### 3. Backend Setup
Open a new terminal window:
```bash
cd server

# Copy the environment variables template (Use `copy` instead of `cp` on Windows Command Prompt)
cp .env.example .env
```

Edit the `.env` file. **Good news:** All external API keys are completely optional! 

- **Database:** Defaults to a local SQLite file (`canvasflow.db`) if Turso is not provided.
- **Images:** Defaults to saving in a local `./uploads` folder if Cloudinary is not provided.
- **AI:** The UI builder works perfectly manually; the Gemini key is only needed for the AI Generation feature.
- **Secrets:** Just use the dummy `JWT_SECRET` and `AUTH_PEPPER` provided in the template for local testing.

```bash
# Start the Go server
go run main.go
```
*The backend WebSocket and REST APIs will run on `http://localhost:3001`.*

### 🐳 Instant Setup (Docker)
If you prefer not to install Node.js or Go, you can spin up the entire production-ready stack in a single command using Docker:

```bash
docker-compose up --build
```
*The fully functioning app will be available at `http://localhost:3001`.*

---

## 📂 Project Structure

```text
CanvasFlow/
├── src/                # Frontend Vanilla JS Source
│   ├── canvas/         # Rendering engine, Transform, Event handling
│   ├── elements/       # OOP Element classes (Shapes, UI, Text, Sticky)
│   ├── tools/          # Drawing and selection tools
│   ├── sync/           # WebSocket SyncManager for collaboration
│   └── plugins/        # Gemini AI Engine & Template integrations
├── server/             # Go Backend Source
│   ├── handlers/       # REST API Handlers (Auth, Upload, AI)
│   ├── websocket/      # Gorilla WebSocket Hub and Clients
│   └── models/         # SQLite Database queries and schemas
├── prompts/            # Complete history of AI prompts used to build this
├── ARCHITECTURE.md     # In-depth technical architecture and decisions
└── vite.config.js      # Frontend bundler & proxy configuration
```

## 🧠 AI Collaboration History

This project was built in tight collaboration with AI. You can trace the exact evolution of the project—from the initial backend setup to debugging complex WebSocket panics and rendering matrices—by reading the files in the `prompts/` directory. 

*See `ARCHITECTURE.md` and `prompts/AI_DECLARATION.md` for a deep dive into the technical decisions made during this process.*

## 📄 License
MIT License.