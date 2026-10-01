/**
 * Supabase -- players table adapter
 *
 * Player profile operations against Supabase/PostgreSQL.
 *
 * Tables: players, player_settings, player_stats, player_bank
 */

const { getSupabaseClient } = require('../client');
const { getLogger } = require('../../logging');

// ---- Reads ----------------------------------------------------------------

async function getPlayer(userId) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('players')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error('[supabase:players] getPlayer: ' + error.message);
  return data;
}

async function getPlayerFull(userId) {
  const sb = getSupabaseClient();
  const [pRes, sRes, stRes, bRes] = await Promise.all([
    sb.from('players').select('*').eq('user_id', userId).maybeSingle(),
    sb.from('player_settings').select('*').eq('user_id', userId).maybeSingle(),
    sb.from('player_stats').select('*').eq('user_id', userId).maybeSingle(),
    sb.from('player_bank').select('*').eq('user_id', userId).maybeSingle(),
  ]);
  for (const r of [pRes, sRes, stRes, bRes]) {
    if (r.error) throw new Error('[supabase:players] getPlayerFull: ' + r.error.message);
  }
  return { player: pRes.data, settings: sRes.data, stats: stRes.data, bank: bRes.data };
}

// ---- Writes ---------------------------------------------------------------

async function upsertPlayer(userId, fields) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('players')
    .upsert({ user_id: userId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select()
    .maybeSingle();
  if (error) throw new Error('[supabase:players] upsertPlayer: ' + error.message);
  return data;
}

/** Map camelCase field names to SQL snake_case column names */
const COLUMN_MAP = {
  coins: 'coins', xp: 'xp', level: 'level',
  lastCachedXp: 'last_cached_xp', lastAFKClaim: 'last_afk_claim',
  lastXpTime: 'last_xp_time', lastDaily: 'last_daily', lastWeekly: 'last_weekly',
  lastWorkTime: 'last_work_time', lastLotteryPlay: 'last_lottery_play',
  lastRefuel: 'last_refuel', lastCrewDonation: 'last_crew_donation',
  crew: 'crew', crewTokens: 'crew_tokens',
  dailyCount: 'daily_count', weeklyCount: 'weekly_count',
  workCount: 'work_count', lotteryCount: 'lottery_count',
  feastSupplies: 'feast_supplies', lastFeastRun: 'last_feast_run',
  reputation: 'reputation', heatLevel: 'heat_level', heatLevelTime: 'heat_level_time',
  heatLevelMax: 'heat_level_max', heatLevelMaxTime: 'heat_level_max_time',
  shrineXP: 'shrine_xp', prestigeLevel: 'prestige_level', prestigeTokens: 'prestige_tokens',
  job: 'job', junkyardVisits: 'junkyard_visits', lastJunkyardVisit: 'last_junkyard_visit',
  retiredStats: 'retired_stats', activeVehicleId: 'active_vehicle_id',
  isBanned: 'is_banned', banUntil: 'ban_until', banReason: 'ban_reason',
  lastBannedAt: 'last_banned_at', lastUnbannedAt: 'last_unbanned_at',
  username: 'username', guildId: 'guild_id',
};

async function updatePlayer(userId, updates) {
  const sb = getSupabaseClient();
  const now = new Date().toISOString();
  const sqlFields = { updated_at: now };
  for (const [k, v] of Object.entries(updates)) {
    const col = COLUMN_MAP[k];
    if (col) sqlFields[col] = v instanceof Date ? v.toISOString() : v;
  }
  if (Object.keys(sqlFields).length <= 1) return null;
  const { data, error } = await sb.from('players').update(sqlFields).eq('user_id', userId).select().maybeSingle();
  if (error) throw new Error('[supabase:players] updatePlayer: ' + error.message);
  return data;
}

module.exports = { getPlayer, getPlayerFull, upsertPlayer, updatePlayer };
