FROM node:21.6.1 AS build

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm config set fetch-retry-maxtimeout 6000000
RUN npm config set fetch-retry-mintimeout 1000000
RUN NODE_OPTIONS="--max_old_space_size=2048" npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM nginx:1.27.0-alpine
COPY --from=build /usr/src/app/build /usr/share/nginx/html
COPY --from=build /usr/src/app/nginx-custom.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]

