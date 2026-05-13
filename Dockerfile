FROM node:20-alpine
WORKDIR /app
COPY server.js .
COPY prompt.js .
COPY index.html .
COPY admin.html .
COPY logo-tocoin.png .
EXPOSE 8080
CMD ["node", "server.js"]
 
