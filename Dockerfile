FROM node:22-alpine AS base

# Install dependencies for shared package
FROM base AS shared-deps
WORKDIR /app/packages/shared
COPY packages/shared/package.json packages/shared/package-lock.json* ./
RUN npm ci

# Install dependencies for backend
FROM base AS backend-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app/apps/backend
COPY apps/backend/package.json apps/backend/package-lock.json* ./
RUN npm ci

# Install dependencies for frontend
FROM base AS frontend-deps
WORKDIR /app/apps/frontend
COPY apps/frontend/package.json apps/frontend/package-lock.json* ./
RUN npm ci

# Build shared package first
FROM base AS shared-builder
WORKDIR /app/packages/shared
COPY --from=shared-deps /app/packages/shared/node_modules ./node_modules
COPY packages/shared/ .
RUN npm run build

# Build frontend
FROM base AS frontend-builder
WORKDIR /app/apps/frontend
COPY --from=frontend-deps /app/apps/frontend/node_modules ./node_modules
COPY --from=shared-builder /app/packages/shared/dist ./packages/shared/dist
COPY apps/frontend/ .
RUN npm run build

# Build backend
FROM base AS backend-builder
WORKDIR /app/apps/backend
COPY --from=backend-deps /app/apps/backend/node_modules ./node_modules
COPY --from=shared-builder /app/packages/shared/dist ./packages/shared/dist
COPY apps/backend/ .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache curl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs appuser

# Copy backend build
COPY --from=backend-builder --chown=appuser:nodejs /app/apps/backend/dist ./apps/backend/dist
COPY --from=backend-builder --chown=appuser:nodejs /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=backend-builder --chown=appuser:nodejs /app/apps/backend/package.json ./apps/backend/package.json

# Copy frontend build
COPY --from=frontend-builder --chown=appuser:nodejs /app/apps/frontend/dist ./apps/frontend/dist

# Copy shared build
COPY --from=shared-builder --chown=appuser:nodejs /app/packages/shared/dist ./packages/shared/dist

# Copy public assets
COPY --from=frontend-builder --chown=appuser:nodejs /app/apps/frontend/public ./frontend/public

# Copy environment configuration (for default values)
COPY --chown=appuser:nodejs .env.example /app/.env.example

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
ENV FRONTEND_DIST=/app/apps/frontend/dist

WORKDIR /app/apps/backend

CMD ["node", "dist/index.js"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:$PORT/api/ping || exit 1