FROM java:8
MAINTAINER Shashvat Kedia

EXPOSE 8761
ADD ./eurekaservicediscovery/target/original-EurekaServiceDiscovery-uber.jar original-EurekaServiceDiscovery-uber.jar
ENTRYPOINT ["java", "-jar", "original-EurekaServiceDiscovery-uber.jar"]
