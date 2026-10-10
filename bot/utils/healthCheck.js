const { getLogger } = require('./logging');
const { GameAPI } = require('./api/index');

/**
 * Check if API is reachable and responding
 */
async function checkAPIConnection() {
  const logger = await getLogger();
  const apiUrl = process.env.API_URL || 'http://localhost:3000';

  try {
    logger.debug(`🔌 Checking API connection...`);
    const api = new GameAPI();
    const result = await api.healthCheck();

    if (result && result.status === 'ok') {
      logger.info(`✅ API Connection: Connected`);
      logger.debug(`   Database: ${result.database || 'unknown'}`);
      logger.debug(`   Uptime: ${result.uptime || 'unknown'}`);
      if (result.memory) {
        logger.debug(`   Memory: ${result.memory.heapUsed} heap, ${result.memory.rss} total`);
      }
      return { connected: true, url: apiUrl };
    }

    logger.warn(`⚠️ API Connection: Unexpected response from API`);
    logger.warn(`   Expected: { status: 'ok', ... }`);
    logger.warn(`   Received: ${JSON.stringify(result)}`);
    return { connected: false, error: 'Unexpected response format', response: result };
  } catch (error) {
    logger.error(`❌ API Connection Failed: ${error.message}`);
    if (error.code) {
      logger.error(`   Error Code: ${error.code}`);
    }
    if (error.response) {
      logger.error(`   Status: ${error.response.status}`);
      logger.error(`   Response: ${JSON.stringify(error.response.data)}`);
    }
    return { connected: false, error: error.message };
  }
}

/**
 * Startup check: is the game API reachable? The bot has no database access of its own, so this is all there is to
 * verify.
 */
async function performStartupHealthCheck() {
  const logger = await getLogger();
  logger.info('🔍 Starting API health check...');

  try {
    const apiStatus = await checkAPIConnection();
    return { success: true, apiConnected: apiStatus.connected };
  } catch (error) {
    logger.error(`❌ Health check failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

module.exports = {
  performStartupHealthCheck,
};
