FROM maven:3.5-jdk-8-alpine AS build
COPY ./pom.xml ./pom.xml
RUN mvn dependency:go-offline -B
COPY ./src ./src
RUN mvn package

FROM openjdk:8-jre-alpine
WORKDIR /eurekaservicediscovery
COPY --from=build /target/original-EurekaServiceDiscovery-uber.jar /eurekaservicediscovery 
CMD ["java", "-jar", "original-EurekaServiceDiscovery-uber.jar"]

MAINTAINER Shashvat Kedia
EXPOSE 8761
