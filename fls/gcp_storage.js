const { Storage } = require('@google-cloud/storage');
const q = require('q');
const gcpConfig = require('./gcp_config.js');

const storage = new Storage(gcpConfig['GCP_CONFIG'])
const bucket = storage.bucket(gcpConfig['BUCKET_NAME'])

// Support multiple file uploads across concurrent threads

function uploadToGCSMiddleware(req, res, next) {
  if (!req.files || req.files.length != 1) {
    return next()
  }
  const gcsName = req.files[0].originalname //Expected to be of format <modelId>:<sessionId>:<clientId/socketId>
  const file = bucket.file(gcsName)
  const stream = file.createWriteStream({
    metadata: {
      contentType: req.files[0].mimetype
    },
    resumable: true
  })
  stream.on('error', function(err) {
    req.files[0].cloudStorageError = err
    next(err)
  })
  stream.on('finish', function() {
    req.files[0].cloudStorageObject = gcsName
    file.makePublic().then(function() {
      req.files[0].cloudStoragePublicURL = 'https://storage.googleapis.com/' + gcpConfig['BUCKET_NAME'] + '/' + gcsName
      next()
    })
  })
  stream.end(req.files[0].buffer)
}

module.exports = {
  UPLOAD_TO_GCS_MIDDLEWARE: uploadToGCSMiddleware
}