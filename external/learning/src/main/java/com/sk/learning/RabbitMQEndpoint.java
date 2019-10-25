package com.sk.learning;

import java.io.IOException;

import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;

public abstract class RabbitMQEndpoint {

    protected Channel channel;
    protected Connection connection;
    protected String endPointName;

    public RabbitMQEndpoint(String endPointName) throws IOException {
        this.endPointName = endPointName;
        ConnectionFactory factory = new ConnectionFactory();
        factory.setHost("localhost");
        connection = factory.newConnection();
        channel = connection.createChannel();
        channel.queueDeclare(endPointName, false, false, false, null);
    }

    public void close() throws IOException {
        this.channel.close();
        this.connection.close();
    }
}
