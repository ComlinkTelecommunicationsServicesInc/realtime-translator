const config = require('config');

const WS_PORT = config.get('port');
const TARGET_AGENT = config.get('target_agent');

module.exports = {
  WS_PORT,
  TARGET_AGENT
};
