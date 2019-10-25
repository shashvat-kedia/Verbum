const { Storage } = require('@google-cloud/storage');
const q = require('q');
const gcpConfig = require('./gcp_config.js');

const storage = new Storage(gcpConfig['GCP_CONFIG'])
const bucket = storage.bucket(gcpConfig['BUCKET_NAME'])

function uploadToGCSMiddleware(req, res, next) {
  if (!req.file) {
    return next()
  }
  const gcsName = req.file.originalName //Expected to be of format <modelId>:<sessionId>:<clientId/socketId>
  const file = bucket.file(gcsName)
  const stream = file.createWriteStream({
    metadata: {
      contentType: req.file.mimetype
    },
    resumable: true
  })
  stream.on('error', function(err) {
    req.file.cloudStorageError = err
    next(err)
  })
  stream.on('finish', function() {
    req.file.cloudStorageObject = gcsName
    file.makePublic().then(function() {
      req.file.cloudStoragePublicURL = 'https://storage.googleapis.com/' + gcpConfig['BUCKET_NAME'] + '/' + gcsName
    })
  })
  stream.end(req.file.buffer)
}

module.exports = {
  UPLOAD_TO_GCS_MIDDLEWARE: uploadToGCSMiddleware
}