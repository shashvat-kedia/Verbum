FROM maven:3.5-jdk-8-alpine AS build
COPY /eurekaservicediscovery/pom.xml ./pom.xml
RUN mvn dependency:go-offline -B
COPY /eurekaservicediscovery/src ./src
RUN mvn clean install

FROM openjdk:8-jre-alpine
WORKDIR /eurekaservicediscovery
COPY --from=build /target/eureka-service-discovery-1.0-SNAPSHOT.jar /eurekaservicediscovery 
CMD ["java", "-jar", "eureka-service-discovery-1.0-SNAPSHOT.jar"]

MAINTAINER Shashvat Kedia
EXPOSE 8761
