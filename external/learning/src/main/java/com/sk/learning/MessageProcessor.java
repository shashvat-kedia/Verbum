package com.sk.learning;

import java.util.ArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.sk.learning.model.LSTMTextGeneration;

public class MessageProcessor {
    private static final Logger LOGGER = LoggerFactory.getLogger(MessageProcessor.class.getName());

    private final int N_THREADS = 2;

    private static MessageProcessor messageProcessor;
    private LSTMTextGeneration lstmTextGeneration;

    public static MessageProcessor getInstance() {
        if (messageProcessor == null) {
            synchronized(MessageProcessor.class) {
                if (messageProcessor == null) {
                    messageProcessor = new MessageProcessor();
                }
            }
        }
        return messageProcessor;
    }

    private MessageProcessor() {
        lstmTextGeneration = new LSTMTextGeneration();
    }

    public void process(SubscriberPayload payload) {
        if (payload.getGradientPaths().size() != payload.getClientIds().size()) {
            LOGGER.info("Misfire of event from FLS service. Payload: " + payload);
        }
        ArrayList<String> gradientPaths = payload.getGradientPaths();
        ExecutorService executors = Executors.newFixedThreadPool(N_THREADS);
        ArrayList<String> firstBatch = new ArrayList<String>();
        ArrayList<String> secondBatch = new ArrayList<String>();
        String leftout;
        if (gradientPaths.size() % 2 == 0) {
            firstBatch.addAll(gradientPaths.subList(0, gradientPaths.size() / 2));
            secondBatch.addAll(gradientPaths.subList(gradientPaths.size() / 2, gradientPaths.size()));
        }
        else {
            firstBatch.addAll(gradientPaths.subList(0, gradientPaths.size() / 2));
            secondBatch.addAll(gradientPaths.subList(gradientPaths.size() / 2, gradientPaths.size() - 1));
            leftout = gradientPaths.get(gradientPaths.size() - 1);
        }

    }

}
