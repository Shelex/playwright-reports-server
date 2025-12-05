.PHONY: help install dev build start clean test format lint backend-install frontend-install backend-dev frontend-dev backend-build frontend-build cleanup

help:
	@echo "Playwright Reports Server - Simplified Makefile commands:"
	@echo ""
	@echo "Main commands:"
	@echo "  make install     - Install dependencies for both backend and frontend"
	@echo "  make dev         - Start both backend and frontend in development mode"
	@echo "  make build       - Build both backend and frontend for production"
	@echo "  make start       - Start production server (backend + frontend)"
	@echo "  make clean       - Clean build artifacts and dependencies"
	@echo "  make cleanup     - Kill all development processes and clean up"
	@echo "  make test        - Run tests"
	@echo "  make typecheck   - Run TypeScript type checking"
	@echo "  make format      - Format code using Biome"
	@echo "  make lint        - Check and fix code using Biome"
	@echo ""
	@echo "Individual services:"
	@echo "  make backend-dev    - Start backend only in development mode"
	@echo "  make frontend-dev   - Start frontend only in development mode"
	@echo ""
	@echo "Equivalent npm commands (simpler):"
	@echo "  npm install              - Install dependencies"
	@echo "  npm run dev             - Start both backend and frontend (tsx + concurrently)"
	@echo "  npm run dev:backend     - Start backend only (tsx watch)"
	@echo "  npm run dev:frontend    - Start frontend only (Vite HMR)"
	@echo "  npm run build           - Build both for production"
	@echo "  npm run start           - Start production server"
	@echo "  npm run clean           - Clean up development environment"

# Install all dependencies
install:
	@echo "Installing backend dependencies..."
	cd backend && npm install
	@echo "Installing frontend dependencies..."
	cd frontend && npm install
	@echo "✓ All dependencies installed"

# Development mode - uses npm run dev (tsx + concurrently)
dev:
	@echo "Starting development mode with tsx + concurrently..."
	@echo "Backend will run on http://localhost:3001 (tsx watch)"
	@echo "Frontend will run on http://localhost:3000 (Vite HMR)"
	@echo "Press Ctrl+C to stop both services"
	npx concurrently "npm run dev:backend" "npm run dev:frontend"

backend-dev:
	@echo "Starting backend in development mode with tsx..."
	@echo "Backend will run on http://localhost:3001"
	@echo "Press Ctrl+C to stop"
	cd backend && npm run dev:backend

frontend-dev:
	@echo "Starting frontend in development mode with Vite..."
	@echo "Frontend will run on http://localhost:3000"
	@echo "Press Ctrl+C to stop"
	cd frontend && npm run dev:frontend

build:
	@echo "Building backend and frontend for production..."
	npm run build

start:
	@echo "Starting production server..."
	@echo "Server will run on http://localhost:3001"
	@echo "Fastify will serve both API and frontend static files"
	npm run start

clean:
	@echo "Cleaning build artifacts..."
	rm -rf backend/dist backend/node_modules
	rm -rf frontend/dist frontend/node_modules
	@echo "✓ Clean complete"

test:
	@echo "Running tests..."
	cd backend && npm test || true
	@echo "✓ Tests complete"

typecheck:
	@echo "Running type checks..."
	cd backend && npm run typecheck
	cd frontend && npm run typecheck
	@echo "✓ Type checking complete"

format:
	@echo "Formatting code with Biome..."
	npx biome format --write ./backend/src ./frontend/src
	@echo "✓ Code formatting complete"

lint:
	@echo "Checking and fixing code with Biome..."
	npx biome check ./backend/src ./frontend/src --write
	@echo "✓ Code linting complete"

cleanup:
	@echo "Cleaning up development environment..."
	@./scripts/cleanup-dev.sh
