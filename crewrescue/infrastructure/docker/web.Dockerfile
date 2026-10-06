# ─────────────────────────────────────────────────────────────────────────────
# CrewRescue AI — Frontend Web App Dockerfile (Multi-stage build)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build static bundle ──
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root monorepo manifests
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY frontend/web/package.json ./frontend/web/

# Install dependencies
RUN npm ci --workspace=web --include-workspace-root

# Copy frontend source and shared package
COPY packages/shared ./packages/shared
COPY frontend/web ./frontend/web

# Build static production bundle
RUN npm run build --workspace=web

# ── Stage 2: Production Nginx Server ──
FROM nginx:alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built frontend assets from builder stage
COPY --from=builder /app/frontend/web/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY infrastructure/docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
