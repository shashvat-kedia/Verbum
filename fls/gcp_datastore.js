const { Datastore } = require('@google-cloud/datastore');
const q = require('q');
const gcpConfig = require('./gcp_config.js');

const datastore = new Datastore(gcpConfig.GCP_CONFIG)

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
    return updateOperation(entities[0])
  }).then(function(updatedEntityData) {
    return transaction.save({
      key: key,
      data: updatedEntityData
    })
  }).then(function() {
    return transaction.commit()
  }).then(function() {
    return get(kind, name)
  }).then(function(updatedEntityData) {
    console.log(updatedEntityData)
    deferred.resolve(updatedEntityData)
  }).catch(function(err) {
    console.log(err)
    transaction.rollback()
    deferred.reject(err)
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