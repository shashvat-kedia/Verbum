const { Datastore } = require('@google-cloud/datastore');
const q = require('q');
const gcpConfig = require('./gcp_config.js');

const datastore = new Datastore(gcpConfig.GCP_CONFIG)

function get(key) {
  var deferred = q.defer()
  datastore.get(datastore.key(key), function(err, entity) {
    if (err) {
      deferred.reject(err)
    }
    deferred.resolve(entity['data'])
  })
  return deferred.promise
}

function put(key, data) {
  var deferred = q.defer()
  datastore.save({
    key: datastore.key(key),
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
  datastore.delete(datastore.key(key), function(err) {
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

function getAndUpdate(key, updateOperation) {
  var deferred = q.defer()
  var transaction = datastore.transaction()
  transaction.get(datastore.key(key), function(err, entity) {
    if (err) {
      transaction.rollback()
      deferred.reject(err)
    }
    updateOperation(entity['data']).then(function(updatedEntityData) {
      transaction.upsert({
        key: entity['key'],
        data: updatedEntityData
      }, function(err) {
        if (err) {
          transaction.rollback()
          deferred.reject(err)
        }
        deferred.resolve(updatedEntityData)
        transaction.commit()
      })
    }).fail(function(err) {
      transaction.rollback()
      deferred.reject(err)
    })
  })
  return deferred.promise
}

module.exports = {
  get: get,
  put: put,
  remove: remove,
  executeTransactionWithRetry: executeTransactionWithRetry,
  getAndUpdate: getAndUpdate
}