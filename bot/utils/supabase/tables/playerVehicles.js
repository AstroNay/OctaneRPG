/**
 * Supabase -- player_vehicles + player_vehicle_upgrades table adapter
 *
 * Player vehicle operations against Supabase/PostgreSQL.
 *
 * Tables: player_vehicles, player_vehicle_upgrades
 */

const { getSupabaseClient } = require('../client');
const { getLogger } = require('../../logging');

// ---- Reads ----------------------------------------------------------------

async function getPlayerVehicles(userId) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('player_vehicles')
    .select('*, player_vehicle_upgrades(*)')
    .eq('user_id', userId);
  if (error) throw new Error('[supabase:player_vehicles] getPlayerVehicles: ' + error.message);
  return data;
}

async function getActiveVehicle(userId) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('player_vehicles')
    .select('*, player_vehicle_upgrades(*)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw new Error('[supabase:player_vehicles] getActiveVehicle: ' + error.message);
  return data;
}

// ---- Writes ---------------------------------------------------------------

async function upsertVehicleUpgrade(playerVehicleId, upgrade) {
  const sb = getSupabaseClient();
  const stats = upgrade.stats || {};

  // Try to find existing upgrade by (player_vehicle_id, type)
  const { data: existing, error: fetchErr } = await sb
    .from('player_vehicle_upgrades')
    .select('id')
    .eq('player_vehicle_id', playerVehicleId)
    .eq('type', upgrade.type)
    .maybeSingle();
  if (fetchErr) throw new Error('[supabase:player_vehicle_upgrades] lookup: ' + fetchErr.message);

  const upgradeRow = {
    player_vehicle_id: playerVehicleId,
    type: upgrade.type,
    level: upgrade.level ?? 1,
    grip: stats.grip ?? 0,
    suspension: stats.suspension ?? 0,
    brakes: stats.brakes ?? 0,
    torque: stats.torque ?? 0,
    horsepower: stats.horsepower ?? 0,
    aero: stats.aero ?? 0,
    durability: stats.durability ?? 0,
  };

  if (existing) {
    const { error } = await sb
      .from('player_vehicle_upgrades')
      .update(upgradeRow)
      .eq('id', existing.id);
    if (error) throw new Error('[supabase:player_vehicle_upgrades] update: ' + error.message);
  } else {
    const { error } = await sb
      .from('player_vehicle_upgrades')
      .insert(upgradeRow);
    if (error) throw new Error('[supabase:player_vehicle_upgrades] insert: ' + error.message);
  }
}

/**
 * Update specific fields on an active vehicle by userId.
 */
async function updateActiveVehicle(userId, fields) {
  const sb = getSupabaseClient();
  const colMap = {
    isActive: 'is_active', status: 'status', fuelType: 'fuel_type',
    currentFuel: 'current_fuel', fuelCapacity: 'fuel_capacity',
    'stats.grip': 'stat_grip', 'stats.suspension': 'stat_suspension',
    'stats.brakes': 'stat_brakes', 'stats.torque': 'stat_torque',
    'stats.horsepower': 'stat_horsepower', 'stats.aero': 'stat_aero',
    'stats.durability': 'stat_durability',
    'raceTrackStats.raceCount': 'race_count',
    'raceTrackStats.wins': 'wins', 'raceTrackStats.losses': 'losses',
    'raceTrackStats.lastRaceDate': 'last_race_date',
  };
  const now = new Date().toISOString();
  const sqlFields = { updated_at: now };
  for (const [k, v] of Object.entries(fields)) {
    const col = colMap[k];
    if (col) sqlFields[col] = v instanceof Date ? v.toISOString() : v;
  }
  if (Object.keys(sqlFields).length <= 1) return null;
  const { data, error } = await sb
    .from('player_vehicles')
    .update(sqlFields)
    .eq('user_id', userId)
    .eq('is_active', true)
    .select()
    .maybeSingle();
  if (error) throw new Error('[supabase:player_vehicles] updateActiveVehicle: ' + error.message);
  return data;
}

module.exports = {
  getPlayerVehicles,
  getActiveVehicle,
  upsertVehicleUpgrade,
  updateActiveVehicle,
};
