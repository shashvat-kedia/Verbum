package com.sk.learning.zookeeper;

import java.io.UnsupportedEncodingException;

import org.apache.zookeeper.KeeperException;

public interface ZKManager {

    public int getVersion(String path) throws KeeperException, InterruptedException;
    public void create(String path, byte[] data) throws KeeperException, InterruptedException;
    public Object getZNodeData(String path, boolean watchFlag) throws UnsupportedEncodingException, KeeperException, InterruptedException;
    public void update(String path, byte[] data) throws KeeperException, InterruptedException;
    public void delete(String path) throws KeeperException, InterruptedException;
}
