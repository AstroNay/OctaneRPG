const BaseAPIClient = require('../baseClient');
const { getLogger } = require('../../logging');

class InventoryClient extends BaseAPIClient {
  async getInventory(userId) {
    try {
      return await this._get(`/players/${userId}/inventory`);
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for inventory ${userId}`);
      throw error;
    }
  }

  async addInventoryItem(userId, name, condition, category, value = 0, quantity = 1, options = {}) {
    try {
      return await this._post(`/players/${userId}/inventory`, {
        name, condition, category, value, quantity,
        ...(options?.reason ? { reason: String(options.reason) } : {}),
        ...(options?.source ? { source: String(options.source) } : {}),
      });
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for add inventory ${userId}`);
      throw error;
    }
  }

  async removeInventoryItem(userId, itemName, quantity = 1, options = {}) {
    try {
      const params = new URLSearchParams({ quantity: String(quantity) });
      if (options?.reason) params.set('reason', String(options.reason));
      if (options?.source) params.set('source', String(options.source));
      if (options?.condition) params.set('condition', String(options.condition));
      return await this._delete(`/players/${userId}/inventory/${encodeURIComponent(itemName)}?${params.toString()}`);
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for remove inventory ${userId}`);
      throw error;
    }
  }

  async searchJunkyard(userId, count = 1) {
    try {
      return await this._post(`/car-parts/junkyard/${userId}`, { count });
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for junkyard ${userId}`);
      throw error;
    }
  }

  async drawLottery(userId, count = 1) {
    try {
      return await this._post(`/lottery/draw/${userId}`, { count });
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for lottery ${userId}`);
      throw error;
    }
  }

  async getStoreItems() {
    try {
      return await this._get('/store/items');
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for store items`);
      throw error;
    }
  }

  async getStoreItem(itemId) {
    try {
      return await this._get(`/store/items/${itemId}`);
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for store item ${itemId}`);
      throw error;
    }
  }

  async purchaseStoreItem(userId, itemId, quantity = 1) {
    try {
      return await this._post(`/store/purchase/${userId}`, { itemId, quantity });
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for store purchase ${userId}`);
      throw error;
    }
  }

  async getActiveBoosters(userId) {
    try {
      return await this._get(`/players/${userId}/boosters`);
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for active boosters ${userId}`);
      throw error;
    }
  }

  async activateBooster(userId, boosterType, duration = 24) {
    try {
      return await this._post(`/players/${userId}/booster`, { boosterType, duration });
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for activate booster ${userId}`);
      throw error;
    }
  }
}

module.exports = InventoryClient;
