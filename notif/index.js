const fs = require('fs');
const server = require('http').createServer();
const io = require('socket.io')(server, { 'pingInterval': 5000, 'pingTimeout': 15000 });
const uuid = require('uuid/v3');
const getMac = require('getmac');
const ip = require('ip');
const q = require('q');
const winston = require('winston');
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'notification-service', timestamp: Date.now() },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
})
const Eureka = require('eureka-js-client').Eureka;
const zookeeper = require('node-zookeeper-client');
const zookeeperClient = zookeeper.createClient('localhost:2181', {
  sessionTimeout: 30000,
  spinDelay: 1000,
  retries: 1
});
const { PubSub } = require("@google-cloud/pubsub");
const gcpConfig = require("./gcp_config.js");
const grpc = require('grpc');
const grpcServer = new grpc.Server();
const notifServiceProto = grpc.load('../proto/notif.proto');

const PORT = 8000 || process.env.PORT

var config = null;

var openConnections = {}
var isZookeeperConnected = false
var nodeId = null
var registeredWithEureka = false
var pubSub = null
var subscription = null

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

function getChildren(client, path, done) {
  client.getChildren(path, function(event) {
    getChildren(client, path, done)
  }, function(err, children, stat) {
    if (err) {
      loggeer.error(err)
      throw err
    }
    if (stat) {
      done(children)
    }
    else {
      done(null)
    }
  })
}

function cleanup() {
  if (nodeId != null) {
    zookeeperClient.remove(config['ZOOKEEPER_NODES_PATH'] + '/' + nodeId, -1, function(err) {
      if (err) {
        logger.error(err)
        throw err
      }
      logger.info('Service instance zookeeper node removed.')
    })
  }
}

function updateZookeeper(nodePath, value) {
  var deferred = q.defer()
  zookeeperClient.exists(nodePath, function(err, stat) {
    if (err) {
      deferred.reject(err)
    }
    if (stat) {
      deferred.resolve(true)
    }
    else {
      zookeeperClient.create(nodePath, Buffer.from(value), function(err, path) {
        if (err) {
          deferred.reject(err)
        }
        logger.info('Zookeeper updated at path: ' + path)
        deferred.resolve(true)
      })
    }
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
  if (!fs.existsSync(config['NODE_NAME_FILE_PATH'])) {
    getMac.getMac(function(err, macAddress) {
      if (err) {
        deferred.reject(err)
      }
      var generatedId = uuid(macAddress, config['UUID_NAMESPACE'])
      var writeStream = fs.createWriteStream(config['NODE_NAME_FILE_PATH'])
      writeStream.write(generatedId)
      writeStream.end()
      updateZookeeper(config['ZOOKEEPER_NODES_PATH'] + '/' + generatedId, generatedId).then(function(_) {
        deferred.resolve(generatedId)
      }).fail(function(err) {
        deferred.reject(err)
      })
    })
  }
  else {
    fs.readFile(config['NODE_NAME_FILE_PATH'], function(err, data) {
      if (err) {
        deferred.reject(err)
      }
      var id = data.toString('utf8')
      updateZookeeper(config['ZOOKEEPER_NODES_PATH'] + '/' + id, id).then(function(_) {
        deferred.resolve(id)
      }).fail(function(err) {
        deferred.reject(err)
      })
    })
  }
  return deferred.promise
}

function unlockPendingClients() {
  getChildren(zookeeperClient, '/verbum/unlock/' + nodeId, function(modelIds) {
    if (modelIds != null) {
      for (var modelId in modelIds) {
        zookeeperClient.getData('/verbum/unlock/' + nodeId + '/' + modelId, function(err, data, stat) {
          if (err) {
            logger.error(err)
            throw err
          }
          if (stat) {
            var clientIds = JSON.parse(data.toString('utf8')).clients
            for (var clientId in clientIds) {
              if (openConnections[clientId] != null && openConnections[clientId]['modelIdLock']
                && openConnections[clientId]['modelId'] == modelId) {
                openConnections[clientId]['modelIdLock'] = false
                openConnections[clientId]['modelId'] = null
              }
            }
            zookeeperClient.remove('/verbum/unlock/' + nodeId + '/' + modelId, -1, function(err) {
              if (err) {
                logger.error(err)
                throw err
              }
              logger.info('Clients unlocked')
            })
          }
        })
      }
    }
    else {
      logger.info('No cients to unlock')
    }
  })
}

function init() {
  startEurekaClient()
  startGrpcServer()
  connectToRMQ()
  setupSubscriber()
  unlockClients()
}

function setupSubscriber() {
  pubSub = new PubSub(gcpConfig.GCP_CONFIG)
  subscription = pubSub.subscription(nodeId)
  subscription.on('message', function(message) {
    if (message != null) {
      sendPushNotification(message.data)
      message.ack()
    }
  })
}

function startEurekaClient() {
  client = getEurekaClient(config)
  client.start(function(err) {
    if (err) {
      throw err
    }
    logger.info('Registered with Eureka')
    registeredWithEureka = true
  })
}

function startGrpcServer() {
  grpcServer.bind(ip.address() + ':5001', grpc.ServerCredentials.createInsecure())
  grpcServer.start()
}

function deRegister(isProcessExit) {
  if (registeredWithEureka) {
    registerWithEureka = false
    client.stop(function() {
      cleanup()
      logger.info('Service stopped')
      if (isProcessExit) {
        process.exit()
      }
    })
  }
}

grpcServer.addService(notifServiceProto.NotificationService.service, {
  GetActiveClients: function(call, callback) {
    availableClients = []
    for (var id in openConnections) {
      if (!openConnections[id]['modelIdLock'] && !openConnections[id]['isUnavailable']) {
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
  UnlockClients: function(call, callback) {
    for (var client in call.clients) {
      var id = client['socketId']
      openConnections[id]['modelIdLock'] = false
      openConnections[id]['modelId'] = null
    }
    callback(null, {
      successful: true
    })
  },
  GetClientTrainingProgress: function(call, callback) {
    var clientProgress = []
    for (var client in call.clients) {
      if (openConnections[client['socketId']]['modelIdLock']) {
        clientProgress.push({
          clientId: socket['id'],
          trainingProgress: openConnections[socket['id']]['trainingProgress']
        })
      }
    }
    callback(null, {
      clientProgress: clientProgress
    })
  }
})

zookeeperClient.on('connected', function() {
  logger.info("Connected to zookeeper")
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
              init()
            }).fail(function(err) {
              logger.error(err)
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
                init()
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
  logger.info('Disconnected from zookeeper')
  zookeeperClient.connect()
})

io.on('connection', (socket) => {
  if (socket['id'] != null && openConnections[socket['id']] == null) {
    socket.reconnect()
    logger.info('New connection: ' + socket['id'])
    openConnections[socket['id']] = {
      socket: socket,
      modelIdLock: false,
      modelId: null,
      isUnavailable: false
    }
    socket.on('disconnect', (response) => {
      if (openConnections[socket['id']] != null) {
        if (openConnections[socket['id']]['modelIdLock']) {
          logger.info('Trying to reconnect to: ' + socket['id'])
          socket.connect()
        }
        else {
          logger.info('Client disconnected: ' + socket['id'])
          openConnections[socket['id']] = null
        }
      }
    })
    socket.on('error', (error) => {
      if (openConnections[socket['id']] != null) {
        if (openConnections[socket['id']]['modelIdLock']) {
          logger.info('Trying to reconnect to: ' + socket['id'])
          socket.connect()
        }
        else {
          openConnections[socket['id']]['isUnavailable'] = true
        }
      }
    })
    socket.on('training-complete', (data) => {
      //Queue message containing Date.now() and socket['id'] and data.modelId and data.sessionId
    })
    socket.on('progress-update', (data) => {
      if (openConnections[socket['id']] != null && openConnections[socket['id']]['modelId'] == data.modelId) {
        openConnections[socket['id']]['trainingProgress'] = data['trainingProgress']
      }
    })
  }
  else if (socket['id'] != null && openConnections[socket['id']] != null && openConnections[socket['id']]['isUnavailable']) {
    openConnections[socket['id']]['isUnavailable'] = false
  }
})

server.listen(PORT, function() {
  zookeeperClient.connect()
  logger.info("Listening on: " + PORT)
  logger.info("Host IP address: " + ip.address())
});

process.on('exit', function() {
  deRegister(true)
})

process.on('SIGINT', function() {
  deRegister(true)
}) 