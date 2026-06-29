FROM node:20-alpine AS build

WORKDIR /app

# install python and build-essential for node-gyp
RUN apk add --no-cache python3 make g++

COPY package*.json .npmrc .env /app/

RUN npm install --force && npm i -g ts-node

COPY . /app

RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/.env ./.env
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

CMD ["node", "./dist/index.js"]