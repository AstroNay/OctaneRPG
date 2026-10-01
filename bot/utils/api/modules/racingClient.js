const BaseAPIClient = require('../baseClient');
const { DateTime } = require('luxon');
const { getLogger } = require('../../logging');

class RacingClient extends BaseAPIClient {
    constructor() {
        super();
    }

    /**
     * Get vehicle stats (stock + upgrades + blessings)
     * @param {string} userId - User ID
     * @param {string} vehicleId - Optional vehicle ID (defaults to active vehicle)
     * @returns {Promise<Object>} Vehicle stats object
     */
    async getVehicleStats(userId, vehicleId = null) {
        try {
            const payload = { userId };
            if (vehicleId) payload.vehicleId = vehicleId;
            const response = await this._post('/racing/stats', payload);
            return response;
        } catch (error) {
            if (this.shouldFallback(error)) {
                return this._getVehicleStatsFallback(userId, vehicleId);
            }
            throw error;
        }
    }

    async _getVehicleStatsFallback(userId, vehicleId) {
        const logger = await getLogger();
        logger.error(`API unavailable for vehicle stats ${userId}`);
        throw new Error('Racing API unavailable');
    }

    /**
     * Generate AI opponents for a race
     * @param {number} aiPower - Target power level for AI
     * @param {number} level - Race level
     * @param {number} count - Number of AI opponents
     * @returns {Promise<Array>} AI vehicle array
     */
    async generateAIOpponents(aiPower, level, count) {
        try {
            const response = await this._get(`/racing/ai-opponents?power=${aiPower}&level=${level}&count=${count}`);
            return response;
        } catch (error) {
            if (this.shouldFallback(error)) {
                return this._generateAIOpponentsFallback(aiPower, level, count);
            }
            throw error;
        }
    }

    async _generateAIOpponentsFallback(aiPower, level, count) {
        const logger = await getLogger();
        logger.error(`API unavailable for AI opponents level=${level}`);
        throw new Error('Racing API unavailable');
    }

    /**
     * Simulate a race
     * @param {Array} vehicles - Array of vehicle objects
     * @param {number} trackId - Track ID
     * @param {string} weather - Weather condition
     * @returns {Promise<Array>} Race results sorted by power
     */
    async simulateRace(vehicles, trackId, weather) {
        try {
            const response = await this._post('/racing/simulate', { vehicles, trackId, weather });
            return response;
        } catch (error) {
            if (this.shouldFallback(error)) {
                return this._simulateRaceFallback(vehicles, trackId, weather);
            }
            throw error;
        }
    }

    async _simulateRaceFallback(vehicles, trackId, weather) {
        const logger = await getLogger();
        logger.error(`API unavailable for race simulation track=${trackId}`);
        throw new Error('Racing API unavailable');
    }

    /**
     * Update race statistics for a player
     * @param {string} userId - User ID
     * @param {number} level - Race level
     * @param {number} fuelCost - Fuel cost for the race
     * @param {number} position - Final position (0 = 1st place)
     * @returns {Promise<Object>} Updated race stats
     */
    async updateRaceStats(userId, level, fuelCost, position) {
        try {
            const response = await this._post('/racing/update-stats', { userId, level, fuelCost, position });
            return response;
        } catch (error) {
            if (this.shouldFallback(error)) {
                return this._updateRaceStatsFallback(userId, level, fuelCost, position);
            }
            throw error;
        }
    }

    async _updateRaceStatsFallback(userId, level, fuelCost, position) {
        const logger = await getLogger();
        logger.error(`API unavailable for race stats update ${userId}`);
        throw new Error('Racing API unavailable');
    }

    /**
     * Get track by level
     * @param {number} level - Player level
     * @returns {Promise<Object>} Track object
     */
    async getTrackByLevel(level) {
        try {
            const response = await this._get(`/tracks/level/${level}`);
            return response;
        } catch (error) {
            if (this.shouldFallback(error)) {
                return this._getTrackByLevelFallback(level);
            }
            throw error;
        }
    }

    async _getTrackByLevelFallback(level) {
        const logger = await getLogger();
        logger.error(`API unavailable for track by level ${level}`);
        throw new Error('Racing API unavailable');
    }

    /**
     * Get weather condition
     * @param {string} trackType - Track type
     * @returns {Promise<Object>} Weather object
     */
    async getWeatherCondition(trackType) {
        try {
            const response = await this._get(`/racing/weather/${trackType}`);
            return response.weather;
        } catch (error) {
            if (this.shouldFallback(error)) {
                return this._getWeatherConditionFallback(trackType);
            }
            throw error;
        }
    }

    _getWeatherConditionFallback(trackType) {
        const conditions = ['Clear', 'Rain', 'Snow', 'Windy'];
        let baseWeights = [0.75, 0.15, 0.0, 0.05];

        if (trackType === 'Offroad') {
            baseWeights = [0.6, 0.25, 0.1, 0.05];
        } else if (trackType === 'Speedway') {
            baseWeights = [0.8, 0.1, 0.05, 0.05];
        } else if (trackType === 'Hillclimb') {
            baseWeights = [0.7, 0.2, 0.05, 0.05];
        }

        const total = baseWeights.reduce((sum, w) => sum + (w > 0 ? w : 0), 0);
        if (total <= 0) return 'Clear';

        const r = Math.random() * total;
        let cumulative = 0;
        for (let i = 0; i < conditions.length; i++) {
            cumulative += baseWeights[i] > 0 ? baseWeights[i] : 0;
            if (r <= cumulative) return conditions[i];
        }

        return 'Clear';
    }
}

module.exports = { RacingClient };



