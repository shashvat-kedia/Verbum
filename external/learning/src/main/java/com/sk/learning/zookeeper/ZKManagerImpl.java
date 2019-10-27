package com.sk.learning.zookeeper;

import java.io.UnsupportedEncodingException;

import org.apache.zookeeper.CreateMode;
import org.apache.zookeeper.KeeperException;
import org.apache.zookeeper.ZooDefs;
import org.apache.zookeeper.ZooKeeper;

public class ZKManagerImpl implements ZKManager {
    private static ZooKeeper zooKeeper;
    private static ZKConnection zkConnection;

    public ZKManagerImpl(String host) {
        zkConnection = new ZKConnection();
        zooKeeper = zkConnection.connect(host);
    }

    public void close() throws InterruptedException {
        zkConnection.close();
    }

    @Override
    public int getVersion(String path) {
        if (zooKeeper != null) {
            return zooKeeper.exists(path, true).getVersion();
        }
        return -1;
    }

    @Override
    public void create(String path, byte[] data) throws KeeperException, InterruptedException {
        if (zooKeeper != null) {
            zooKeeper.create(path, data, ZooDefs.Ids.OPEN_ACL_UNSAFE, CreateMode.PERSISTENT);
        }
    }

    @Override
    public Object getZNodeData(String path, boolean watchFlag) throws UnsupportedEncodingException {
        if (zooKeeper != null) {
            byte[] b = null;
            b = zooKeeper.getData(path, null, null);
            return new String(b, "UTF-8");
        }
        return null;
    }

    @Override
    public void update(String path, byte[] data) throws KeeperException, InterruptedException {
        if (zooKeeper != null) {
            zooKeeper.setData(path, data, getVersion(path));
        }
    }

    @Override
    public void delete(String path) throws KeeperException, InterruptedException {
        if (zooKeeper != null) {
            zooKeeper.delete(path, getVersion(path));
        }
    }
}
