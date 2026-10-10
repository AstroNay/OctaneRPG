const BaseAPIClient = require('../baseClient');
const { getLogger } = require('../../logging');
const apiMonitor = require('../apiMonitor');

class GuildSettingsClient extends BaseAPIClient {
  async upsertGuildSettings(payload) {
    try {
      return await this._post('/guild-settings/upsert', payload);
    } catch (error) {
      await apiMonitor.recordFailure('guildSettingsClient.upsertGuildSettings', error);
      const logger = await getLogger();
      logger.error(`API unavailable for guild settings upsert ${payload?.guildId || ''}`);
      throw error;
    }
  }

  async getGuildSettings(guildId) {
    try {
      return await this._get(`/guild-settings/${guildId}`);
    } catch (error) {
      await apiMonitor.recordFailure('guildSettingsClient.getGuildSettings', error);
      const logger = await getLogger();
      logger.error(`API unavailable for guild settings ${guildId}`);
      throw error;
    }
  }

  async deleteGuildSettings(guildId) {
    try {
      return await this._delete(`/guild-settings/${guildId}`);
    } catch (error) {
      await apiMonitor.recordFailure('guildSettingsClient.deleteGuildSettings', error);
      throw error;
    }
  }
}

module.exports = GuildSettingsClient;
