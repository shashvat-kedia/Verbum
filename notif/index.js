const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const server = require('http').createServer();
const io = require('socket.io')(server, { 'pingInterval': 5000, 'pingTimeout': 15000 });
const uuid = require('uuid/v3');
const fs = require('fs');
const getMac = require('getmac');
const zookeeper = require('node-zookeeper-client');
const Eureka = require('eureka-js-client').Eureka;
const zookeeperClient = zookeeper.createClient('localhost:2181', {
  sessionTimeout: 30000,
  spinDelay: 1000,
  retries: 1
});
const amqp = require('amqplib');
const grpc = require('grpc');
const grpcServer = new grpc.Server();
const notifServiceProto = grpc.load('../proto/notif.proto');
var config = null;
const app = express();

const PORT = 8000 || process.env.PORT

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(cors())

openConnections = {}
isZookeeperConnected = false
nodeId = null
registeredWithEureka = false

grpcServer.addService(notifServiceProto.NotificationService.service, {
  GetActiveClients: function(call, callbacks) {
    availableClients = []
    for (var id in openConnections) {
      if (!openConnections[id]['modelIdLock']) {
        availableClients.push({
          socketId: id,
          notifIns: nodeId
        })
        openConnections[id]['modelIdLock'] = true
        openConnections[id]['modelId'] = call.id
      }
    }
    callback(null, availableClients)
  }
})

function getEurekaClient(config) {
  return new Eureka({
    instance: {
      app: 'notif',
      instanceId: 'notif-1',
      hostName: 'localhost',
      ipAddr: '127.0.0.1',
      port: {
        '$': PORT,
        '@enabled': true
      },
      vipAddress: 'notifvip',
      dataCenterInfo: {
        '@class': 'com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo',
        name: 'MyOwn'
      },
      registerWithEureka: true
    },
    eureka: {
      host: config['EUREKA_HOST'],
      port: config['EUREKA_PORT'],
      servicePath: '/eureka/apps/'
    }
  })
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

zookeeperClient.on('connected', function() {
  console.log("Connected to zookeeper")
  zookeeperClient.exists('/config', function(err, stat) {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    if (stat) {
      getData(zookeeperClient, '/config', function(data) {
        if (err) {
          console.error(err)
          return
        }
        config = JSON.parse(data)
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
        client = getEurekaClient(config)
        client.start(function(err) {
          if (err) {
            throw err
          }
          console.log('Registered with Eureka')
          registeredWithEureka = true
          console.log(client.getInstancesByAppId('notif'))
        })
        grpcServer.bind('127.0.0.1:5001', grpc.ServerCredentials.createInsecure())
        grpcServer.start()
        connectToRMQ()
      })
    }
    else {
      console.error("Config not preseent on zookeeper")
      //process.exit(1)
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
        sendPushNotification(JSON.parse(message.content.toString('utf8')))
        channel.ack(message)
      }
    })
  }
}

function sendPushNotification(message) {
  for (var clientId in message.clientIds) {
    if (openConnections[clientId] != null) {
      openConnections[clientId].emit(config['NOTIFICATION_CHANNEL'], message.body)
    }
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

function deRegister(isProcessExit) {
  if (registeredWithEureka) {
    client.stop(function() {
      console.log('Service stopped')
      if (isProcessExit) {
        process.exit()
      }
    })
  }
}

io.on('connection', (socket) => {
  if (socket['id'] != null && openConnections[socketId] == null) {
    openConnections[socket['id']] = {
      socket: socket,
      modelIdLock: false,
      modelId: null
    }
  }
})

server.listen(PORT, function() {
  zookeeperClient.connect()
  console.log("Listening on: " + PORT)
});

process.on('exit', function() {
  deRegister(true)
})

process.on('SIGINT', function() {
  deRegister(true)
}) 