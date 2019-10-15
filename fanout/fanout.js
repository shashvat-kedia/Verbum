const express = require('express');
const amqp = require('amqplib');
const zookeeper = require('node-zookeeper-client');
const zookeeperClient = zookeeperClient.createClient(config['ZOOKEEPER_URL']);
const config = require('../config.js');
const constants = require('../constants.js');
const app = express();

var publisherChannel = null;
var isConnectedToZookeeper = false;
var servicesRunning = false;

const PORT = 8001 || process.env.PORT

function publisher(amqpConnection) {
  amqpConnection.createChannel(onPublisherStart);
  function onPublisherStart(err, channel) {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    channel.assertQueue(config.FAN_OUT_QUEUE)
    publisherChannel = channel
  }
}

zookeeperClient.on('connected', function() {
  zookeeperClient.exists(config['ZOOKEEPER_NODES_PATH'], function(err, stat) {
    if (err) {
      console.error(err)
      return
    }
    if (stat) {
      isConnectedToZookeeper = true
      servicesRunning = true
      console.log('Connected to zookeeper');
    }
    else {
      servicesRunning = false
    }
  })
})

app.post('/send', function(req, res) {
  if (isConnectedToZookeeper && servicesRunning) {
    //zookeeperClient.get
  }
  else {
    res.status(200).json({
      'status': 'Notification service not running'
    })
  }
})

app.listen(PORT, function() {
  zookeeperClient.connect()
  amqp.connect(config.RMQ_URL, function(err, amqpConnection) {
    if (err) {
      console.error(err)
      return
    }
    consumer(amqpConnection)
  })
  console.log('Fan Out service listening at: ' + PORT)
})