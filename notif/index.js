const fs = require('fs');
const server = require('http').createServer();
const io = require('socket.io')(server, { 'pingInterval': 5000, 'pingTimeout': 15000 });
const uuid = require('uuid/v3');
const getMac = require('getmac');
const ip = require('ip');
const q = require('q');
const winston = require('winston');
const logger = winston.createLogger({
  format: winston.format.json(),
  defaultMeta: { service: 'notification-service' },
  transports: [
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

function cleanup(options, exitCode) {
  if (nodeId != null) {
    zookeeper.remove(config['ZOOKEEPER_NODES_PATH'] + '/' + nodeId, -1, function(err) {
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
  zookeeperClient.create(nodePath, Buffer.from(value), function(err, path) {
    if (err) {
      deferred.reject(err)
    }
    logger.info('Zookeeper updated at path: ' + path)
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
  fs.access(config['NODE_NAME_FILE_PATH'], fs.F_OK, (err) => {
    if (err) {
      logger.error(err)
      getMac.getMac(function(err, macAddress) {
        if (err) {
          deferred.reject(err)
        }
        updateZookeeper(config['ZOOKEEPER_NODES_PATH'] + '/' + nodeId, macAddress).then(function(_) {
          deferred.resolve(uuid(macAddress, config['UUID_NAMESPACE']))
        }).fail(function(err) {
          deferres.reject(err)
        })
      })
    }
    else {
      fs.readFile(config['NODE_NAME_FILE_PATH'], function(err, data) {
        if (err) {
          deferred.reject(err)
        }
        updateZookeeper(config['ZOOKEEPER_NODES_PATH'] + '/' + nodeId, data).then(function(_) {
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
  setupSubscriber()
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
    client.stop(function() {
      logger.info('Service stopped')
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
    callbacks(null, {
      successful: true
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
  logger.info('Disconnected from zookeeper')
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
  logger.info("Listening on: " + PORT)
  logger.info("Host IP address: " + ip.address())
});

process.on('exit', function() {
  deRegister(true)
})

process.on('SIGINT', function() {
  deRegister(true)
}) 