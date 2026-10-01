const { getLogger } = require('./logging');

class ChallengeValidator {

  static async validateChallengeType(challengeType) {
    if (!challengeType || typeof challengeType !== 'string') {
      return false;
    }
    const validFormat = /^[a-zA-Z0-9_]+$/.test(challengeType);
    return validFormat;
  }

  static async validateChallengeId(challengeId) {
    if (challengeId === null || challengeId === undefined || challengeId === '') return false;
    return true;
  }
  
  static async sanitizeChallengeData(challengeData) {
    if (!challengeData || !Array.isArray(challengeData)) {
      return [];
    }
    
    const validChallenges = [];
    
    for (const challenge of challengeData) {
      if (await this.validateChallengeId(challenge.challengeId)) {
        validChallenges.push(challenge);
      } else {
        const logger = await getLogger();
        logger.warn(`Removing invalid challenge with ID: ${challenge.challengeId}`);
      }
    }
    
    return validChallenges;
  }
  
  static async safeUpdateChallenge(profile, challengeType) {
    const logger = await getLogger();
    
    try {
      // Validate challenge type first
      if (!await this.validateChallengeType(challengeType)) {
        logger.warn(`Invalid challenge type: ${challengeType}`);
        return { success: false, reason: 'Invalid challenge type' };
      }
      
      // Sanitize existing challenges before updating
      if (profile.challenges) {
        profile.challenges = await this.sanitizeChallengeData(profile.challenges);
      }
      
      // Only proceed if profile is in a clean state
      return { success: true };
      
    } catch (error) {
      logger.error(`Challenge validation failed: ${error.message}`);
      return { success: false, reason: error.message };
    }
  }
}

module.exports = { ChallengeValidator };

