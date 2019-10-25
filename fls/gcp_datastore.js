const Datastore = require('@google-cloud/datastore');
const q = require('Q');
const gcpConfig = require('./gcp_config.js');

const datastore = new Datastore(gcpConfig.GCP_CONFIG)

function get(key) {
  var deferred = q.defer()
  datastore.get(key, function(err, entity) {
    if (err) {
      deferred.reject(err)
    }
    deferred.resolve(entity)
  })
  return deferred.promise
}

function put(key, data) {
  var deferred = q.defer()
  datastore.save({
    key: key,
    data: data
  }, function(err) {
    if (err) {
      deferred.reject(err)
    }
    deferred.resolve(true)
  })
  return deferred.promise
}

function remove(key) {
  var deferred = q.defer()
  datastore.delete(key, function(err) {
    if (err) {
      deferred.reject(err)
    }
    deferred.resolve(true)
  })
  return deferred.promise
}

function executeTransactionWithRetry(operationPromise, maxRetires) {
  var currentAttempt = 1
  var delay = 100
  var deferred = q.defer()
  function executeTransaction(operationPromise) {
    operationPromise.then(function(data) {
      deferred.resolve(data)
    }).fail(function(err) {
      if (currentAttempt < maxRetires) {
        setTimeout(function() {
          currentAttempt++
          delay *= 2
          executeTransaction(operationPromise)
        }, delay)
      }
      else {
        deferred.reject(err)
      }
    })
  }
  executeTransaction(operationPromise)
  return deferred.promise
}

function updateAndGet(key, newValue) {
  var deferred = q.defer()
  var transaction = datastore.transaction()

}

module.exports = {
  getDatastore: createDatastore,
  get: get,
  put: put,
  remove: remove
}