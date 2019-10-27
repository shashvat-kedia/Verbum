package com.sk.learning.zookeeper;

import java.io.IOException;
import java.nio.file.WatchEvent;
import java.util.concurrent.CountDownLatch;

import org.apache.zookeeper.WatchedEvent;
import org.apache.zookeeper.Watcher;
import org.apache.zookeeper.ZooKeeper;

public class ZKConnection {

    private ZooKeeper zookeper;
    CountDownLatch connectionLatch = new CountDownLatch(1);

    public ZooKeeper connect(String host) throws IOException, InterruptedException {
       this.zookeper = new ZooKeeper(host, 2181, new Watcher() {
           @Override
           public void process(WatchedEvent watchedEvent) {
               if (watchedEvent.getState() == Event.KeeperState.SyncConnected) {
                   connectionLatch.countDown();
               }
           }
       });
       connectionLatch.await();
       return zookeper;
    }

    public void close() throws InterruptedException {
        if (zookeper != null) {
            zookeper.close();
        }
    }
}
