FROM maven:3.5-jdk-8-alpine AS build
WORKDIR /learning
COPY . /learning
RUN mvn clean install

FROM openjdk:8-jre-alpine
WORKDIR /learning
COPY --from=build /learning/target/original-learning-1.0-SNAPSHOT.jar /learning 

MAINTAINER Shashvat Kedia
EXPOSE 8882
