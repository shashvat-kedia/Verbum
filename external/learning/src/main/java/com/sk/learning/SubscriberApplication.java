package com.sk.learning;

import java.util.concurrent.ExecutionException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.gcp.pubsub.core.PubSubTemplate;
import org.springframework.cloud.gcp.pubsub.integration.AckMode;
import org.springframework.cloud.gcp.pubsub.integration.inbound.PubSubInboundChannelAdapter;
import org.springframework.cloud.gcp.pubsub.support.BasicAcknowledgeablePubsubMessage;
import org.springframework.cloud.gcp.pubsub.support.GcpPubSubHeaders;
import org.springframework.context.annotation.Bean;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.handler.annotation.Header;

@EnableDiscoveryClient
@SpringBootApplication
public class SubscriberApplication {
    private static final Logger LOGGER = LoggerFactory.getLogger(SubscriberApplication.class.getName());
    private final MessageProcessor messageProcessor = MessageProcessor.getInstance();

    public static void main(String[] args) {
       // SpringApplication.run(SubscriberApplication.class, args);
    }

    @Bean
    public PubSubInboundChannelAdapter messageChannelAdapter(
            @Qualifier("learning") MessageChannel inputChannel,
            PubSubTemplate pubSubTemplate) {
        // To be changed with instance-id of the service instance
        PubSubInboundChannelAdapter adapter = new PubSubInboundChannelAdapter(pubSubTemplate, "sub-1");
        adapter.setOutputChannel(inputChannel);
        adapter.setAckMode(AckMode.MANUAL);
        adapter.setPayloadType(SubscriberPayload.class);
        return adapter;
    }

    @ServiceActivator(inputChannel = "learning")
    public void subscriber(SubscriberPayload payload,
                           @Header(GcpPubSubHeaders.ORIGINAL_MESSAGE)BasicAcknowledgeablePubsubMessage message)
            throws InterruptedException, ExecutionException {
        LOGGER.info("Message received!");
        if (messageProcessor != null) {
            messageProcessor.process(payload);
        }
        message.ack();
    }
}
