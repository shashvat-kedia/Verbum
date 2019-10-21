const amqp = require('amqplib');
const zookeeper = require('node-zookeeper-client');
const zookeeperClient = zookeeper.createClient('localhost:2181', {
  sessionTimeout: 30000,
  spinDelay: 1000,
  retries: 1
});

var config = null
var publisherChannel = null;
var pendingQueueAssertions = [];
var pendingPublishMessages = [];
var consumerChannel = null;
var isConnectedToZookeeper = false;
var servicesRunning = false;
var nodePaths = [];

const PORT = 6001 || process.env.PORT

function publisher(amqpConnection, nodePaths) {
  amqpConnection.createChannel(onPublisherStart);
  function onPublisherStart(err, channel) {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    createQueueForNodes(nodePaths)
    publisherChannel = channel
    for (queueName in pendingQueueAssertions) {
      publisherChannel.assertQueue(queueName)
    }
    for (pendingMessage in pendingPublishMessages) {
      publisherChannel.sendToQueue(pendingMessage['queueName'], pendingMessage['message'])
    }
    pendingQueueAssertions = []
    pendingPublishMessages = []
  }
}

function consumer(amqpConnection) {
  amqpConnection.createChannel(onComsumerStart);
  function onConsumerStart(err, channel) {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    channel.assertQueue(config['FAN_OUT_QUEUE'])
    channel.consume(config['FAN_OUT_QUEUE'], consume)
    consumerChannel = channel
  }
}

function createQueueForNodes(nodePaths) {
  if (publisherChannel != null) {
    for (var node in nodePaths) {
      publisherChannel.assertQueue(node)
    }
  }
  else {
    Array.prototype.push.apply(pendingQueueAssertions, nodePaths)
  }
}

function getData(client, path, done) {
  client.getData(path, function(event) {
    getData(client, path, done)
  }, function(err, data, stat) {
    if (err) {
      console.error(err)
      return
    }
    if (stat) {
      done(data.toString('utf8'))
    }
    else {
      done(null)
    }
  })
}

function getChildren(client, path, done) {
  client.getChildren(path, function(event) {
    getChilden(client, path, done)
  }, function(err, children) {
    if (err) {
      console.error(err)
      return
    }
    done(children)
  })
}

zookeeperClient.on('connected', function() {
  if (config == null) {
    zookeeperClient.exists('/config', function(err, stat) {
      if (err) {
        console.error(err)
        return
      }
      if (stat) {
        isConnectedToZookeeper = true
        servicesRunning = true
        console.log('Connected to zookeeper');
        getData(zookeeperClient, '/config', function(data) {
          config = JSON.parse(data)
          console.log(config)
          amqp.connect(config.RMQ_URL, function(err, amqpConnection) {
            if (err) {
              console.error(err)
              return
            }
            consumer(amqpConnection)
          })
          getChildren(zookeeperClient, config['ZOOKEEPER_NODES_PATH'], function(updatedNodePaths) {
            newNodePaths = []
            for (var node in updatedNodePaths) {
              if (!nodePaths.includes(node)) {
                newNodePaths.push(node)
              }
            }
            nodePaths = []
            Array.prototype.push(nodePaths, data.split(','))
            createQueueForNodes(newNodePaths)
          })
        })
      }
      else {
        process.exit(1)
      }
    })
  }
})

zookeeperClient.on('disconnected', function() {
  isConnectedToZookeeper = false
})

function consume(message) {
  if (isConnectedToZookeeper && servicesRunning) {
    for (var node in nodesPath) {
      if (publisherChannel != null) {
        publisherChannel.sendToQueue(node, Buffer.from(JSON.stringify(message.content.toString('utf8'))))
      }
      else {
        pendingPublishMessage.push({
          'queueName': node,
          'message': Buffer.from(JSON.stringify(message.content.toString('utf8')))
        })
      }
    }
    consumerChannel.ack(message)
  }
  else {
    consumerChannel.nack(message)
  }
}

zookeeperClient.connect()