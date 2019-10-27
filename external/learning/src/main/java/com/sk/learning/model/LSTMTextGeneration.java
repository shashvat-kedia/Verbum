package com.sk.learning.model;

import java.io.FileInputStream;

import org.apache.commons.io.IOUtils;
import org.deeplearning4j.nn.api.OptimizationAlgorithm;
import org.deeplearning4j.nn.conf.MultiLayerConfiguration;
import org.deeplearning4j.nn.conf.NeuralNetConfiguration;
import org.deeplearning4j.nn.conf.Updater;
import org.deeplearning4j.nn.conf.layers.GravesLSTM;
import org.deeplearning4j.nn.conf.layers.RnnOutputLayer;
import org.deeplearning4j.nn.multilayer.MultiLayerNetwork;
import org.deeplearning4j.nn.weights.WeightInit;
import org.nd4j.linalg.activations.Activation;
import org.nd4j.linalg.api.ndarray.INDArray;
import org.nd4j.linalg.dataset.DataSet;
import org.nd4j.linalg.factory.Nd4j;
import org.nd4j.linalg.lossfunctions.LossFunctions;

public class LSTMTextGeneration {
    public static void main(String[] args) throws Exception{
//        int nchars = 20000;
//        String inputData = IOUtils.toString(new FileInputStream("sample.txt"), "UTF-8");
//        inputData = inputData.substring(0, nchars);
//        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890\"\n',.?;()[]{}:!- ";
//
//        GravesLSTM.Builder lstmBuilder = new GravesLSTM.Builder();
//        lstmBuilder.nIn(chars.length());
//        lstmBuilder.nOut(30);
//        lstmBuilder.activation(Activation.TANH);
//        GravesLSTM inputLayer = lstmBuilder.build();
//
//        RnnOutputLayer.Builder outputBuilder = new RnnOutputLayer.Builder();
//        outputBuilder.lossFunction(LossFunctions.LossFunction.MSE);
//        outputBuilder.activation(Activation.SOFTMAX);
//        outputBuilder.nIn(30); // Hidden
//        outputBuilder.nOut(chars.length());
//        RnnOutputLayer outputLayer = outputBuilder.build();
//
//        MultiLayerConfiguration.Builder nnBuilder = new NeuralNetConfiguration.Builder();
//        nnBuilder.optimizationAlgo(OptimizationAlgorithm.STOCHASTIC_GRADIENT_DESCENT);
//        nnBuilder.updater(Updater.ADAM);
//        nnBuilder.weightInit(WeightInit.XAVIER);
//        nnBuilder.learningRate(0.01);
//        nnBuilder.miniBatch(true);
//
//        MultiLayerNetwork network = new MultiLayerNetwork(
//            nnBuilder.list().layer(0, inputLayer)
//                .layer(1, outputLayer)
//                .backprop(true).pretrain(false)
//                .build());
//
//        network.init();
//
//        INDArray inputArray = Nd4j.zeros(1, inputLayer.getNIn(), inputData.length());
//        INDArray inputLabels = Nd4j.zeros(1, outputLayer.getNOut(), inputData.length());
//
//        for(int i=0;i<inputData.length() - 1;i++) {
//            int positionInValidCharacters1 = chars.indexOf(inputData.charAt(i));
//            inputArray.putScalar(new int[]{0, positionInValidCharacters1, i}, 1);
//
//            int positionInValidCharacters2 = chars.indexOf(inputData.charAt(i+1));
//            inputLabels.putScalar(new int[]{0, positionInValidCharacters2, i}, 1);
//        }
//
//        DataSet dataSet = new DataSet(inputArray, inputLabels);
//        for(int z=0;z<1000;z++) {
//            network.fit(dataSet);
//
//            INDArray testInputArray = Nd4j.zeros(inputLayer.getNIn());
//            testInputArray.putScalar(0, 1);
//
//            network.rnnClearPreviousState();
//            String output = "";
//            for (int k = 0; k < 200; k++) {
//                INDArray outputArray = network.rnnTimeStep(testInputArray);
//                double maxPrediction = Double.MIN_VALUE;
//                int maxPredictionIndex = -1;
//                for (int i = 0; i < chars.length(); i++) {
//                    if (maxPrediction < outputArray.getDouble(i)) {
//                        maxPrediction = outputArray.getDouble(i);
//                        maxPredictionIndex = i;
//                    }
//                }
//                // Concatenate generated character
//                output += chars.charAt(maxPredictionIndex);
//                testInputArray = Nd4j.zeros(inputLayer.getNIn());
//                testInputArray.putScalar(maxPredictionIndex, 1);
//            }
//            System.out.println(z + " > A" + output + "\n----------\n");
//        }
    }
}
