FROM node:22-alpine AS base

# Install pnpm globally
RUN npm install -g pnpm

# Install build tools for native dependencies (better-sqlite3, sharp, esbuild)
RUN apk add --no-cache python3 make g++ libc6-compat curl

# Install all dependencies for monorepo from the ROOT
# This is critical: pnpm install must run from root where pnpm-workspace.yaml
# and root package.json with overrides are located
FROM base AS deps
WORKDIR /app

# Copy workspace configuration files first
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./.npmrc ./

# Copy all workspace packages so pnpm can resolve local dependencies
COPY packages/ ./packages/
COPY apps/ ./apps/

# Install dependencies from root with frozen lockfile
# This reads the overrides from root package.json and onlyBuiltDependencies from pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile

# Build shared package first using pnpm filter from root
FROM base AS shared-builder
WORKDIR /app

# Copy the entire workspace structure with node_modules from deps
COPY --from=deps /app/ ./

# Build shared package using pnpm filter from root
# This ensures workspace context is preserved
RUN pnpm --filter @playwright-reports/shared build

# Build frontend
FROM base AS frontend-builder
WORKDIR /app

# Copy the entire workspace structure with node_modules from deps
COPY --from=deps /app/ ./

# Copy the built shared package
COPY --from=shared-builder /app/packages/shared/dist ./packages/shared/dist

# Build frontend using pnpm filter from root
ENV DOCKER_BUILD=true
RUN pnpm --filter @playwright-reports/frontend build:vite

# Build backend
FROM base AS backend-builder
WORKDIR /app

# Copy the entire workspace structure with node_modules from deps
COPY --from=deps /app/ ./

# Copy the built shared package
COPY --from=shared-builder /app/packages/shared/dist ./packages/shared/dist

# Build backend using pnpm filter from root
RUN pnpm --filter @playwright-reports/backend build

# Prune dev dependencies from the entire workspace
# This removes dev dependencies from all workspace packages
RUN pnpm install --prod --frozen-lockfile

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs appuser

# Copy all node_modules from backend-builder (already pruned of dev deps)
COPY --from=backend-builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=backend-builder --chown=appuser:nodejs /app/apps ./apps
COPY --from=backend-builder --chown=appuser:nodejs /app/packages ./packages

# Copy frontend build
COPY --from=frontend-builder --chown=appuser:nodejs /app/apps/frontend/dist ./apps/frontend/dist

# Copy environment configuration (for default values)
COPY --chown=appuser:nodejs .env.example /app/.env.example
COPY --chown=appuser:nodejs package.json ./package.json

# Create empty .env for runtime overrides
RUN touch /app/.env && \
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
