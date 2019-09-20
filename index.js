const express = require('express');
const mongod = require('mongod');
const bodyParser = require('body-parser');
const cors = require('cors');
const server = require('http').createServer();
const io = require('socket.io')(server);
const app = express();

const PORT = 8000 || process.env.PORT

app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())
app.use(cors())

openConnections = {}

io.on('connection', (socket) => {
  if(socket['id'] != null && openConnections[socketId] == null) {
    openConnections[socket['id']] = socket
  }
})

server.listen(PORT, function() {
  console.log("Listening on: " + PORT)
});
