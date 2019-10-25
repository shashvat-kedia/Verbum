package com.sk.learning;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.SerializationUtils;

import com.rabbitmq.client.AMQP;
import com.rabbitmq.client.Envelope;
import com.rabbitmq.client.ShutdownSignalException;

public class Consumer extends RabbitMQEndpoint implements Runnable, com.rabbitmq.client.Consumer {
    private static final Logger LOGGER = LoggerFactory.getLogger(Consumer.class.getName());

    public Consumer(String endPointName) throws IOException {
        super(endPointName);
    }

    @Override
    public void handleConsumeOk(String s) {
    }

    @Override
    public void handleCancelOk(String s) {
    }

    @Override
    public void handleCancel(String s) throws IOException {
    }

    @Override
    public void handleShutdownSignal(String s, ShutdownSignalException e) {
    }

    @Override
    public void handleRecoverOk(String s) {
    }

    @Override
    public void handleDelivery(String s, Envelope envelope, AMQP.BasicProperties basicProperties, byte[] bytes) throws IOException {
        Map map = (HashMap) SerializationUtils.deserialize(bytes);
        // Call consumer function here
    }

    @Override
    public void run() {
        try {
            channel.basicConsume(endPointName, true, this);
        }
        catch (IOException exception) {
            LOGGER.error("Exception: " + exception.getMessage());
        }
    }
}
