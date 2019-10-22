const Datastore = require('@google-cloud/datastore');
const q = require('Q');

function createDatastore(datastoreConfig) {
  return new Datastore({
    projectId: datastoreConfig['projectId'],
    keyFilename: datastoreConfig['keyFilename']
  })
}

function get(datastore, key) {
  var deferred = q.defer()
  datastore.get(key, function(err, entity) {
    if (err) {
      deferred.reject(err)
    }
    deferred.resolve(entity)
  })
  return deferred.promise
}

function put(datastore, key, data) {
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

function remove(datastore, key) {
  var deferred = q.defer()
  datastore.delete(key, function(err) {
    if (err) {
      deferred.reject(err)
    }
    deferred.resolve(true)
  })
  return deferred.promise
}

module.exports = {
  getDatastore: createDatastore,
  get: get,
  put: put,
  remove: remove
}