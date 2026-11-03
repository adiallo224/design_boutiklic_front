# ============================================
# BOUTIKLIC Web — Dockerfile Multi-Stage
# Vite + React, servi par Nginx
# Build depuis la racine du repo (workspaces npm : boutiklic-frontend + packages/shared)
# ============================================

# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY boutiklic-frontend/package.json boutiklic-frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

COPY packages/shared packages/shared/
COPY boutiklic-frontend boutiklic-frontend/

RUN npm run build --workspace=boutiklic-frontend

# --- Stage 2: Runtime ---
FROM nginx:1.27-alpine

COPY boutiklic-frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/boutiklic-frontend/dist /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80 || exit 1

EXPOSE 80
