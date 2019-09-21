const amqp = require('amqplib');
const zookeeper = require('node-zookeeper-client');
const zookeeperClient = zookeeperClient.createClient(config['ZOOKEEPER_URL']);
const config = require('./config.js');
const constants = require('./constants.js');

var publisherChannel = null;
var consumerConnections = {}

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

function consumer(amqpConnection) {
  amqpConnection.createChannel(onConsumerStart)
  function onConsumerStart(err, channel) {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    channel.assertQueue()
  }
}

amqp.connect(config.RMQ_URL, function(err, amqpConnection) {
  if (err) {
    console.error(err)
    return
  }
  publisher(amqpConnection)
  consumer(amqpConnection)
})