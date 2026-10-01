/**
 * Supabase integration entry point
 *
 * Exports:
 *   getSupabaseClient  - Lazy-initialized Supabase client
 *   tables             - Table-level adapters (players, playerVehicles, guildSettings, playerItems)
 */

const { getSupabaseClient } = require('./client');
const playersTable = require('./tables/players');
const playerVehiclesTable = require('./tables/playerVehicles');
const guildSettingsTable = require('./tables/guildSettings');
const playerItemsTable = require('./tables/playerItems');

module.exports = {
  getSupabaseClient,
  tables: {
    players: playersTable,
    playerVehicles: playerVehiclesTable,
    guildSettings: guildSettingsTable,
    playerItems: playerItemsTable,
  },
};
