const PlayerClient = require('./modules/playerClient');
const VehicleClient = require('./modules/vehicleClient');
const InventoryClient = require('./modules/inventoryClient');
const ChallengeClient = require('./modules/challengeClient');
const { RacingClient } = require('./modules/racingClient');
const GameConfigClient = require('./modules/gameConfigClient');
const GuildSettingsClient = require('./modules/guildSettingsClient');
const apiMonitor = require('./apiMonitor');

/**
 * Main GameAPI client - combines all modular clients
 * Provides backward compatibility with existing code
 */
class GameAPI {
  constructor() {
    this.player = new PlayerClient();
    this.players = this.player; // alias used in bot.js
    this.vehicle = new VehicleClient();
    this.inventory = new InventoryClient();
    this.challenge = new ChallengeClient();
    this.racing = new RacingClient();
    this.gameConfig = new GameConfigClient();
    this.guildSettings = new GuildSettingsClient();
  }

  // Backward compatibility - delegate to appropriate module
  // Player methods
  async getProfile(userId) { return this.player.getProfile(userId); }
  async getStreaks(userId) { return this.player.getStreaks(userId); }
  async updateProfile(userId, updates) { return this.player.updateProfile(userId, updates); }
  async deleteProfile(userId) { return this.player.deleteProfile(userId); }
  async giveXP(userId, amount, source) { return this.player.giveXP(userId, amount, source); }
  async giveCoins(userId, amount, reason) { return this.player.giveCoins(userId, amount, reason); }
  async updateReputation(userId, amount, source) { return this.player.updateReputation(userId, amount, source); }
  async bankDeposit(userId, amount) { return this.player.bankDeposit(userId, amount); }
  async bankWithdraw(userId, amount) { return this.player.bankWithdraw(userId, amount); }
  async getBankInfo(userId) { return this.player.getBankInfo(userId); }
  async updateStats(userId, statsUpdate) { return this.player.updateStats(userId, statsUpdate); }
  async getStats(userId) { return this.player.getStats(userId); }
  async updateSettings(userId, settingsUpdate) { return this.player.updateSettings(userId, settingsUpdate); }
  async getSettings(userId) { return this.player.getSettings(userId); }
  async getLeaderboard(type, limit) { return this.player.getLeaderboard(type, limit); }
  async getGuildLeaderboard(guildId, type) { return this.player.getGuildLeaderboard(guildId, type); }
  async getPlayerCount() { return this.player.getPlayerCount(); }
  async getGuildPlayers(guildId) { return this.player.getGuildPlayers(guildId); }
  async getGuildStatistics(guildId) { return this.player.getGuildStatistics(guildId); }
  async getTopGuilds(metric) { return this.player.getTopGuilds(metric); }
  async batchUpdateProfile(userId, updates) { return this.player.batchUpdateProfile(userId, updates); }
  async createProfileWithStarterVehicle(userId, guildId, username, profilePictureUrl, vehicleId) {
    return this.player.createProfileWithStarterVehicle(userId, guildId, username, profilePictureUrl, vehicleId);
  }
  async healthCheck() { return this.player.healthCheck(); }

  // Batch endpoints for optimized data retrieval
  async getPlayerDashboard(userId) { return this.player.getPlayerDashboard(userId); }
  async getVehicleGarage(userId) { return this.player.getVehicleGarage(userId); }

  // Vehicle methods
  async getBrowsableVehicles(playerLevel) { return this.vehicle.getBrowsableVehicles(playerLevel); }
  async getStarterVehicles() { return this.vehicle.getStarterVehicles(); }
  async getVehicle(vehicleId) { return this.vehicle.getVehicle(vehicleId); }
  async getGarage(userId) { return this.vehicle.getGarage(userId); }
  async getActiveVehicle(userId) { return this.vehicle.getActiveVehicle(userId); }
  async purchaseVehicle(userId, vehicleId, price) { return this.vehicle.purchaseVehicle(userId, vehicleId, price); }
  async sellVehicle(userId, playerVehicleId) { return this.vehicle.sellVehicle(userId, playerVehicleId); }
  async selectActiveVehicle(userId, playerVehicleId) { return this.vehicle.selectActiveVehicle(userId, playerVehicleId); }
  async refuelVehicle(userId, playerVehicleId, fuelType, fuelCost) { return this.vehicle.refuelVehicle(userId, playerVehicleId, fuelType, fuelCost); }
  async releaseImpoundedVehicle(userId, playerVehicleId) { return this.vehicle.releaseImpoundedVehicle(userId, playerVehicleId); }
  async getPlayerVehicles(userId) { return this.vehicle.getPlayerVehicles(userId); }
  async addVehicleToPlayer(userId, vehicleId) { return this.vehicle.addVehicleToPlayer(userId, vehicleId); }
  async installUpgrade(userId, playerVehicleId, partType) { return this.vehicle.installUpgrade(userId, playerVehicleId, partType); }

  // Inventory methods
  async getInventory(userId) { return this.player.getInventory(userId); }
  async addInventoryItem(userId, name, condition, category, value, quantity, options) {
    return this.inventory.addInventoryItem(userId, name, condition, category, value, quantity, options);
  }
  async removeInventoryItem(userId, itemName, quantity, options) {
    return this.inventory.removeInventoryItem(userId, itemName, quantity, options);
  }
  async searchJunkyard(userId, count) { return this.inventory.searchJunkyard(userId, count); }
  async drawLottery(userId, count) { return this.inventory.drawLottery(userId, count); }
  async calculateLotteryReward() { return this.inventory.calculateLotteryReward(); }
  async getStoreItems() { return this.inventory.getStoreItems(); }
  async getStoreItem(itemId) { return this.inventory.getStoreItem(itemId); }
  async purchaseStoreItem(userId, itemId, quantity) { return this.inventory.purchaseStoreItem(userId, itemId, quantity); }
  async getActiveBoosters(userId) { return this.inventory.getActiveBoosters(userId); }
  async activateBooster(userId, boosterType, duration) { return this.inventory.activateBooster(userId, boosterType, duration); }

  // Challenge methods
  async getChallenges(userId) { return this.challenge.getChallenges(userId); }
  async getAllChallenges() { return this.challenge.getAllChallenges(); }
  async getAllChallengesWithProgress(userId) { return this.challenge.getAllChallengesWithProgress(userId); }
  async getChallengesByCategory(category) { return this.challenge.getChallengesByCategory(category); }
  async getCompletedChallenges(userId) { return this.challenge.getCompletedChallenges(userId); }
  async updateChallengeProgress(userId, challengeId, progressIncrement, completed) {
    return this.challenge.updateChallengeProgress(userId, challengeId, progressIncrement, completed);
  }
  async updateChallengeByType(userId, challengeType, progressIncrement) { return this.challenge.updateChallengeByType(userId, challengeType, progressIncrement); }
  async claimDaily(userId) { return this.challenge.claimDaily(userId); }
  async claimWeekly(userId) { return this.challenge.claimWeekly(userId); }
  async claimAFK(userId) { return this.player.claimAFK(userId); }
  async checkCooldown(userId, actionType) { return this.challenge.checkCooldown(userId, actionType); }
  async getAllCooldowns(userId) { return this.challenge.getAllCooldowns(userId); }

  // Scrap methods
  async scrapParts(userId) { return this.player.scrapParts(userId); }
  async scrapExtraParts(userId) { return this.player.scrapExtraParts(userId); }

  // Practice race
  async practiceRace(userId, opponentUserId) { return this.player.practiceRace(userId, opponentUserId); }

  // Racing methods
  async getVehicleStats(userId, vehicleId = null) { return this.racing.getVehicleStats(userId, vehicleId); }
  async generateAIOpponents(aiPower, level, count) { return this.racing.generateAIOpponents(aiPower, level, count); }
  async simulateRace(vehicles, trackId, weather) { return this.racing.simulateRace(vehicles, trackId, weather); }
  async updateRaceStats(userId, level, fuelCost, position) { return this.racing.updateRaceStats(userId, level, fuelCost, position); }
  async getTrackByLevel(level) { return this.racing.getTrackByLevel(level); }
  async getWeatherCondition(trackType) { return this.racing.getWeatherCondition(trackType); }

  // Game config (global gameplay tunables)
  async getGameConfig() { return this.gameConfig.getGameConfig(); }

  // Guild settings (guild metadata + bot config)
  async upsertGuildSettings(payload) { return this.guildSettings.upsertGuildSettings(payload); }
  async getGuildSettings(guildId) { return this.guildSettings.getGuildSettings(guildId); }

  // API Status
  getAPIStatus() {
    return apiMonitor.getStatus();
  }
}

module.exports = { GameAPI, apiMonitor };

