# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Build Backend
FROM golang:1.22-alpine AS backend-builder
WORKDIR /app/server

# Cache dependencies
COPY server/go.mod server/go.sum ./
RUN go mod download

# Build backend binary
COPY server/ .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server .

# Stage 3: Minimal Production Image
FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata

# The backend expects to run in ./server and serve ../dist
WORKDIR /app/server

# Copy backend binary and env template
COPY --from=backend-builder /app/server/server .
COPY --from=backend-builder /app/server/.env.example .env

# Copy frontend dist to the parent directory
COPY --from=frontend-builder /app/dist /app/dist

# Expose port
EXPOSE 3001

# Start the server
CMD ["./server"]
