# Duas imagens a partir do mesmo build: `api` (Node) e `web` (Caddy servindo o front e fazendo proxy de /api).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts
COPY tsconfig.base.json ./
COPY packages packages
COPY apps apps
RUN npm run build -w packages/shared && npm run build -w apps/api && npm run build -w apps/web

FROM node:22-alpine AS api
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
# O front não entra nesta imagem; o workspace dele é só um esqueleto para o lockfile continuar válido.
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --ignore-scripts -w apps/api -w packages/shared
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/migrations apps/api/migrations
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/server.js"]

FROM caddy:2-alpine AS web
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
