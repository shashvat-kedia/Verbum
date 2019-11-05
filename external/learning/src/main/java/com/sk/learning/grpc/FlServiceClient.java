package com.sk.learning.grpc;

import javax.annotation.PostConstruct;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;

@Component
public class FlServiceClient {

    private static final Logger LOGGER = LoggerFactory.getLogger(FlServiceClient.class);

    @PostConstruct
    private void init() {
    }

    public Response onTrainingFinished(TrainMetrics trainMetrics, String hostName, int port) {
        ManagedChannel managedChannel = ManagedChannelBuilder.forAddress(hostName, port).usePlaintext().build();
        return TextGenerationServiceGrpc.newBlockingStub(managedChannel).onTrainingFinished(trainMetrics);
    }
}
