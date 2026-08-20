FROM node:20-alpine
WORKDIR /app
COPY catalog-api/server.mjs ./
COPY catalog/community-catalog.json /data/community-catalog.json
ENV AGF_CATALOG_JSON=/data/community-catalog.json
ENV PORT=4055
EXPOSE 4055
CMD ["node", "server.mjs"]
