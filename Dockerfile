FROM node:22-alpine AS base

# Install dependencies for backend
FROM base AS backend-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci

# Install dependencies for frontend
FROM base AS frontend-deps
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

# Build frontend
FROM base AS frontend-builder
WORKDIR /app/frontend
COPY --from=frontend-deps /app/frontend/node_modules ./node_modules
COPY frontend/ .
RUN npm run build

# Build backend
FROM base AS backend-builder
WORKDIR /app/backend
COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY backend/ .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache curl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs appuser

# Copy backend build
COPY --from=backend-builder --chown=appuser:nodejs /app/backend/dist ./backend/dist
COPY --from=backend-builder --chown=appuser:nodejs /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder --chown=appuser:nodejs /app/backend/package.json ./backend/package.json

# Copy frontend build
COPY --from=frontend-builder --chown=appuser:nodejs /app/frontend/dist ./frontend/dist

# Copy public assets
COPY --from=frontend-builder --chown=appuser:nodejs /app/frontend/public ./frontend/public

# Create folders required for storing results and reports
ARG DATA_DIR=/app/data
ARG RESULTS_DIR=${DATA_DIR}/results
ARG REPORTS_DIR=${DATA_DIR}/reports
ARG TEMP_DIR=/app/.tmp
RUN mkdir -p ${DATA_DIR} ${RESULTS_DIR} ${REPORTS_DIR} ${TEMP_DIR} && \
    chown -R appuser:nodejs ${DATA_DIR} ${TEMP_DIR}

USER appuser

EXPOSE 3001

ENV PORT=3001
ENV FRONTEND_DIST=/app/frontend/dist

WORKDIR /app/backend

CMD ["node", "dist/index.js"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:$PORT/api/ping || exit 1
