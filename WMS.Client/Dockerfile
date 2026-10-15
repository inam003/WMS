# Build context: A:\WMS\WMS.Client
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# VITE_ values are compiled into the public JS bundle. Never pass secrets here.
ARG VITE_API_BASE_URL
ARG VITE_NEON_AUTH_URL
ARG VITE_NEON_DATA_API_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_NEON_AUTH_URL=$VITE_NEON_AUTH_URL \
    VITE_NEON_DATA_API_URL=$VITE_NEON_DATA_API_URL
RUN test -n "$VITE_API_BASE_URL" && test -n "$VITE_NEON_AUTH_URL" \
    || (echo "Build args VITE_API_BASE_URL and VITE_NEON_AUTH_URL are required" && exit 1)
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine AS final
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
