FROM java:8
MAINTAINER Shashvat Kedia

EXPOSE 8761
ADD ./eurekaservicediscovery/target/EurekaServiceDiscovery-uber.jar EurekaServiceDiscovery-uber.jar
ENTRYPOINT ["java", "-jar", "EurekaServiceDiscovery-uber.jar"]
