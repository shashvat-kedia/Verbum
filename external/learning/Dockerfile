FROM maven:3.5-jdk-8-alpine AS build
COPY ./pom.xml ./pom.xml
RUN mvn dependency:go-offline -B
COPY ./src ./src
RUN mvn clean install

FROM openjdk:8-jre-alpine
WORKDIR /learning
COPY --from=build /learning/target/original-learning-1.0-SNAPSHOT.jar /learning
CMD ["java", "-jar", "original-learning-1.0-SNAPSHOT.jar"]

MAINTAINER Shashvat Kedia
EXPOSE 8882