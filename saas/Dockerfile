# Smart CA React frontend — multi-stage production image
# Builder: Node matching local verification (Node 22). Runtime: nginx unprivileged on :8080.
# Build-time VITE_API_BASE_URL=/api/v1 → same-origin requests; nginx proxies /api/ to Go service "api".

# ---------- builder ----------
FROM node:22.20.0-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY index.html ./
COPY public/ ./public/
COPY src/ ./src/
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts ./

ARG VITE_API_BASE_URL=/api/v1
ARG VITE_APP_NAME=Smart CA
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_APP_NAME=${VITE_APP_NAME}

RUN npm run build

# ---------- runtime ----------
FROM nginxinc/nginx-unprivileged:1.27.4-alpine

# Default unprivileged listen port is 8080
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

# Image includes wget; Compose HEALTHCHECK uses it against /health
USER nginx

CMD ["nginx", "-g", "daemon off;"]
