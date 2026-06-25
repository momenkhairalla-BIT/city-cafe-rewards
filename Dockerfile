# Optional Docker deploy (Fly.io, Railway, VPS)
# Build from repo root: docker build -t city-cafe-rewards .
# Run: docker run -p 3001:3001 --env-file production/api/.env city-cafe-rewards

FROM node:20-alpine

WORKDIR /app

# Copy API package files
COPY production/api/package*.json ./production/api/
RUN cd production/api && npm ci --omit=dev

# Copy full app (API serves index.html + js from repo root)
COPY production/api ./production/api
COPY index.html ./index.html
COPY js ./js

WORKDIR /app/production/api

ENV NODE_ENV=production
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "src/index.js"]
