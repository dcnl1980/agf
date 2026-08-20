# Control plane — Node + better-sqlite3 (native build) + SQLite on /data
FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --gid 1000 agf \
  && useradd --uid 1000 --gid agf --shell /usr/sbin/nologin --create-home agf \
  && mkdir -p /data \
  && chown -R agf:agf /data
WORKDIR /app
COPY control-plane/package.json control-plane/package-lock.json ./
RUN npm ci --omit=dev && chown -R agf:agf /app
COPY --chown=agf:agf control-plane/src ./src
ENV NODE_ENV=production
ENV CONTROL_PLANE_DATA=/data
USER agf
EXPOSE 4000
CMD ["node", "src/index.js"]
