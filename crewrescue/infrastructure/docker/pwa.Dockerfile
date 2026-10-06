# ─────────────────────────────────────────────────────────────────────────────
# CrewRescue AI — Field Technician PWA Dockerfile (Multi-stage build)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build static bundle ──
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root monorepo manifests
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY frontend/pwa/package.json ./frontend/pwa/

# Install dependencies
RUN npm ci --workspace=pwa --include-workspace-root

# Copy PWA source and shared package
COPY packages/shared ./packages/shared
COPY frontend/pwa ./frontend/pwa

# Build static production bundle with service worker
RUN npm run build --workspace=pwa

# ── Stage 2: Production Nginx Server ──
FROM nginx:alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built PWA assets from builder stage
COPY --from=builder /app/frontend/pwa/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY infrastructure/docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
