# ── Stage 1: Build the Go binary ─────────────────────────────────────────────
# NOTE: Build context is the REPO ROOT (not server/).
# Railway sets dockerfilePath = "server/Dockerfile" but context stays at root.
# All COPY paths must be prefixed with "server/".
FROM golang:1.26-alpine AS builder

# gcc + musl-dev needed for CGO (modernc/sqlite driver)
RUN apk add --no-cache gcc musl-dev

WORKDIR /app

# Copy dependency manifests first (better Docker layer caching)
COPY server/go.mod server/go.sum ./
RUN go mod download

# Copy all server source code
COPY server/ .

# Build — CGO_ENABLED=0 creates a statically linked binary (no musl libc dependency)
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server .

# ── Stage 2: Minimal production image ────────────────────────────────────────
FROM alpine:latest

# ca-certificates: needed for HTTPS calls to Turso, Cloudinary, Gemini
# tzdata: needed for correct time zone handling
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/server .

EXPOSE 3001

CMD ["./server"]
