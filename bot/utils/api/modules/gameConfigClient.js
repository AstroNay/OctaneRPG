const BaseAPIClient = require('../baseClient');

class GameConfigClient extends BaseAPIClient {
  async getGameConfig() {
    return await this._get('/game-config');
  }
}

module.exports = GameConfigClient;
