const { PubSub } = require('@google-cloud/pubsub');
const gcpConfig = require('./gcp_config.js');
const pubSub = new PubSub(gcpConfig.GCP_CONFIG)

