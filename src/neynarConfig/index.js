const { NeynarAPIClient, Configuration } = require("@neynar/nodejs-sdk");
const config = require('../config/env');

const neynarConfig = new Configuration({
  apiKey: config.neynarApiKey,
});

const client = new NeynarAPIClient(neynarConfig);

module.exports = client;