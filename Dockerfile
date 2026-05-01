FROM node:20-alpine
WORKDIR /app
COPY server.js .
COPY index.html .
COPY logo-tocoin.png .
EXPOSE 8080
CMD ["node", "server.js"]
