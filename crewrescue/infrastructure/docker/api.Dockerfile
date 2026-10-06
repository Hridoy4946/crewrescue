# ─────────────────────────────────────────────────────────────────────────────
# CrewRescue AI — Backend API Dockerfile (Multi-stage build)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Dependencies & Build ──
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root monorepo manifests
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/api/package.json ./backend/api/

# Install dependencies for workspace
RUN npm ci --workspace=@crewrescue/api --include-workspace-root

# Copy source code
COPY packages/shared ./packages/shared
COPY backend/api ./backend/api

# ── Stage 2: Production Runner ──
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install curl for docker health checks
RUN apk add --no-cache curl

# Create non-root system user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy dependencies and application code
COPY --from=builder /app /app

# Switch to non-root user
USER appuser

EXPOSE 5000

CMD ["node", "backend/api/src/index.js"]
