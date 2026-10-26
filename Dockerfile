# Dockerfile — Node 20 alpine + ffmpeg (requis par fluent-ffmpeg / wa-sticker-formatter)
FROM node:20-alpine

RUN apk add --no-cache ffmpeg python3 make g++ vips-dev

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

# Source de vérité : le dossier sessions/ doit être monté en volume (voir docker-compose.yml)
RUN mkdir -p sessions

ENV NODE_ENV=production
EXPOSE 20338

CMD ["node", "index.js"]
