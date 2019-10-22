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
const q = require('Q');
const grpc = require('grpc');
const ip = require('ip');
const grpcServer = new grpc.Server();
const notifServiceProto = grpc.load('../proto/notif.proto');
const winston = require('winston');
const logger = winston.createLogger({
  format: winston.format.json(),
  defaultMeta: { service: 'notification-service' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
})
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

function getEurekaClient(config) {
  return new Eureka({
    instance: {
      app: 'notif',
      instanceId: nodeId,
      hostName: 'localhost',
      ipAddr: ip.address(),
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
      logger.error(err)
      throw err
    }
    if (stat) {
      done(data.toString('utf8'))
    }
    else {
      done(null)
    }
  })
}

function cleanup(options, exitCode) {
  if (nodeId != null) {
    zookeeper.remove(config['ZOOKEEPER_NODES_PATH'] + '/' + nodeId, -1, function(err) {
      if (err) {
        logger.error(err)
        throw err
      }
      logger.log('Service instance zookeeper node removed.')
    })
  }
}

function consumer(amqpConnection, nodeName) {
  var ok = amqpConnection.createChannel(onAMQPConnectionOpen)
  function onAMQPConnectionOpen(err, channel) {
    if (err) {
      logger.error(err)
      return //To be converted to throw err;
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

function updateZookeeper(nodePath, value) {
  var deferred = q.defer()
  zookeeperClient.create(nodePath, Buffer.from(value), function(err, path) {
    if (err) {
      deferred.reject(err)
    }
    logger.log('Zookeeper updated at path: ' + path)
    deferred.resolve(true)
  })
  return deferred.promise
}

function sendPushNotification(message) {
  for (var clientId in message.clientIds) {
    if (openConnections[clientId] != null) {
      openConnections[clientId].emit(config['NOTIFICATION_CHANNEL'], message.body)
    }
  }
}

function generateNodeId() {
  var deferred = q.defer()
  fs.access(constants['NODE_NAME_FILE_PATH'], fs.F_OK, (err) => {
    if (err) {
      logger.error(err)
      getMac.getMac(function(err, macAddress) {
        if (err) {
          deferred.reject(err)
        }
        updateZookeeper(config['ZOOKEEPER_NODES_PATH'] + '/' + nodeId, nodeId).then(function(_) {
          deferred.resolve(uuid(macAddress, constants['UUID_NAMESPACE']))
        }).fail(function(err) {
          deferres.reject(err)
        })
      })
    }
    else {
      fs.readFile(constants['NODE_NAME_FILE_PATH'], function(err, data) {
        if (err) {
          deferred.reject(err)
        }
        updateZookeeper(config['ZOOKEEPER_NODES_PATH'] + '/' + nodeId, nodeId).then(function(_) {
          deferred.resolve(data)
        }).fail(function(err) {
          deferred.reject(err)
        })
      })
    }
  })
  return deferred.promise
}

function connectToServices() {
  startEurekaClient()
  startGrpcServer()
  connectToRMQ()
}

function startEurekaClient() {
  client = getEurekaClient(config)
  client.start(function(err) {
    if (err) {
      throw err
    }
    logger.log('Registered with Eureka')
    registeredWithEureka = true
  })
}

function startGrpcServer() {
  grpcServer.bind(ip.address() + ':5001', grpc.ServerCredentials.createInsecure())
  grpcServer.start()
}

function connectToRMQ() {
  amqp.connect(config['RMQ_URL'], function(err, amqpConnection) {
    if (err) {
      logge.error(err)
      process.exit(1)
    }
    consumer(amqpConnection, nodeId)
  })
}

function deRegister(isProcessExit) {
  if (registeredWithEureka) {
    client.stop(function() {
      logger.log('Service stopped')
      if (isProcessExit) {
        process.exit()
      }
    })
  }
}

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
  },
  UnlockClients: function(call, callbacks) {
    for (var client in call.clients) {
      var id = client['socketId']
      openConnections[id]['modelIdLock'] = false
      openConnections[id]['modelId'] = null
    }
    callbacks(null, true)
  }
})

zookeeperClient.on('connected', function() {
  logger.log("Connected to zookeeper")
  zookeeperClient.exists('/config', function(err, stat) {
    if (err) {
      logger.error(err)
      throw err
    }
    if (stat) {
      getData(zookeeperClient, '/config', function(data) {
        if (err) {
          logger.error(err)
          throw err
        }
        config = JSON.parse(data)
        zookeeperClient.exists(config['ZOOKEEPER_NODES_PATH'], function(err, stat) {
          if (err) {
            logger.error(err)
            throw err
          }
          if (stat) {
            generateNodeId().then(function(instanceId) {
              nodeId = instanceId
              connectToServices()
            }).fail(function(err) {
              throw err
            })
          }
          else {
            zookeeperClient.mkdirp(config['ZOOKEEPER_NODES_PATH'], function(err, path) {
              if (err) {
                logger.error(err)
                throw err
              }
              generateNodeId().then(function(instanceId) {
                nodeId = instanceId
                connectToServices()
              }).fail(function(err) {
                logger.error(err)
                throw err
              })
            })
          }
        })
      })
    }
    else {
      logger.error("Config not present on zookeeper")
      process.exit(1)
    }
  })
})

zookeeperClient.on('disconnected', function() {
  isZookeeperConnected = false
  logger.log('Disconnected from zookeeper')
})

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
  logger.log("Listening on: " + PORT)
  logger.log("Host IP address: " + ip.aaddress())
});

process.on('exit', function() {
  deRegister(true)
})

process.on('SIGINT', function() {
  deRegister(true)
}) 