const { Datastore } = require('@google-cloud/datastore');
const q = require('q');
const gcpConfig = require('./gcp_config.js');

var datastore = null

function init() {
  datastore = new Datastore(gcpConfig.GCP_CONFIG)
}

function get(kind, name) {
  var deferred = q.defer()
  var key = datastore.key([kind, name])
  datastore.get(key, function(err, entity) {
    if (err) {
      deferred.reject(err)
    }
    else {
      deferred.resolve(entity)
    }
  })
  return deferred.promise
}

function put(kind, name, data) {
  var deferred = q.defer()
  var key = datastore.key([kind, name])
  datastore.save({
    key: key,
    data: data
  }, function(err) {
    if (err) {
      deferred.reject(err)
    }
    else {
      deferred.resolve(true)
    }
  })
  return deferred.promise
}

function remove(kind, name) {
  var deferred = q.defer()
  var key = datastore.key([kind, name])
  datastore.delete(key, function(err) {
    if (err) {
      deferred.reject(err)
    }
    else {
      deferred.resolve(true)
    }
  })
  return deferred.promise
}

function executeTransactionWithRetry(operationPromise, maxRetries) {
  var deferred = q.defer()
  function executeTransaction(operationPromise, deferred, currentAttempt, maxRetries) {
    operationPromise.then(function(data) {
      deferred.resolve(data)
    }).fail(function(err) {
      if (typeof err == 'object' && err['retry'] != null && !err['retry']) {
        deferred.resolve(err)
      }
      else {
        if (currentAttempt < maxRetries) {
          setTimeout(function() {
            currentAttempt++
            delay *= 2
            executeTransaction(operationPromise, deferred, currentAttempt, maxRetries)
          }, delay)
        }
        else {
          deferred.reject(err)
        }
      }
    })
  }
  executeTransaction(operationPromise, deferred, 1, 100)
  return deferred.promise
}

function getAndUpdate(kind, name, updateOperation) {
  var deferred = q.defer()
  var transaction = datastore.transaction()
  var key = datastore.key([kind, name])
  transaction.run().then(function() {
    return transaction.get(key)
  }).then(function(entities) {
    var defer = q.defer()
    updateOperation(entities[0]).then(function(updatedEntityData) {
      defer.resolve(updatedEntityData)
    }).fail(function(err) {
      transaction.rollback()
      deferred.reject(err)
    })
    return defer.promise
  }).then(function(updatedEntityData) {
    var defer = q.defer()
    transaction.save({
      key: key,
      data: updatedEntityData
    })
    defer.resolve(updatedEntityData)
    return defer.promise
  }).then(function(updatedEntityData) {
    var defer = q.defer()
    transaction.commit()
    defer.resolve(updatedEntityData)
    return defer.promise
  }).then(function(updatedEntityData) {
    deferred.resolve(updatedEntityData)
  }).catch(function(err) {
    transaction.rollback()
    deferred.reject(err)
  })
  return deferred.promise
}

module.exports = {
  init: init,
  get: get,
  put: put,
  remove: remove,
  executeTransactionWithRetry: executeTransactionWithRetry,
  getAndUpdate: getAndUpdate
}