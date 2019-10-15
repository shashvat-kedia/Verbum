const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const server = require('http').createServer();
const io = require('socket.io')(server);
const uuid = require('uuid/v3');
const fs = require('fs');
const getMac = require('getMac');
const zookeeper = require('node-zookeeper-client');
const constants = require('./constants.js');
const config = require('./config.js');
const zookeeperClient = zookeeper.createClient(config['ZOOKEEPER_URL'], {
  sessionTimeout: 30000,
  spinDelay: 1000,
  retries: 1
});
const amqp = require('amqplib');
const grpc = reequire('grpc');
const app = express();

const grpcServer = new grpc.Server()
const notificationProto = grpc.load('../notification.proto')

const PORT = 8000 || process.env.PORT

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(cors())

openConnections = {}
isZookeeperConnected = false
nodeId = null

grpcServer.addService(notificationProto.NotificationService.service, {
  Send(call, callback) {
    messageJSON = JSON.parse(call.request.message)
    clientIds = call.request.clientIds
    failedClientsIds = []
    for (var i = 0; i < clientIds.length; i++) {
      if (openConnections[clientIds[i]] != null) {
        openConnections[clientIds[i]].emit(config['NOTIFICATION_CHANNEL'], messageJSON)
      }
      else {
        failedClientIds.push(clientIds[i])
      }
    }
  }
})

zookeeperClient.on('connected', function() {
  zookeeperClient.exists(config['ZOOKEEPER_NODES_PATH'], function(err, stat) {
    if (err) {
      console.error(err)
      return
    }
    if (stat) {
      isZookeeperConnected = true
      console.log('Connected to zookeeper')
    }
    else {
      zookeeperClient.mkdirp(config['ZOOKEEPER_NODES_PATH'], function(err, path) {
        if (err) {
          console.error(err)
          return
        }
        console.log('Zookeeper node created at: ' + path)
        isZookeeperConnected = true
        console.log('Connected to zookeeper')
      })
    }
  })
})

function cleanup(options, exitCode) {
  if (nodeId != null) {
    zookeeper.remove(config['ZOOKEEPER_NODES_PATH'] + '/' + nodeId, -1, function(err) {
      if (err) {
        console.error(err)
        return
      }
      console.log('Service instance zookeeper node removed.')
    })
  }
}

zookeeperClient.on('disconnected', function() {
  isZookeeperConnected = false
  console.log('Discoonnected from zookeeper')
})

function consumer(amqpConnection) {
  fs.access(constants['NODE_NAME_FILE_PATH'], fs.F_OK, (err) => {
    if (err) {
      console.error(err)
      getMac.getMac(function(err, macAddress) {
        if (err) {
          console.error(err)
          return
        }
        nodeId = uuid(macAddress, constants['UUID_NAMESPACE'])
        updateZookeeper(nodeId)
        setupConsumer(amqpConnection, nodeName)
      })
    }
    else {
      fs.readFile(constants['NODE_NAME_FILE_PATH'], function(err, data) {
        if (err) {
          console.error(err)
        }
        nodeId = data
        updateZookeeper(nodeId)
        setupConsumer(amqpConnection, nodeId)
      })
    }
  })
}

function updateZookeeper(nodeName) {
  var nodePath = config['ZOOKEEPER_NODES_PATH'] + '/' + nodeName
  zookeeperClient.create(nodePath, Buffer.from(nodeName), function(err, path) {
    if (err) {
      console.error(err)
      return
    }
    console.log('Zookeeper node created for service instance at: ' + path)
  })
}

function setupConsumer(amqpConnection, nodeName) {
  var ok = amqpConnection.createChannel(onAMQPConnectionOpen)
  function onAMQPConnectionOpen(err, channel) {
    if (err) {
      console.error(err)
      return
    }
    channel.assertQueue(nodeName)
    channel.consume(nodeName, function(message) {
      if (message != null) {
        sendPushNotification(message)
        channel.ack(message)
      }
    })
  }
}

function connectToRMQ() {
  amqp.connect(config['RMQ_URL'], function(err, amqpConnection) {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    consumer(amqpConnection)
  })
}

io.on('connection', (socket) => {
  if (socket['id'] != null && openConnections[socketId] == null) {
    openConnections[socket['id']] = socket
  }
})

server.listen(PORT, function() {
  zookeeperClient.connect()
  connectToRMQ()
  console.log("Listening on: " + PORT)
});