# Multi-stage — TAREFA 0.4 (PROMPT_FABRICA_KICKOFF.md)
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache wget
COPY package.json package-lock.json ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY db/migrations ./db/migrations
ENV NODE_ENV=production
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s \
  CMD wget -qO- http://localhost:3333/health/ready || exit 1
CMD ["node", "dist/server.js"]
