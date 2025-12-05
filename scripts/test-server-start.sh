#!/bin/bash

# Test Server Startup Script
# Ensures reliable server startup for Playwright tests with proper health checks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PORT=3001
TEST_LOCK_FILE="/tmp/playwright-reports-backend-test.lock"
TEST_PID_FILE="/tmp/playwright-reports-backend-test.pid"
HEALTH_CHECK_URL="http://localhost:$PORT/api/info"
HEALTH_CHECK_TIMEOUT=60  # Maximum time to wait for server to be ready
HEALTH_CHECK_INTERVAL=2   # Check every 2 seconds

# Function to check if port is in use
check_port() {
    local port=$1
    local processes=$(lsof -ti :$port 2>/dev/null)
    if [ ! -z "$processes" ]; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to perform health check
perform_health_check() {
    local max_attempts=$((HEALTH_CHECK_TIMEOUT / HEALTH_CHECK_INTERVAL))
    local attempt=1

    echo -e "${BLUE}🔍 Checking server health at $HEALTH_CHECK_URL${NC}"

    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$HEALTH_CHECK_URL" >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Server is ready and healthy (attempt $attempt/$max_attempts)${NC}"
            return 0
        fi

        echo -e "${YELLOW}⏳ Health check attempt $attempt/$max_attempts - server not ready yet${NC}"
        sleep $HEALTH_CHECK_INTERVAL
        ((attempt++))
    done

    echo -e "${RED}❌ Server health check failed after $HEALTH_CHECK_TIMEOUT seconds${NC}"
    return 1
}

# Function to cleanup test environment
cleanup_test_environment() {
    echo -e "${BLUE}🧹 Cleaning up test environment...${NC}"

    # Kill any processes using the port
    if check_port $PORT; then
        local pids=$(lsof -ti :$PORT 2>/dev/null)
        if [ ! -z "$pids" ]; then
            echo -e "${YELLOW}Killing processes using port $PORT: $pids${NC}"
            for pid in $pids; do
                kill -TERM "$pid" 2>/dev/null || true
            done
            sleep 2

            # Force kill any remaining processes
            pids=$(lsof -ti :$PORT 2>/dev/null)
            if [ ! -z "$pids" ]; then
                echo -e "${RED}Force killing remaining processes: $pids${NC}"
                for pid in $pids; do
                    kill -KILL "$pid" 2>/dev/null || true
                done
            fi
        fi
    fi

    # Remove test-specific lock files
    rm -f "$TEST_LOCK_FILE" "$TEST_PID_FILE"

    echo -e "${GREEN}✓ Test environment cleaned up${NC}"
}

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down test server...${NC}"

    # Remove lock and PID files
    rm -f "$TEST_LOCK_FILE" "$TEST_PID_FILE"

    # Kill the process group to ensure all child processes are killed
    if [ ! -z "$TEST_SERVER_PID" ]; then
        echo -e "${YELLOW}Stopping server process group...${NC}"
        # Kill the entire process group
        kill -TERM -$TEST_SERVER_PID 2>/dev/null || true
        sleep 2
        kill -KILL -$TEST_SERVER_PID 2>/dev/null || true
    fi

    echo -e "${GREEN}✓ Test server stopped${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM SIGQUIT

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}🚀 Starting Playwright Reports Test Server${NC}"
echo -e "${BLUE}📁 Project directory: $PROJECT_DIR${NC}"
echo -e "${BLUE}🔌 Port: $PORT${NC}"
echo -e "${BLUE}🔗 Health check: $HEALTH_CHECK_URL${NC}"
echo ""

# Check if required directories exist
if [ ! -d "$PROJECT_DIR/backend" ]; then
    echo -e "${RED}Error: Backend directory not found${NC}"
    exit 1
fi

# Clean up any existing test environment
cleanup_test_environment

# Check if another instance is already running
if [ -f "$TEST_LOCK_FILE" ]; then
    # Check if the process in the lock file is still running
    if [ -f "$TEST_PID_FILE" ]; then
        LOCKED_PID=$(cat "$TEST_PID_FILE" 2>/dev/null || echo "")
        if [ ! -z "$LOCKED_PID" ] && kill -0 "$LOCKED_PID" 2>/dev/null; then
            echo -e "${RED}Error: Test server is already running (PID: $LOCKED_PID)${NC}"
            echo -e "${YELLOW}Stopping existing test server...${NC}"
            # Stop the existing test server gracefully
            kill -TERM "$LOCKED_PID" 2>/dev/null || true
            sleep 2
            # Force kill if still running
            kill -KILL "$LOCKED_PID" 2>/dev/null || true
            echo -e "${GREEN}✓ Existing test server stopped${NC}"
            # Clean up lock files
            rm -f "$TEST_LOCK_FILE" "$TEST_PID_FILE"
        else
            # Stale lock file, remove it
            echo -e "${YELLOW}Removing stale test lock file...${NC}"
            rm -f "$TEST_LOCK_FILE" "$TEST_PID_FILE"
        fi
    else
        # No PID file but lock file exists, remove it
        echo -e "${YELLOW}Removing incomplete test lock file...${NC}"
        rm -f "$TEST_LOCK_FILE"
    fi
fi

# Create test-specific lock files
echo $$ > "$TEST_PID_FILE"
echo "Test server running on port $PORT" > "$TEST_LOCK_FILE"

echo -e "${GREEN}🚀 Starting test server...${NC}"
cd "$PROJECT_DIR/backend"

# Start the backend server in background and capture PID
echo -e "${BLUE}📝 Starting backend server process...${NC}"
npm run dev > /tmp/test-server.log 2>&1 &
TEST_SERVER_PID=$!

echo -e "${BLUE}📋 Server started with PID: $TEST_SERVER_PID${NC}"
echo -e "${BLUE}📄 Server logs: /tmp/test-server.log${NC}"

# Wait a moment for the server to start
sleep 3

# Verify the server is still running
if ! kill -0 $TEST_SERVER_PID 2>/dev/null; then
    echo -e "${RED}❌ Server process died unexpectedly${NC}"
    echo -e "${YELLOW}Last 20 lines of server log:${NC}"
    tail -20 /tmp/test-server.log 2>/dev/null || echo "No log file found"
    cleanup
    exit 1
fi

# Perform health check
if perform_health_check; then
    echo -e "${GREEN}✅ Test server is ready for tests${NC}"
    echo -e "${GREEN}🔗 Server URL: $HEALTH_CHECK_URL${NC}"
    echo -e "${GREEN}📝 Server PID: $TEST_SERVER_PID${NC}"

    # Keep the script running to maintain the server process
    # This allows Playwright to reuse the existing server
    echo -e "${BLUE}⏳ Server is running and ready for tests...${NC}"

    # Wait for the server process to finish (when tests complete)
    wait $TEST_SERVER_PID
    exit_code=$?

    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✅ Test server exited normally${NC}"
    else
        echo -e "${RED}❌ Test server exited with error code $exit_code${NC}"
    fi

    cleanup
    exit $exit_code
else
    echo -e "${RED}❌ Failed to start test server properly${NC}"
    echo -e "${YELLOW}Last 20 lines of server log:${NC}"
    tail -20 /tmp/test-server.log 2>/dev/null || echo "No log file found"
    cleanup
    exit 1
fi