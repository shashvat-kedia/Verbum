const Eureka = require('eureka-js-client').Eureka;

const client = new Eureka({
  instance: {
    app: 'notif',
    hostName: 'localhost',
    ipAddr: '127.0.0.1',
    port: 8081,
    vipAddress: 'notif',
    dataCenterInfo: {
      name: 'test'
    }
  },
  eureka: {
    host: '127.0.0.1',
    port: 8761
  }
})

client.start()
console.log(client.getInstancesByAppId('notif'))