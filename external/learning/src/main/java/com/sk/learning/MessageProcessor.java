package com.sk.learning;

import java.io.BufferedInputStream;
import java.io.ObjectInputStream;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.nd4j.linalg.api.ndarray.INDArray;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.netflix.appinfo.InstanceInfo;
import com.netflix.discovery.DiscoveryClient;
import com.sk.learning.grpc.FlServiceClient;
import com.sk.learning.model.LSTMTextGeneration;

@Component
public class MessageProcessor {
    private static final Logger LOGGER = LoggerFactory.getLogger(MessageProcessor.class.getName());

    private final int N_THREADS = Utils.getNoOfCores() + 1;
    private final long DEFAULT_TIMEOUT = 7000;

    private static MessageProcessor messageProcessor;
    private LSTMTextGeneration lstmTextGeneration;
    private ExecutorService executors;
    private ExecutorService downloaders;

    @Autowired
    private DiscoveryClient discoveryClient;
    @Autowired
    private FlServiceClient flServiceClient;

    public static MessageProcessor getInstance() {
        if (messageProcessor == null) {
            synchronized (MessageProcessor.class) {
                if (messageProcessor == null) {
                    messageProcessor = new MessageProcessor();
                }
            }
        }
        return messageProcessor;
    }

    private MessageProcessor() {
        lstmTextGeneration = new LSTMTextGeneration();
        executors = Executors.newFixedThreadPool(N_THREADS);
        downloaders = Executors.newCachedThreadPool();
    }

    public void process(SubscriberPayload payload) throws InterruptedException, ExecutionException {
        if (payload.getGradientPaths().size() != payload.getClientIds().size()) {
            LOGGER.info("Misfire of event from FLS service. Payload: " + payload);
        }
        INDArray sum = null;
        List<String> gradientPaths = payload.getGradientPaths();
        List<Future<INDArray>> gradients = new ArrayList<>();
        for (int i = 0; i < Math.floor(gradientPaths.size() / N_THREADS); i++) {
            List<String> gradientPathsBatch = gradientPaths.subList(i * N_THREADS, Math.min((i + 1) * N_THREADS, gradientPaths.size()));
            gradients.add(executors.submit(getSum(gradientPathsBatch)));
        }
        executors.awaitTermination(DEFAULT_TIMEOUT, TimeUnit.MILLISECONDS);
        for (Future<INDArray> gradient : gradients) {
            if (sum == null) {
                sum = gradient.get();
            } else {
                sum.add(gradient.get());
            }
        }
        sum.div(gradientPaths.size());
        lstmTextGeneration.applyGradients(sum);
        flServiceClient.onTrainingFinished(null, );
    }

    private InstanceInfo selectInstance(String applicationId) {
        List<InstanceInfo> instanceInfos = discoveryClient.getInstancesById(applicationId);
        for (InstanceInfo instanceInfo : instanceInfos) {
        }
    }

    private Future<INDArray> getGradients(String gradientPath) {
        return downloaders.submit(() -> {
            INDArray fetchedGradient;
            BufferedInputStream bis = null;
            ObjectInputStream ois = null;
            try {
                URL url = new URL(gradientPath);
                bis = new BufferedInputStream(url.openStream());
                ois = new ObjectInputStream(bis);
                fetchedGradient = (INDArray) ois.readObject();

            } catch (Exception exception) {
                throw new RuntimeException(exception);
            } finally {
                if (bis != null) {
                    bis.close();
                }
                if (ois != null) {
                    ois.close();
                }
            }
            return fetchedGradient;
        });
    }

    // Recursively execute this to distribute the computation accross payload.gradientPaths() / 2
    private Callable<INDArray> getSum(List<String> gradientPaths) throws InterruptedException, ExecutionException {
        return new Callable<INDArray>() {
            @Override
            public INDArray call() throws Exception {
                for (String gradientPath : gradientPaths) {
                    INDArray array = getGradients(gradientPath).get();
                }
                return null;
            }
        };
    }

}
