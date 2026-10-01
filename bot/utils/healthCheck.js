const { ChallengeValidator } = require('./challengeValidator');
const { getLogger } = require('./logging');
const { GameAPI } = require('./api/index');
const { getSupabaseClient } = require('./supabase');
const { isReadOnlyMode } = require('./readOnly');

/**
 * Check if API is reachable and responding
 */
async function checkAPIConnection() {
  const logger = await getLogger();
  const apiUrl = process.env.API_URL || 'http://localhost:3000';

  try {
    logger.debug(`🔌 Checking API connection...`);
    const api = new GameAPI();
    const result = await api.healthCheck();

    if (result && result.status === 'ok') {
      logger.info(`✅ API Connection: Connected`);
      logger.debug(`   Database: ${result.database || 'unknown'}`);
      logger.debug(`   Uptime: ${result.uptime || 'unknown'}`);
      if (result.memory) {
        logger.debug(`   Memory: ${result.memory.heapUsed} heap, ${result.memory.rss} total`);
      }
      return { connected: true, url: apiUrl };
    } else {
      logger.warn(`⚠️ API Connection: Unexpected response from API`);
      logger.warn(`   Expected: { status: 'ok', ... }`);
      logger.warn(`   Received: ${JSON.stringify(result)}`);
      logger.warn(`📌 Bot will use Supabase fallbacks for all operations`);
      return { connected: false, error: 'Unexpected response format', response: result };
    }
  } catch (error) {
    logger.error(`❌ API Connection Failed: ${error.message}`);
    if (error.code) {
      logger.error(`   Error Code: ${error.code}`);
    }
    if (error.response) {
      logger.error(`   Status: ${error.response.status}`);
      logger.error(`   Response: ${JSON.stringify(error.response.data)}`);
    }
    logger.warn(`📌 Bot will use Supabase fallbacks for all operations`);
    return { connected: false, error: error.message };
  }
}

/**
 * Startup health check to ensure database integrity
 * Run this before bot starts to prevent crashes
 */
async function performStartupHealthCheck() {
  const logger = await getLogger();
  logger.info('🔍 Starting database health check...');

  try {
    // Check API connection first
    const apiStatus = await checkAPIConnection();

    let fixedProfiles = 0;
    let totalCorrupted = 0;

    // The integrity scan rewrites player rows, which read-only mode must never do.
    if (isReadOnlyMode()) {
      logger.info('✅ Health check complete: READONLY_MODE on, skipped data integrity scan');
      return { success: true, fixedProfiles, totalCorrupted, apiConnected: apiStatus.connected };
    }

    // Check all profiles for corrupted challenge data via Supabase
    const sb = getSupabaseClient();
    const { data: profiles, error } = await sb
      .from('players')
      .select('user_id, challenges');
    if (error) throw new Error('healthCheck: players query failed: ' + error.message);

    logger.info(`Checking ${(profiles || []).length} profiles for data integrity...`);

    for (const profile of (profiles || [])) {
      if (profile.challenges && Array.isArray(profile.challenges) && profile.challenges.length > 0) {
        const originalCount = profile.challenges.length;
        const cleanChallenges = await ChallengeValidator.sanitizeChallengeData(profile.challenges);

        if (cleanChallenges.length < originalCount) {
          const removed = originalCount - cleanChallenges.length;
          totalCorrupted += removed;
          fixedProfiles++;

          logger.info(`🔧 Cleaning ${removed} corrupted challenges from profile ${profile.user_id}`);

          await sb
            .from('players')
            .update({ challenges: cleanChallenges })
            .eq('user_id', profile.user_id);
        }
      }
    }

    if (fixedProfiles > 0) {
      logger.info(`✅ Health check complete: Fixed ${fixedProfiles} profiles, removed ${totalCorrupted} corrupted challenges`);
    } else {
      logger.info('✅ Health check complete: No issues found');
    }

    return { success: true, fixedProfiles, totalCorrupted, apiConnected: apiStatus.connected };

  } catch (error) {
    logger.error(`❌ Health check failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Emergency profile repair for specific user
 */
async function emergencyProfileRepair(userId) {
  const logger = await getLogger();
  logger.warn(`🚨 Emergency repair for profile ${userId}`);

  try {
    const sb = getSupabaseClient();
    await sb
      .from('players')
      .update({ challenges: [] })
      .eq('user_id', userId);

    logger.info(`✅ Emergency repair complete for ${userId}`);
    return { success: true };

  } catch (error) {
    logger.error(`❌ Emergency repair failed for ${userId}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

module.exports = {
  performStartupHealthCheck,
  emergencyProfileRepair
};
