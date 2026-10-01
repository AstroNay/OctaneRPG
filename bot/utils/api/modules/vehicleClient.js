const BaseAPIClient = require('../baseClient');
const { getLogger } = require('../../logging');
const { tables } = require('../../supabase');
const { mapPlayerVehicleRow } = require('../../supabase/mappers');

class VehicleClient extends BaseAPIClient {
  async getBrowsableVehicles(playerLevel = null) {
    try {
      const params = playerLevel ? `?maxLevel=${playerLevel}` : '';
      return await this._get(`/vehicles${params}`);
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for browsable vehicles`);
      throw error;
    }
  }

  async getStarterVehicles() {
    try {
      return await this._get('/vehicles/starters');
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for starter vehicles`);
      throw error;
    }
  }

  async getVehicle(vehicleId) {
    try {
      return await this._get(`/vehicles/${vehicleId}`);
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for vehicle ${vehicleId}`);
      throw error;
    }
  }

  async getGarage(userId) {
    try {
      return await this._get(`/players/${userId}/vehicles`);
    } catch (error) {
      const logger = await getLogger();
      logger.warn(`API fallback to Supabase for garage ${userId}`);
      const rows = await tables.playerVehicles.getPlayerVehicles(userId);
      return (rows || []).map(mapPlayerVehicleRow);
    }
  }

  async getActiveVehicle(userId) {
    try {
      const response = await this._get(`/players/${userId}/vehicles`);
      if (response && response.vehicles) {
        return response.vehicles.find(v => v.isActive === true) || null;
      }
      return null;
    } catch (error) {
      const logger = await getLogger();
      logger.warn(`API fallback to Supabase for active vehicle ${userId}`);
      const row = await tables.playerVehicles.getActiveVehicle(userId);
      return mapPlayerVehicleRow(row);
    }
  }

  async purchaseVehicle(userId, vehicleId, price) {
    try {
      return await this._post(`/players/${userId}/vehicles/purchase`, { vehicleId, price });
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for vehicle purchase ${userId}`);
      throw error;
    }
  }

  async sellVehicle(userId, playerVehicleId) {
    try {
      return await this._delete(`/players/${userId}/vehicles/${playerVehicleId}`);
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for vehicle sale ${userId}`);
      throw error;
    }
  }

  async selectActiveVehicle(userId, playerVehicleId) {
    try {
      return await this._post(`/players/${userId}/vehicles/${playerVehicleId}/select`);
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for vehicle selection ${userId}`);
      throw error;
    }
  }

  async refuelVehicle(userId, playerVehicleId, fuelType, fuelCost) {
    try {
      return await this._post(`/players/${userId}/vehicles/${playerVehicleId}/refuel`, { fuelType, fuelCost });
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for vehicle refuel ${userId}`);
      throw error;
    }
  }

  async releaseImpoundedVehicle(userId, playerVehicleId) {
    try {
      return await this._post(`/vehicles/garage/${userId}/${playerVehicleId}/release`);
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for vehicle release ${userId}`);
      throw error;
    }
  }

  async getPlayerVehicles(userId) {
    try {
      return await this._get(`/players/${userId}/vehicles`);
    } catch (error) {
      const logger = await getLogger();
      logger.warn(`API fallback to Supabase for player vehicles ${userId}`);
      const rows = await tables.playerVehicles.getPlayerVehicles(userId);
      return (rows || []).map(mapPlayerVehicleRow);
    }
  }

  async addVehicleToPlayer(userId, vehicleId) {
    try {
      return await this._post(`/players/${userId}/vehicles`, { vehicleId });
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for add vehicle ${userId}`);
      throw error;
    }
  }

  async installUpgrade(userId, playerVehicleId, partType) {
    try {
      return await this._post(`/players/${userId}/vehicles/${playerVehicleId}/upgrade`, { partType });
    } catch (error) {
      const logger = await getLogger();
      logger.error(`API unavailable for install upgrade ${userId}`);
      throw error;
    }
  }
}

module.exports = VehicleClient;
