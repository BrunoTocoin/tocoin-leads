FROM node:20-alpine
RUN apk add --no-cache python3 make g++ pkgconfig pixman-dev cairo-dev pango-dev libjpeg-turbo-dev giflib-dev
WORKDIR /app
COPY package.json .
RUN npm install
COPY server.js .
COPY index.html .
COPY logo-tocoin.png .
EXPOSE 8080
CMD ["node", "server.js"]
 
