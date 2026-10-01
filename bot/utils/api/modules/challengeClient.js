const BaseAPIClient = require('../baseClient');
const { getLogger } = require('../../logging');

class ChallengeClient extends BaseAPIClient {
  async getChallenges(userId) {
    return await this._get(`/challenges/${userId}`);
  }

  async getAllChallenges() {
    return await this._get('/challenges');
  }

  async getAllChallengesWithProgress(userId) {
    return await this._get(`/challenges/user/${userId}/all`);
  }

  async getChallengesByCategory(category) {
    return await this._get(`/challenges/category/${category}`);
  }

  async getCompletedChallenges(userId) {
    return await this._get(`/challenges/${userId}/completed`);
  }

  async updateChallengeProgress(userId, challengeId, progressIncrement = 1, completed = false) {
    return await this._patch(`/challenges/${userId}/progress`, {
      challengeId,
      progressIncrement,
      completed
    });
  }

  async updateChallengeByType(userId, challengeType, progressIncrement = 1) {
    return await this._post(`/challenges/user/${userId}/type`, {
      challengeType: challengeType,
      progressIncrement: progressIncrement,
    });
  }

  async claimDaily(userId) {
    return await this._post(`/players/${userId}/daily`, {}, { timeoutMs: 10000, retryCount: 1, retryDelayMs: 250 });
  }

  async claimWeekly(userId) {
    return await this._post(`/players/${userId}/weekly`, {}, { timeoutMs: 10000, retryCount: 1, retryDelayMs: 250 });
  }

  async checkCooldown(userId, actionType) {
    return await this._get(`/players/${userId}/cooldowns/${actionType}`);
  }

  async getAllCooldowns(userId) {
    return await this._get(`/players/${userId}/cooldowns`);
  }
}

module.exports = ChallengeClient;
