FROM node:10
MAINTAINER Shashvat Kedia

WORKDIR /usr/src/fanout
COPY . .
RUN npm install

EXPOSE 8000

CMD ["node", "index.js"]