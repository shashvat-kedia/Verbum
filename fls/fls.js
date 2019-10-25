const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const grpc = require('grpc');
const amqp = require('amqplib');
const zookeeper = require('node-zookeeper-client');
const zookeeperClient = zookeeper.createClient('localhost:2181', {
  sessionTimeout: 30000,
  spinDelay: 1000,
  retries: 1
});
const winston = require('winston');
const logger = winston.createLogger({
  format: winston.format.json(),
  defaultMeta: { service: 'fls-service' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
})
const Multer = require('multer');
const multer = Multer({
  storage: Multer.MemoryStorage
})
const ip = require('ip');
const q = require('q');
const uuid = require('uuid/v3');
const Eureka = require('eureka-js-client').Eureka;
const app = express();
const notifServiceProto = grpc.load('../proto/notif.proto');
const gcpDatastore = require('./gcp_datastore.js');
const gcpStorage = require('./gcp_storage.js');

const PORT = 8030 || process.env.PORT;

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(cors())

var config = null;
var publisherChannel = null;
var isConnectedToZookeeper = false;

function createEurekaClient(config) {
  return new Eureka({
    instance: {
      app: 'fls',
      instanceId: 'fls-1',
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

function getGrpcClient(serviceURL) {
  return new notifServiceProto.NotificationService(serviceURL, grpc.credentials.createInsecure())
}

function getActiveClientList(serviceURL, modelId) {
  var deferred = q.defer()
  var grpcClient = getGrpcClient(serviceURL)
  grpcClient.GetActiveClients({
    modelId: modelId
  }, function(err, response) {
    if (err) {
      deferred.reject(err)
    }
    grpc.closeClient(grpcClient)
    deferred.resolve(response.clients)
  })
  return deferred.promise
}

function evenlyDistributeClients(allSetteledPromise, avgClients) {
  var deferred = q.defer()
  var avgNoClients = avgClients
  allSetteledPromise.then(function(responses) {
    var acceptedClients = []
    var leftOut = []
    var minLeftOut = Number.MAX_SAFE_INTEGER
    for (var i = 0; i < responses.length; i++) {
      if (acceptedClients.length < minClients) {
        if (responses[i].length > avgNoClients) {
          Array.prototype.push(acceptedClients, responses[i].slice(0, avgNoClients))
          var leftOut = Math.min(0, responses[i].length - avgNoClients)
          if (leftOut < minLeftOut) {
            minLeftOut = leftOut
          }
          leftOuts.push({
            index: i,
            clinetNo: avgNoClients
          })
        }
        else {
          Array.prototype.push(acceptedClients, responses[i])
        }
      }
    }
    while (acceptedClients.length < minClients) {
      var temp = Number.MAX_SAFE_INTEGER
      for (var i = 0; i < leftOuts.length; i++) {
        var oldClientNo = leftOuts[i]['clientNo']
        var newClientNo = oldClientNo + minLeftOut
        if (nexClientNo > responses[leftOuts[i]['index']].length) {
          Array.prototype.push(acceptedClients, responses[leftOuts[i]['index']].slice(leftOuts[i]['clientNo']))
          leftOuts[i]['clientNo'] = responses[leftOuts[i]['index']].length
        }
        else {
          Array.prototype.push(acceptedClients, responses[leftOuts[i]['index']].slice(oldClientNo, newClientNo))
          leftOuts[i]['clientNo'] = newClientNo
          if (temp < newClientNo) {
            temp = newClientNo
          }
        }
      }
      if (temp == 0) {
        break
      }
      minLeftOut = temp
    }
    deferred.resolve(acceptedClients)
  }).fail(function(err) {
    deferred.reject(err)
  })
  return deferred.promise
}

function unlockClients(serviceURL, clients) {
  var deferred = q.defer()
  var grpcClient = getGrpcClient(serviceURL)
  grpcClient.UnlockClients({
    clients: clients
  }, function(err, response) {
    if (err) {
      deferred.reject(err)
    }
    grpc.closeClient(grpcClient)
    deferred.resolve(response['successful'])
  })
  return deferres.promise
}

function startPublisher(amqpConnection) {
  amqpConnection.createChannel(onPublisherStart);
  function onPublisherStart(err, channel) {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    publisherChannel = channel
    publisherChannel.assertQueue(config['FANOUT_QUEUE_TOPIC'])
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

function partitionClientsByInstanceId(clients) {
  clientPartitions = {}
  for (var client in clients) {
    if (clientPartitions[client['notifIns']] != null) {
      clientPartitions[client['notifIns']].push(client)
    }
    else {
      clientPartitions[client['notifIns']] = [client]
    }
  }
  return clientPartitions
}

function searchForClient(participantClients, clientId) {
  for (var i = 0; i < participantClients.length; i++) {
    if (participantClients[i]['socketId'] == clientId) {
      return i
    }
  }
  return null
}

function startAMQP() {
  amqp.connect(config['RMQ_URL'], function(err, amqpConnection) {
    if (err) {
      console.error(err)
      return
    }
    startPublisher(amqpConnection)
  })
}

function deRegister(isProcessExit) {
  client.stop(function() {
    if (isProcessExit) {
      process.exit()
    }
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
        logger.info('Connected to Zookeeper')
        getData(zookeeperClient, '/config', function(data) {
          logger.info('Config obtained from Zookeeper')
          config = JSON.parse(data)
          console.log(config)
          client = createEurekaClient(config)
          client.start(function(err) {
            if (err) {
              throw err
            }
          })
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

zookeeperClient.on('disconnected', function() {
  isConnectedToZookeeper = false
})

app.get('/train/:modelId/:minClients', function(req, res) {
  serviceURLs = []
  serviceRequestPromises = []
  var notifServices = client.getInstancesByAppId('notif')
  for (var i = 0; i < notifServices.length; i++) {
    serviceURLs.push({
      serviceURL: notifServices[i]['ipAddr'] + ':' + '5001',
      instanceId: notifServicesp[i]['instanceId']
    })
  }
  for (var serviceURL in serviceURLs) {
    serviceRequestPromises.push(getActiveClientList(serviceURL['serviceURL'], req.params.modelId))
  }
  var avgNoClients = Math.max(1, Math.floor(minClients / servieURLs.length))
  evenlyDistributeClients(q.allSettled(serviceRequestPromises), avgNoClients).then(function(acceptedClients) {
    if (acceptedClients.length < minClients) {
      var unlockClientPromises = []
      var clientPartitions = partitionClientsByInstanceId(acceptedClients)
      for (var serviceURL in serviceURLs) {
        if (clientPartitions[serviceURL['instanceId']] != null) {
          unlockClientPromises.push(unlockClients(serviceURL['serviceURL'], clientPartitions[serviceURL['instanceId']]))
        }
      }
      q.allSettled(unlockClientPromises).then(function(responses) {
        var unlocked = true
        for (var response in responses) {
          unlocked = uncloked && response
        }
        console.log('Clients: ' + unlocked)
        res.status(204).json({
          message: 'minimum clients criteria cannot be fullfilled',
          availableClients: acceptedClients.length
        })
      }).fail(function(err) {
        console.error(err)
        logger.error(err)
      })
    }
    else {
      var trainingSession = {
        modelId: req.params.modelId,
        participantClients: acceptedClients,
        createdAt: Date.now()
      }
      trainingSession['sessionId'] = uuid(trainingSession['createdAt'], config['UUID_NAMESPACE'])
      gcpDatastore.put(datastore,
        'model-training/' + req.params.modelId + '/' + trainingSession['sessionId'],
        trainingSession).then(function(_) {
          logger.info('Training session info stored on GCP datastore')
          res.status(200).json({
            message: 'training started',
            trainingSession: trainingSession
          })
        }).fail(function(err) {
          logger.error(err)
        })
    }
  }).fail(function(err) {
    console.error(err)
    logger.error(err)
  })
})

app.post('/grads/:modelId/:sessionId/:socketId',
  multer.any(),
  gcpStorage.UPLOAD_TO_GCS_MIDDLEWARE, function(req, res) {
    if (req.file != null && req.file.cloudStorageError != null) {
      console.error(req.file.cloudstorageError)
      logger.error(req.file.cloudStorageError)
      res.status(406).json({
        message: 'Gradient file not found'
      })
    }
    else {
      var getAndUpdatePromise = gcpDatastore.getAndUpdate(
        '/model-training/' + req.params.modelId + '/' + req.params.sessionId, function(value) {
          var deferred = q.defer()
          var trainingSession = value
          var index = searchForClient(trainingSession['participantClients'], req.params.socketId)
          if (index != null && req.file && req.file.cloudStoragePublicURL) {
            trainingSession['participantClients'][index]['gradientPath'] = req.file.cloudStoragePublicURL
            trainingSession['participantClients'][index]['gradSubTime'] = Date.now()
            deferred.resolve(trainingSession)
          }
          else {
            deferred.resolve({
              status: 404,
              message: 'Not a paritcipant of current training round'
            })
          }
          return deferred.promise
        })
      gcpDatastore.executeTransactionWithRetry(getAndUpdatePromise,
        config['FLS_SERVICE_MAX_RETRIES']).then(function(currentValue) {
          if (currentValue['status'] != null && currentValue['status'] != 200) {
            res.status(currentValue['status']).json(currentValue)
          }
          else {
            var gradientPaths = []
            var clientIds = []
            for (var participant in currentValue['participantClients']) {
              if (participant['gradientPath'] != null) {
                gradientPaths.push(participant['gradientPath'])
                clientIds.push(participant['socketId'])
              }
            }
            if (gradientPaths.length == currentValue['participantClients'].length) {
              publisherChannel.sendToQueue(config['LEARNING_SERVICE_TOPIC'], Buffer.from(JSON.stringify({
                gradientPaths: gradientPaths,
                clientIds: clientIds,
                createdAt: Date.now()
              })))
              res.status(200).json({
                message: 'Gradient averaging started'
              })
            }
            else {
              console.log('[' + Date.now() + '] No. Clients pending gradient submission: ' + noNotSubmitted)
              logger.info('[' + Date.now() + '] No. Clients pending gradient submission: ' + noNotSubmitted)
              res.status(200).json({
                message: 'Gradients saved. Waiting for other clients.'
              })
            }
          }
        }).fail(function(err) {
          console.error(err)
          logger.error(err)
        })
    }
  })

app.get('/global/:modelId/:sessionId/:socketId', function(req, res) {
  gcpStorage.get('/model-training/' + req.params.modelId + '/' + req.params.sessionId).then(function(data) {
    var trainingSession = data
    if (trainingSession['globalModelCheckpoint'] != null) {
      var index = searchForClient(trainingSession['participantClients'], req.params.socketId)
      if (index != null) {
        trainingSession['participantClients'][index]['globalModelCheckoutTime'] = Date.now()

      }
      else {
        res.status(404).json({
          message: 'Client not parrt of current training round'
        })
      }
    }
    else {
      res.status(200).json({
        message: 'Model training has not completed yet'
      })
    }
  }).fail(function(err) {
    console.error(err)
    logger.error(err)
  })
})

app.listen(PORT, function() {
  logger.info("FLS service listening on: " + PORT)
  zookeeperClient.connect()
})

process.on('exit', function() {
  deRegister(true)
})

process.on('SIGINT', function() {
  deRegister(true)
})