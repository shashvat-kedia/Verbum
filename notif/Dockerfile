FROM node:10
MAINTAINER Shashvat Kedia

WORKDIR /usr/src/notif
COPY . .
RUN npm install

EXPOSE 8000
EXPOSE 8001

CMD ["node", "index.js"]