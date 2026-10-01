const axios = require('axios');
const { getLogger } = require('../logging');
const apiMonitor = require('./apiMonitor');
const { assertWritable } = require('../readOnly');

// Endpoints the bot calls with POST/PATCH that are still pure reads from the bot's side, plus guild
// settings (server config, not player state). Everything else non-GET is blocked in READONLY_MODE.
const READ_ONLY_SAFE_ENDPOINTS = [
  /^\/guild-settings\//,
  /^\/racing\/(stats|simulate)$/,
  /^\/players\/[^/]+\/practice$/,
];

/**
 * Base API client with shared request logic, monitoring, and testing mode support
 */
class BaseAPIClient {
  constructor() {
    this.baseURL = process.env.API_URL || 'http://localhost:3000';
    this.apiKey = process.env.API_KEY_BOT || 'octane-bot-dev-key';
    const timeoutMs = Number(process.env.API_TIMEOUT_MS);
    this.timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 10000;
  }

  /**
   * Make HTTP request with monitoring and testing mode support
   */
  async _request(method, endpoint, data = null, options = {}) {
    // READONLY_MODE backstop: no state-changing request leaves the bot.
    if (String(method).toUpperCase() !== 'GET' && !READ_ONLY_SAFE_ENDPOINTS.some(re => re.test(endpoint))) {
      assertWritable(`${method} ${endpoint}`);
    }
    const logger = await getLogger();

    const requestOnce = async () => {
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        timeout: Number.isFinite(Number(options?.timeoutMs)) && Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : this.timeout,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
      };

      if (data) config.data = data;
      if (options?.params) config.params = options.params;

      const response = await axios(config);

      // Record success for monitoring
      await apiMonitor.recordSuccess();

      return response.data;
    };

    const isRetryableNetworkError = (err) => {
      const code = err?.code;
      const msg = (err?.message || '').toLowerCase();
      return (
        code === 'ECONNABORTED' || // axios timeout
        code === 'ETIMEDOUT' ||
        code === 'ECONNRESET' ||
        msg.includes('timeout')
      );
    };

    const retryCount = Math.max(0, Math.min(Number(options?.retryCount) || 0, 2));
    const retryDelayMs = Math.max(0, Math.min(Number(options?.retryDelayMs) || 250, 2000));

    try {
      return await requestOnce();
    } catch (error) {
      if (retryCount > 0 && isRetryableNetworkError(error)) {
        try {
          await new Promise((r) => setTimeout(r, retryDelayMs));
          return await requestOnce();
        } catch (retryError) {
          error = retryError;
        }
      }

      const status = error?.response?.status;

      // Prefer the backend's own error message (NestJS exception body: { statusCode, message, error })
      // over Axios's generic "Request failed with status code NNN" so callers can show/inspect the real reason.
      const backendMessage = error?.response?.data?.message;
      if (backendMessage) {
        error.message = Array.isArray(backendMessage) ? backendMessage.join(', ') : String(backendMessage);
      }

      const returnNullOnStatuses = options?.returnNullOnStatuses || [];
      const suppressWarnStatuses = options?.suppressWarnStatuses || [];
      const expectedStatuses = options?.expectedStatuses || [];

      // Some endpoints legitimately use 404 as a control-flow signal (e.g., profile not found
      // during onboarding). Treat these as a *reachable API* success for monitoring.
      if (status && returnNullOnStatuses.includes(status)) {
        await apiMonitor.recordSuccess();
        if (!suppressWarnStatuses.includes(status)) {
          logger.warn(`API request returned ${status}: ${endpoint}`);
        }
        return null;
      }

      // Some endpoints legitimately use non-2xx statuses as control-flow (e.g., cooldowns).
      // These should NOT trip API-down monitoring or warn-level logs.
      if (status && expectedStatuses.includes(status)) {
        await apiMonitor.recordSuccess();
        if (!suppressWarnStatuses.includes(status)) {
          logger.debug(`API request returned expected ${status}: ${endpoint}`);
        }
        throw error;
      }

      // Record failure for monitoring
      await apiMonitor.recordFailure(endpoint, error);

      // Tag connectivity-type failures so callers (ultimately the interactionCreate
      // handler in bot.js) can show players an "API unavailable" message instead of
      // a generic error, without every command needing to know the difference.
      error.apiUnavailable = this.shouldFallback(error);

      logger.warn(`API request failed: ${endpoint} - ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper for GET requests
   */
  async _get(endpoint, options = {}) {
    return this._request('GET', endpoint, null, options);
  }

  /**
   * Helper for POST requests
   */
  async _post(endpoint, data, options = {}) {
    return this._request('POST', endpoint, data, options);
  }

  /**
   * Helper for PATCH requests
   */
  async _patch(endpoint, data, options = {}) {
    return this._request('PATCH', endpoint, data, options);
  }

  /**
   * Helper for DELETE requests
   */
  async _delete(endpoint, options = {}) {
    return this._request('DELETE', endpoint, null, options);
  }

  /**
   * Determine if an API error means the backend is unreachable/erroring (as opposed
   * to a normal application error the backend returned on purpose). Used by:
   *  - this class, to tag error.apiUnavailable so the top-level interaction handler
   *    can show players a clear "service unavailable" message instead of a generic one.
   *  - a handful of API client modules (e.g. racingClient.js) that still compute a
   *    local fallback result rather than erroring out entirely.
   * @param {Error} error - The API error
   * @returns {boolean}
   */
  shouldFallback(error) {
    return (
      error.response?.status === 404 ||  // Endpoint not found
      error.response?.status === 500 ||  // Server error
      error.code === 'ECONNREFUSED' ||   // Connection refused
      error.code === 'ETIMEDOUT' ||      // Timeout
      error.code === 'ECONNABORTED' ||   // Axios timeout
      error.code === 'ECONNRESET' ||     // Socket hangup
      !error.response                    // Network error
    );
  }
}

module.exports = BaseAPIClient;


