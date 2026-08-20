# Build from repository root so `../catalog` in vite.config resolves next to `website/`
# (same layout as local dev). Example: docker compose build website
FROM node:20-alpine AS build
WORKDIR /build/website
COPY website/package*.json ./
RUN npm ci
COPY website/ ./
COPY catalog /build/catalog
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine
COPY --from=build /build/website/dist /usr/share/nginx/html
COPY website/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
