FROM maven:3.5-jdk-8-alpine AS build
COPY ./pom.xml ./pom.xml
RUN mvn dependency:go-offline -B
COPY ./src ./src
RUN mvn clean install

FROM openjdk:8-jre-alpine
WORKDIR /zuul
COPY --from=build /zuul/target/zuul-load-balancer-1.0-SNAPSHOT.jar /zuul
CMD ["java", "-jar", "zuul-load-balancer-1.0-SNAPSHOT.jar"]

MAINTAINER Shashvat Kedia
EXPOSE 8050