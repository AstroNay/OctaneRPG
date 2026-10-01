const BaseAPIClient = require('../baseClient');
const { getLogger } = require('../../logging');
const apiMonitor = require('../apiMonitor');
const { getSupabaseClient } = require('../../supabase');

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
    const logger = await getLogger();
    logger.debug(`Using Supabase for guild leaderboard`);
    const sb = getSupabaseClient();
    let query = sb.from('players')
      .select('user_id, username, xp, level, coins, reputation, crew_tag, join_date, last_message_date')
      .eq('guild_id', guildId)
      .eq('is_banned', false);
    if (type === 'level') query = query.order('level', { ascending: false }).order('xp', { ascending: false });
    else if (type === 'coins') query = query.order('coins', { ascending: false });
    else if (type === 'xp') query = query.order('xp', { ascending: false });
    else query = query.order('reputation', { ascending: false });
    const { data, error: qErr } = await query;
    if (qErr) throw new Error('[supabase:players] getGuildLeaderboard: ' + qErr.message);
    return (data || []).map((r) => ({
      userId: r.user_id, username: r.username, xp: r.xp, level: r.level,
      coins: r.coins, reputation: r.reputation, crew: r.crew_tag,
      joinDate: r.join_date, lastMessageDate: r.last_message_date,
    }));
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
    const logger = await getLogger();
    logger.debug(`Using Supabase for guild statistics`);
    const sb = getSupabaseClient();
    const { data, error: qErr } = await sb.from('players')
      .select('user_id, username, coins, xp, daily_count, weekly_count')
      .eq('guild_id', guildId);
    if (qErr) throw new Error('[supabase:players] getGuildStatistics: ' + qErr.message);
    const rows = data || [];
    return {
      players: rows.map((r) => ({ userId: r.user_id, username: r.username })),
      playerCount: rows.length,
      totalCoins: rows.reduce((sum, r) => sum + (r.coins || 0), 0),
      totalXp: rows.reduce((sum, r) => sum + (r.xp || 0), 0),
      totalDailyCount: rows.reduce((sum, r) => sum + (r.daily_count || 0), 0),
      totalWeeklyCount: rows.reduce((sum, r) => sum + (r.weekly_count || 0), 0),
    };
  }

  async getTopGuilds(metric) {
    const logger = await getLogger();
    logger.debug(`Using Supabase for top guilds`);
    const sb = getSupabaseClient();

    const { data: guilds, error: gErr } = await sb.from('guild_settings').select('guild_id, guild_name');
    if (gErr) throw new Error('[supabase:guilds] getTopGuilds: ' + gErr.message);

    const guildStats = await Promise.all((guilds || []).map(async (guild) => {
      const { data: players } = await sb.from('players')
        .select('user_id, xp, coins')
        .eq('guild_id', guild.guild_id);

      const rows = players || [];
      const totalXp = rows.reduce((sum, r) => sum + (r.xp || 0), 0);
      const totalCoins = rows.reduce((sum, r) => sum + (r.coins || 0), 0);

      const { data: meets } = await sb.from('car_meets')
        .select('id')
        .eq('guild_id', guild.guild_id);
      const totalCarMeets = (meets || []).length;

      return { ...guild, totalXp, totalCoins, totalCarMeets, playerCount: rows.length };
    }));

    const metricMap = { xp: 'totalXp', coins: 'totalCoins', carmeets: 'totalCarMeets' };
    const sortField = metricMap[metric] || 'totalXp';
    return guildStats
      .filter(g => g[sortField] > 0)
      .sort((a, b) => b[sortField] - a[sortField])
      .slice(0, 10);
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
