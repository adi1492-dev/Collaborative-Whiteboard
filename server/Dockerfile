# ── Stage 1: Build the Go binary ─────────────────────────────────────────────
FROM golang:1.23-alpine AS builder

# Install build dependencies for cgo (needed by modernc/sqlite)
RUN apk add --no-cache gcc musl-dev

WORKDIR /app

# Copy dependency files first for Docker layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy all server source code
COPY . .

# Build the binary — CGO_ENABLED=1 needed for sqlite driver
# -ldflags="-s -w" strips debug symbols (smaller binary)
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o server .

# ── Stage 2: Minimal production image ────────────────────────────────────────
FROM alpine:3.19

# ca-certificates for HTTPS outbound calls (Turso, Cloudinary, Gemini)
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy the compiled binary from the builder stage
COPY --from=builder /app/server .

# Railway injects PORT via environment variable
EXPOSE 3001

# Run the server
CMD ["./server"]
