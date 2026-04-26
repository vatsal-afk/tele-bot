# ---- Build stage ----
FROM node:20-slim AS builder

WORKDIR /app

# Install build deps for better-sqlite3 (native C++ module)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ---- Production stage ----
FROM node:20-slim AS runner

WORKDIR /app

# Runtime deps for better-sqlite3
RUN apt-get update && apt-get install -y \
    libsqlite3-0 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY src/data ./src/data

# Persist DB outside container layers
VOLUME ["/data"]

ENV DB_PATH=/data/data.db
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
