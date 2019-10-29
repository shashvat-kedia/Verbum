FROM maven:3.5-jdk-8-alpine AS build
WORKDIR /eurekaservicediscovery
COPY . /eurekaservicediscovery
RUN mvn clean install

FROM openjdk:8-jre-alpine
WORKDIR /eurekaservicediscovery
COPY --from=build /eurekaservicediscovery/target/original-EurekaServiceDiscovery-uber.jar /eurekaservicediscovery 
CMD ["java", "-jar", "original-EurekaServiceDiscovery-uber.jar"]

MAINTAINER Shashvat Kedia
EXPOSE 8761
