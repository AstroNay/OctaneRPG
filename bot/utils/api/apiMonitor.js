const { getLogger } = require('../logging');

/**
 * API Health Monitor - Tracks API failures and sends Discord alerts
 * Uses existing Winston logging infrastructure for consistency
 */
class APIMonitor {
  constructor() {
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.isApiDown = false;
    this.consecutiveFailures = 0;
    this.alertThreshold = 3; // Alert after 3 consecutive failures
    this.resetInterval = 60000; // Reset counter after 1 minute of success
  }

  /**
   * Record a successful API call
   */
  async recordSuccess() {
    if (this.isApiDown) {
      await this.sendRecoveryAlert();
    }
    this.consecutiveFailures = 0;
    this.isApiDown = false;
  }

  /**
   * Record a failed API call
   */
  async recordFailure(endpoint, error) {
    const logger = await getLogger();
    this.consecutiveFailures++;
    this.failureCount++;
    this.lastFailureTime = new Date();

    logger.warn(`API failure [${this.consecutiveFailures}x]: ${endpoint} - ${error.message}`);

    // Send alert if threshold reached
    if (this.consecutiveFailures === this.alertThreshold && !this.isApiDown) {
      this.isApiDown = true;
      await this.sendDownAlert(endpoint, error);
    }
  }

  /**
   * Send Discord alert when API goes down
   */
  async sendDownAlert(endpoint, error) {
    const logger = await getLogger();
    
    // Use Winston logger which handles Discord webhooks automatically
    logger.error(`🚨 API CONNECTION FAILED 🚨`);
    logger.error(`Backend API is unreachable. Affected commands will tell players the service is temporarily unavailable.`);
    logger.error(`Failed Endpoint: ${endpoint}`);
    logger.error(`Error: ${error.message}`);
    logger.error(`Consecutive Failures: ${this.consecutiveFailures}`);
    logger.error(`Timestamp: ${this.lastFailureTime.toISOString()}`);
  }

  /**
   * Send Discord alert when API recovers
   */
  async sendRecoveryAlert() {
    const logger = await getLogger();
    const downDuration = new Date() - this.lastFailureTime;
    const durationSeconds = Math.floor(downDuration / 1000);

    // Use Winston logger which handles Discord webhooks automatically
    logger.info(`✅ API CONNECTION RESTORED ✅`);
    logger.info(`Backend API is now responding normally.`);
    logger.info(`Total Failures During Outage: ${this.failureCount}`);
    logger.info(`Downtime Duration: ${durationSeconds}s`);
    
    // Reset failure count after recovery
    this.failureCount = 0;
  }

  /**
   * Get current API status
   */
  getStatus() {
    return {
      isDown: this.isApiDown,
      consecutiveFailures: this.consecutiveFailures,
      totalFailures: this.failureCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Export singleton instance
module.exports = new APIMonitor();


