FROM node:22-alpine AS base

# Install all dependencies for monorepo
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Install dependencies for backend
FROM base AS backend-deps
RUN apk add --no-cache libc6-compat

# Install dependencies for frontend

# Build shared package first
FROM base AS shared-builder
WORKDIR /app/packages/shared
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared/ .
RUN npm run build

# Build frontend
FROM base AS frontend-builder
WORKDIR /app/apps/frontend
COPY --from=deps /app/node_modules ./node_modules
COPY --from=shared-builder /app/packages/shared ./packages/shared
COPY apps/frontend/ .
# Remove the shared dependency from package.json temporarily to avoid npm trying to install it
RUN sed -i '/"@playwright-reports\/shared":/d' package.json
# Create symlink for shared package in node_modules for TypeScript resolution
RUN mkdir -p ./node_modules/@playwright-reports \
    ln -sf ../../packages/shared ./node_modules/@playwright-reports/shared
# Install missing rollup native dependency if needed
RUN npm install @rollup/rollup-linux-arm64-musl --no-save || true
# Skip TypeScript checks and just build with Vite
ENV DOCKER_BUILD=true
RUN npm run build:vite

# Build backend
FROM base AS backend-builder
WORKDIR /app/apps/backend
COPY --from=deps /app/node_modules ./node_modules
COPY --from=shared-builder /app/packages/shared ./packages/shared
COPY apps/backend/ .
# Create symlink for shared package in node_modules for TypeScript resolution
RUN mkdir -p ./node_modules/@playwright-reports \
    ln -sf ../../packages/shared ./node_modules/@playwright-reports/shared
# Build first with dev dependencies
RUN npm run build
# Remove the shared dependency from package.json temporarily to avoid npm trying to install it
RUN sed -i '/"@playwright-reports\/shared":/d' package.json
# Install backend production dependencies (removes dev dependencies)
RUN npm ci --only=production

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache curl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs appuser

# Copy all node_modules from deps
COPY --from=deps --chown=appuser:nodejs /app/node_modules ./node_modules

# Copy backend node_modules for backend-specific dependencies
COPY --from=backend-builder --chown=appuser:nodejs /app/apps/backend/node_modules ./apps/backend/node_modules

# Copy backend build
COPY --from=backend-builder --chown=appuser:nodejs /app/apps/backend/dist ./apps/backend/dist
COPY --from=backend-builder --chown=appuser:nodejs /app/apps/backend/package.json ./apps/backend/package.json

# Copy frontend build
COPY --from=frontend-builder --chown=appuser:nodejs /app/apps/frontend/dist ./apps/frontend/dist

# Copy shared build
COPY --from=shared-builder --chown=appuser:nodejs /app/packages/shared/dist ./packages/shared/dist

# Copy public assets
COPY --from=frontend-builder --chown=appuser:nodejs /app/apps/frontend/public ./frontend/public

# Copy environment configuration (for default values)
COPY --chown=appuser:nodejs .env.example /app/.env.example
# Create empty .env if .env doesn't exist
RUN touch /app/.env \ 
    chown appuser:nodejs /app/.env

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