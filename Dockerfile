# Imagen única: compila cliente + servidor y sirve todo desde Node (HTTP + WebSocket en el mismo puerto).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci
COPY shared shared
COPY client client
COPY server server
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080
# Solo las dependencias que el bundle del servidor deja externas (el resto ya está empaquetado en dist/index.js).
RUN npm init -y >/dev/null && npm install --omit=dev ws@^8 chess.js@^1
COPY --from=build /app/client/dist client/dist
COPY --from=build /app/server/dist server/dist
EXPOSE 8080
CMD ["node", "server/dist/index.js"]
