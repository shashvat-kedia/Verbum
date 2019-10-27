package com.sk.learning;

import java.io.Serializable;
import java.util.ArrayList;

public class SubscriberPayload implements Serializable {

    private static final long serialVersionUID = -8388379339067957384L;
    private ArrayList<String> gradientPaths;
    private ArrayList<String> clientIds;
    private Long createdAt;

    public SubscriberPayload(){
    }

    public SubscriberPayload(ArrayList<String> gradientPaths, ArrayList<String> clientIds, Long createdAt) {
        this.gradientPaths = gradientPaths;
        this.clientIds = clientIds;
        this.createdAt = createdAt;
    }


    public ArrayList<String> getGradientPaths() {
        return gradientPaths;
    }

    public void setGradientPaths(ArrayList<String> gradientPaths) {
        this.gradientPaths = gradientPaths;
    }

    public ArrayList<String> getClientIds() {
        return clientIds;
    }

    public void setClientIds(ArrayList<String> clientIds) {
        this.clientIds = clientIds;
    }

    public Long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Long createdAt) {
        this.createdAt = createdAt;
    }
}
