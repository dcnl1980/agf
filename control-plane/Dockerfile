# Control plane — Node + better-sqlite3 (native build) + SQLite on /data
FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY control-plane/package.json control-plane/package-lock.json ./
RUN npm ci --omit=dev
COPY control-plane/src ./src
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "src/index.js"]
