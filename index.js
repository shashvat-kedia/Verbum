const express = require('express');
const mongod = require('mongod');
const bodyParser = require('body-parser');
const cors = require('cors');
const server = require('http').createServer();
const io = require('socket.io')(server);
const uuid = require('uuid/v3');
const fs = require('fs');
const getMac = require('getMac');
const constants = require('./constants.js');
const amqp = require('amqplib');
const app = express();

const PORT = 8000 || process.env.PORT

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(cors())

openConnections = {}

function consumer(amqpConnection) {
  fs.access(constants['NODE_NAME_FILE_PATH'], fs.F_OK, (err) => {
    if (err) {
      console.error(err)
      getMac.getMac(function(err, macAddress) {
        if (err) {
          console.error(err)
          return
        }
        setupConsumer(amqpConnection, uuid(macAddress, constants['UUID_NAMESPACE']))
      })
    }
    else {
      fs.readFile(constants['NODE_NAME_FILE_PATH'], function(err, data) {
        if (err) {
          console.error(err)
        }
        setupConsumer(amqpConnection, data)
      })
    }
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
  connectToRMQ()
  console.log("Listening on: " + PORT)
});
