# ==============================================================================
# HAMPERS BY HER — PRODUCTION MULTI-STAGE DOCKERFILE
# Node.js 22 Alpine | Non-Root Unprivileged Execution | Minimal Attack Surface
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Base & Dependencies Cache
# ------------------------------------------------------------------------------
FROM node:22-alpine AS dependencies

WORKDIR /usr/src/app

# Install native dependencies required for build if necessary
RUN apk add --no-cache libc6-compat

# Copy package manifests
COPY package.json package-lock.json* ./

# Install production dependencies only with clean reproducible cache
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# ------------------------------------------------------------------------------
# Stage 2: Builder & Quality Verification
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Copy all node modules including dev dependencies for testing
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy full application codebase
COPY . .

# Run architecture audit and automated unit tests during build
ENV NODE_ENV=test
RUN npm run audit:docs && \
    npm test

# ------------------------------------------------------------------------------
# Stage 3: Production Hardened Runtime
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

LABEL maintainer="Hampers by Her Engineering <engineering@hampersbyher.com>"
LABEL org.opencontainers.image.title="Hampers by Her Digital Commerce Platform"
LABEL org.opencontainers.image.description="Luxury artisanal gifting atelier digital operating system"
LABEL org.opencontainers.image.version="2.0.0"
LABEL org.opencontainers.image.licenses="Proprietary"

WORKDIR /usr/src/app

# Security: Install dumb-init for proper PID 1 signal trapping and curl for health probes
RUN apk add --no-cache dumb-init curl && \
    rm -rf /var/cache/apk/*

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy production node_modules from dependencies stage
COPY --from=dependencies --chown=node:node /usr/src/app/node_modules ./node_modules

# Copy application source code with unprivileged ownership
COPY --chown=node:node package.json ./
COPY --chown=node:node server ./server
COPY --chown=node:node platform ./platform
COPY --chown=node:node website ./website
COPY --chown=node:node data ./data
COPY --chown=node:node docs ./docs
COPY --chown=node:node dist ./dist

# Create runtime directories for logs and persistent stores with proper permissions
RUN mkdir -p /usr/src/app/logs /usr/src/app/data && \
    chown -R node:node /usr/src/app

# Security: Enforce dedicated unprivileged user
USER node

# Expose standard application port
EXPOSE 3000

# Container Healthcheck probe
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Execute application wrapped in dumb-init for graceful SIGTERM/SIGINT teardown
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server/index.js"]
