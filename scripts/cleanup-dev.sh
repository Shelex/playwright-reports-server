#!/bin/bash

# Cleanup script for development environment
# Kills all development processes and cleans up lock files

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BACKEND_PORT=3001
FRONTEND_PORT=3000
LOCK_FILE="/tmp/playwright-reports-backend.lock"
PID_FILE="/tmp/playwright-reports-backend.pid"

# Test-specific files
TEST_LOCK_FILE="/tmp/playwright-reports-backend-test.lock"
TEST_PID_FILE="/tmp/playwright-reports-backend-test.pid"
TEST_CLEANUP_LOCK_FILE="/tmp/playwright-test-cleanup.lock"
TEST_SERVER_LOG_FILE="/tmp/test-server.log"

echo -e "${BLUE}🧹 Cleaning up Playwright Reports Server development environment${NC}"

# Function to kill processes on a specific port
kill_port() {
    local port=$1
    local service_name=$2

    local pids=$(lsof -ti :$port 2>/dev/null)
    if [ ! -z "$pids" ]; then
        echo -e "${YELLOW}Killing $service_name processes on port $port: $pids${NC}"
        for pid in $pids; do
            kill -TERM "$pid" 2>/dev/null || true
        done
        sleep 2

        # Force kill any remaining processes
        pids=$(lsof -ti :$port 2>/dev/null)
        if [ ! -z "$pids" ]; then
            echo -e "${RED}Force killing remaining $service_name processes: $pids${NC}"
            for pid in $pids; do
                kill -KILL "$pid" 2>/dev/null || true
            done
        fi
    else
        echo -e "${GREEN}✓ No $service_name processes found on port $port${NC}"
    fi
}

# Function to kill processes by name
kill_by_name() {
    local pattern=$1
    local name=$2

    local pids=$(pgrep -f "$pattern" 2>/dev/null)
    if [ ! -z "$pids" ]; then
        echo -e "${YELLOW}Killing $name processes: $pids${NC}"
        for pid in $pids; do
            kill -TERM "$pid" 2>/dev/null || true
        done
        sleep 2

        # Force kill any remaining processes
        pids=$(pgrep -f "$pattern" 2>/dev/null)
        if [ ! -z "$pids" ]; then
            echo -e "${RED}Force killing remaining $name processes: $pids${NC}"
            for pid in $pids; do
                kill -KILL "$pid" 2>/dev/null || true
            done
        fi
    else
        echo -e "${GREEN}✓ No $name processes found${NC}"
    fi
}

# Kill backend processes
kill_port $BACKEND_PORT "backend"

# Kill frontend processes
kill_port $FRONTEND_PORT "frontend"

# Kill development processes by pattern
kill_by_name "vite-node.*src/index.ts" "vite-node backend"
kill_by_name "next.*dev" "Next.js frontend"
kill_by_name "npm.*dev" "npm dev"

# Kill test-specific processes
echo -e "${YELLOW}Cleaning up test-specific processes...${NC}"

# Kill test server startup script processes
kill_by_name "test-server-start.sh" "test server startup script"
kill_by_name "playwright.*test" "playwright test processes"

# Check for test PID file and kill the process if it exists
if [ -f "$TEST_PID_FILE" ]; then
    TEST_PID=$(cat "$TEST_PID_FILE" 2>/dev/null || echo "")
    if [ ! -z "$TEST_PID" ] && kill -0 "$TEST_PID" 2>/dev/null; then
        echo -e "${YELLOW}Killing test server process: $TEST_PID${NC}"
        kill -TERM "$TEST_PID" 2>/dev/null || true
        sleep 2
        # Force kill if still running
        if kill -0 "$TEST_PID" 2>/dev/null; then
            echo -e "${RED}Force killing test server process: $TEST_PID${NC}"
            kill -KILL "$TEST_PID" 2>/dev/null || true
        fi
    fi
fi

# Clean up lock files
echo -e "${YELLOW}Cleaning up lock files...${NC}"
rm -f "$LOCK_FILE" "$PID_FILE"

# Clean up test-specific lock files
echo -e "${YELLOW}Cleaning up test-specific lock files...${NC}"
rm -f "$TEST_LOCK_FILE" "$TEST_PID_FILE" "$TEST_CLEANUP_LOCK_FILE"

# Clean up temporary log files
echo -e "${YELLOW}Cleaning up temporary log files...${NC}"
rm -f /tmp/backend.log /tmp/frontend.log "$TEST_SERVER_LOG_FILE"

# Clean up development lock
echo -e "${YELLOW}Cleaning up development lock...${NC}"
rm -f "/tmp/playwright-reports-dev.lock"

# Clean up test result files and temporary test data
rm -f /tmp/playwright-test-* /tmp/test-results-* 2>/dev/null || true

echo -e "${GREEN}✅ Development environment cleanup complete${NC}"
echo -e "${BLUE}You can now start fresh development servers with:${NC}"
echo -e "${BLUE}  npm run dev          # Start both backend and frontend${NC}"
echo -e "${BLUE}  npm run dev:backend   # Start backend only${NC}"
echo -e "${BLUE}  npm run dev:frontend  # Start frontend only${NC}"
echo -e ""
echo -e "${BLUE}For test-specific cleanup, you can also run:${NC}"
echo -e "${BLUE}  npm run test         # Run tests (includes automatic cleanup)${NC}"
echo -e "${BLUE}  make test           # Run tests via Makefile${NC}"