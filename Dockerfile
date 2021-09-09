FROM node:alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY src/ ./src/
COPY webpack.config.js ./

RUN npm run build

FROM nginx:latest

COPY --from=build /usr/src/app/dist /usr/share/nginx/html
COPY data /usr/share/nginx/html/data

# Persistent data volume
VOLUME /usr/share/nginx/html/data

EXPOSE 80


