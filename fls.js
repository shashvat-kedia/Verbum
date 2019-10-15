const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const grpc = require('grpc');
const notificationProto = grpc.load('../notification.proto');
// Have to integrate service discovery so that URL does not have to be hardcoded
const notificationServiceClient = new notificationProto.NotificationService('localhost:8001', grpc.credentials.createInsecure())
const app = express()

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(cors())

function sendNotification(message, clientIds) {
  if (clientIds.length > 0) {
    notificationServiceClient.Send({
      'message': JSON.stringify(message),
      'clientIds': clientIds
    }, function(err, response) {
      if (err) {
        throw err;
      }
      console.log(response.statusCode)
      console.log(response.failedClientIds)
    })
  }
}

app.get('/train/:modelId/:minClients', function(req, res) {

})