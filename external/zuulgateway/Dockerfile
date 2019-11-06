FROM maven:3.5-jdk-8-alpine AS build
COPY ./pom.xml ./pom.xml
RUN mvn dependency:go-offline -B
COPY ./src ./src
RUN mvn package

FROM openjdk:8-jre-alpine
WORKDIR /zuulgateway
COPY --from=build /zuulgateway/target/original-zuulgateway-1.0-SNAPSHOT.jar /zuulgateway
CMD ["java", "-jar", "original-zuulgateway-1.0-SNAPSHOT.jar"]

MAINTAINER Shashvat Kedia
EXPOSE 8882
