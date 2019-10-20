const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const q = require('q');
const grpc = require('grpc');
const amqp = require('amqplib');
const zookeeper = require('node-zookeeper-client');
const zookeeperClient = zookeeperClient.createClient('localhost:2181', {
  sessionTimeout: 30000,
  spinDelay: 1000,
  retries: 1
});
const config = null;
const app = express()

const PORT = 8080 || process.env.PORT

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(cors())

var publisherChannel = null;
var isConnectedToZookeeper = false;

function startPublisher(amqpConnection) {
  amqpConnection.createChannel(onPublisherStart);
  function onPublisherStart(err, channel) {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    createQueueForNodes(nodePaths)
    publisherChannel = channel
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

function startAMQP() {
  amqp.connect(config['RMQ_URL'], function(err, amqpConnection) {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    startPublisher(amqpConnection)
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
        console.log('Connected to Zookeeper')
        getData(zookeeperClient, './config', function(data) {
          console.loog('Config obtained from Zookeeper')
          config = JSON.parse(data)
          startAMQP()
        })
      }
      else {
        // No config present
        process.exit(1)
      }
    })
  }
})

app.get('/train/:modelId/:minClients', function(req, res) {

})

app.listen(PORT, function() {
  console.log("FLS service listening on: " + PORT)
  zookeeper.connect()
})