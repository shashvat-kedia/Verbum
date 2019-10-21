const fs = require('fs');
const zookeeper = require('node-zookeeper-client');
const zookeeperClient = zookeeper.createClient('localhost:2181', {
  sessionTimeout: 30000,
  spinDelay: 1000,
  retries: 1
});

function initConfig(config) {
  zookeeperClient.create('/config', Buffer.from(JSON.stringify(config)), zookeeper.CreateMode.PERSISTENT, function(err, path) {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    console.log('Initial config stored at path: ' + path)
    process.exit(1)
  })
}

zookeeperClient.connect()
zookeeperClient.on('connected', function() {
  console.log('zookeeper-init connected to Zookeeper instance')
  const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'))
  zookeeperClient.exists('/config', function(err, stat) {
    if (err) {
      throw err
    }
    if (stat) {
      zookeeperClient.remove('/config', -1, function(err) {
        if (err) {
          throw err
        }
        console.log('Config node deleted')
        initConfig(config)
      })
    }
    else {
      initConfig(config)
    }
  })
})