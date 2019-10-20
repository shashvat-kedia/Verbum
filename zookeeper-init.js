const fs = require('fs');
const zookeeper = require('node-zookeeper-client');
const zookeeperClient = zookeeper.createClient('localhost:2181', {
  sessionTimeout: 30000,
  spinDelay: 1000,
  retries: 1
});

zookeeperClient.connect()
zookeeperClient.on('connected', function() {
  console.log('zookeeper-init connected to Zookeeper instance')
  const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'))
  zookeeperClient.create('/config', Buffer.from(JSON.stringify(config)), zookeeper.CreateMode.PERSISTENT, function(err, path) {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    console.log('Initial config stored at path: ' + path)
    process.exit(1)
  })
})