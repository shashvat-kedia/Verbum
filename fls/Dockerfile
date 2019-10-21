FROM node:10
MAINTAINER Shashvat Kedia

WORKDIR /usr/src/fanout
COPY . .
RUN npm install

EXPOSE 8030

CMD ["node", "fls.js"]