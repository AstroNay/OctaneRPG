const BaseAPIClient = require('../baseClient');
const { getLogger } = require('../../logging');
const apiMonitor = require('../apiMonitor');

class PlayerClient extends BaseAPIClient {
  // Profile CRUD
  async getProfile(userId) {
    try {
      return await this._get(`/players/${userId}`, {
        returnNullOnStatuses: [404],
        suppressWarnStatuses: [404],
      });
    } catch (error) {
      await apiMonitor.recordFailure('playerClient.getProfile', error);
      const logger = await getLogger();
      logger.error(`API unavailable for profile ${userId}`);
      throw error;
    }
  }

  async getStreaks(userId) {
    try {
      return await this._get(`/players/${userId}/streaks`);
    } catch (error) {
      await apiMonitor.recordFailure('playerClient.getStreaks', error);
      const logger = await getLogger();
      logger.error(`API unavailable for streaks ${userId}`);
      throw error;
    }
  }

  async updateProfile(userId, updates) {
    try {
      return await this._patch(`/players/${userId}`, updates);
    } catch (error) {
      await apiMonitor.recordFailure('playerClient.updateProfile', error);
      const logger = await getLogger();
      logger.error(`API unavailable for profile update ${userId}`);
      throw error;
    }
  }

  async deleteProfile(userId) {
    try {
      return await this._delete(`/players/${userId}`);
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for profile deletion ${userId}`);
      throw error;
    }
  }

  async createProfileWithStarterVehicle(userId, guildId, username, profilePictureUrl, vehicleId) {
    try {
      return await this._post('/players', { userId, guildId, username, profilePictureUrl, vehicleId });
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for profile creation ${userId}`);
      throw error;
    }
  }

  // Player Resources
  async giveXP(userId, amount, source = 'unknown') {
    return await this._post(`/players/${userId}/xp`, { amount, source });
  }

  async giveCoins(userId, amount, reason = 'unknown') {
    try {
      return await this._post(`/players/${userId}/coins`, { amount, reason });
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for giveCoins ${userId} — not falling back to DB for write`);
      throw error;
    }
  }

  async updateReputation(userId, amount, source = 'unknown') {
    try {
      return await this._post(`/players/${userId}/reputation`, { amount, source });
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for reputation update ${userId}`);
      throw error;
    }
  }

  async claimAFK(userId) {
    return await this._post(`/players/${userId}/afk`, {}, {
      expectedStatuses: [400],
      suppressWarnStatuses: [400],
    });
  }

  // Bank operations
  async bankDeposit(userId, amount) {
    try {
      return await this._post(`/players/${userId}/bank/deposit`, { amount });
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for bank deposit ${userId}`);
      throw error;
    }
  }

  async bankWithdraw(userId, amount) {
    try {
      return await this._post(`/players/${userId}/bank/withdraw`, { amount });
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for bank withdraw ${userId}`);
      throw error;
    }
  }

  async getBankInfo(userId) {
    try {
      return await this._get(`/players/${userId}/bank`);
    } catch (error) {
      await apiMonitor.recordFailure('playerClient.getBankInfo', error);
      const logger = await getLogger();
      logger.error(`API unavailable for bank info ${userId}`);
      throw error;
    }
  }

  // Stats & Settings
  async updateStats(userId, statsUpdate) {
    try {
      return await this._patch(`/players/${userId}/stats`, statsUpdate);
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for stats update ${userId}`);
      throw error;
    }
  }

  async getStats(userId) {
    try {
      return await this._get(`/players/${userId}/stats`);
    } catch (error) {
      await apiMonitor.recordFailure('playerClient.getStats', error);
      const logger = await getLogger();
      logger.error(`API unavailable for stats ${userId}`);
      throw error;
    }
  }

  async updateSettings(userId, settingsUpdate) {
    try {
      return await this._patch(`/players/${userId}/settings`, settingsUpdate);
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for settings update ${userId}`);
      throw error;
    }
  }

  async getSettings(userId) {
    try {
      return await this._get(`/players/${userId}/settings`);
    } catch (error) {
      await apiMonitor.recordFailure('playerClient.getSettings', error);
      const logger = await getLogger();
      logger.error(`API unavailable for settings ${userId}`);
      throw error;
    }
  }

  // Leaderboards
  async getLeaderboard(type = 'level', limit = 10) {
    try {
      return await this._get(`/players?type=${type}&limit=${limit}`);
    } catch (error) {
      await apiMonitor.recordFailure('playerClient.getLeaderboard', error);
      const logger = await getLogger();
      logger.error(`API unavailable for leaderboard`);
      throw error;
    }
  }

  async getGuildLeaderboard(guildId, type = 'level') {
    try {
      return await this._get(`/guild-stats/${guildId}/leaderboard?type=${encodeURIComponent(type)}`);
    } catch (error) {
      await apiMonitor.recordFailure('playerClient.getGuildLeaderboard', error);
      throw error;
    }
  }

  async getPlayerCount() {
    try {
      const response = await this._get('/players/count');
      return response.count;
    } catch (error) {
      await apiMonitor.recordFailure('playerClient.getPlayerCount', error);
      const logger = await getLogger();
      logger.error(`API unavailable for player count`);
      throw error;
    }
  }

  async getGuildPlayers(guildId) {
    try {
      return await this._get(`/players/guild/${guildId}`);
    } catch (error) {
      await apiMonitor.recordFailure('playerClient.getGuildPlayers', error);
      const logger = await getLogger();
      logger.error(`API unavailable for guild players ${guildId}`);
      throw error;
    }
  }

  async getGuildStatistics(guildId) {
    try {
      return await this._get(`/guild-stats/${guildId}`);
    } catch (error) {
      await apiMonitor.recordFailure('playerClient.getGuildStatistics', error);
      throw error;
    }
  }

  async getTopGuilds(metric) {
    try {
      return await this._get(`/guild-stats/top?metric=${encodeURIComponent(metric || 'xp')}`);
    } catch (error) {
      await apiMonitor.recordFailure('playerClient.getTopGuilds', error);
      throw error;
    }
  }

  /** Total race wins and losses across a player's vehicles. */
  async getRaceRecord(userId) {
    try {
      return await this._get(`/guild-stats/record/${userId}`);
    } catch (error) {
      await apiMonitor.recordFailure('playerClient.getRaceRecord', error);
      throw error;
    }
  }

  async getInventory(userId) {
    try {
      return await this._get(`/players/${userId}/inventory`);
    } catch (error) {
      await apiMonitor.recordFailure('playerClient.getInventory', error);
      const logger = await getLogger();
      logger.error(`API unavailable for inventory ${userId}`);
      throw error;
    }
  }

  async getAllCooldowns(userId) {
    try {
      return await this._get(`/players/${userId}/cooldowns`);
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for cooldowns ${userId}`);
      throw error;
    }
  }

  async batchUpdateProfile(userId, updates) {
    try {
      return await this._patch(`/players/${userId}/batch`, updates);
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for batch update ${userId}`);
      throw error;
    }
  }

  async getPlayerDashboard(userId) {
    const logger = await getLogger();
    try {
      return await this._get(`/players/batch/player-dashboard/${userId}`);
    } catch (error) {
      logger.debug(`API fallback to individual calls for player dashboard ${userId}`);
      const profile = await this.getProfile(userId);
      const vehicles = await this.getPlayerVehicles(userId);
      return { profile, vehicles, hasData: true };
    }
  }

  async getVehicleGarage(userId) {
    const logger = await getLogger();
    try {
      return await this._get(`/players/batch/vehicle-garage/${userId}`);
    } catch (error) {
      logger.debug(`API fallback to individual calls for vehicle garage ${userId}`);
      const [profile, vehicles] = await Promise.all([
        this.getProfile(userId),
        this.getPlayerVehicles(userId),
      ]);
      return { ...profile, vehicles };
    }
  }

  async healthCheck() {
    try {
      return await this._get('/health');
    } catch (error) {
      return { status: 'down', error: error.message };
    }
  }

  async scrapParts(userId) {
    try {
      return await this._post(`/players/${userId}/scrap`);
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for scrap ${userId}`);
      throw error;
    }
  }

  async scrapExtraParts(userId) {
    try {
      return await this._post(`/players/${userId}/extrascrap`);
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for extrascrap ${userId}`);
      throw error;
    }
  }

  async practiceRace(userId, opponentUserId) {
    try {
      return await this._post(`/players/${userId}/practice`, { opponentUserId });
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for practice race ${userId}`);
      throw error;
    }
  }
}

module.exports = PlayerClient;
