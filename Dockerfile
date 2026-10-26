FROM node:20-alpine

RUN apk add --no-cache git ffmpeg python3 make g++ vips-dev

WORKDIR /app

COPY package.json ./

RUN npm install --omit=dev --no-audit --no-fund

COPY . .

RUN mkdir -p sessions

ENV NODE_ENV=production

EXPOSE 20338

CMD ["node", "index.js"]