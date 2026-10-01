/**
 * Supabase -- guild_settings table adapter
 *
 * Guild settings operations against Supabase/PostgreSQL.
 *
 * Tables: guild_settings
 */

const { getSupabaseClient } = require('../client');

// ---- Reads ----------------------------------------------------------------

async function getGuildSettings(guildId) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('guild_settings')
    .select('*')
    .eq('guild_id', guildId)
    .maybeSingle();
  if (error) throw new Error('[supabase:guild_settings] getGuildSettings: ' + error.message);
  return data;
}

// ---- Writes ---------------------------------------------------------------

async function upsertGuildSettings(doc) {
  const sb = getSupabaseClient();
  const now = new Date().toISOString();
  const ts = (d) => (d ? new Date(d).toISOString() : null);

  const row = {
    guild_id: doc.guildId,
    name: doc.name ?? '',
    image: doc.image ?? '',
    owner_id: doc.ownerId ?? null,
    owner_username: doc.ownerUsername ?? null,
    allowed_channels: doc.allowedChannels ?? [],
    levelup_messages: doc.levelupMessages ?? false,
    levelup_channel: doc.levelupChannel ?? null,
    levelup_color: doc.levelupColor ?? null,
    levelup_announce_every: doc.levelupAnnounceEvery ?? 1,
    levelup_template: doc.levelupTemplate ?? null,
    car_meet_channel: doc.carMeetChannel ?? null,
    car_meet_message: doc.carMeetMessage ?? null,
    updated_at: ts(doc.lastUpdate) || now,
  };

  const { data, error } = await sb
    .from('guild_settings')
    .upsert(row, { onConflict: 'guild_id' })
    .select()
    .maybeSingle();
  if (error) throw new Error('[supabase:guild_settings] upsertGuildSettings: ' + error.message);
  return data;
}

/**
 * Partial update of guild settings — e.g. after an admin command.
 * Accepts camelCase field names.
 */
async function updateGuildSettings(guildId, updates) {
  const sb = getSupabaseClient();
  const now = new Date().toISOString();
  const colMap = {
    name: 'name', image: 'image', ownerId: 'owner_id', ownerUsername: 'owner_username',
    allowedChannels: 'allowed_channels', levelupMessages: 'levelup_messages',
    levelupChannel: 'levelup_channel', levelupColor: 'levelup_color',
    levelupAnnounceEvery: 'levelup_announce_every', levelupTemplate: 'levelup_template',
    carMeetChannel: 'car_meet_channel', carMeetMessage: 'car_meet_message',
    lastUpdate: 'updated_at',
  };
  const sqlFields = { updated_at: now };
  for (const [k, v] of Object.entries(updates)) {
    const col = colMap[k];
    if (col) sqlFields[col] = v instanceof Date ? v.toISOString() : v;
  }
  if (Object.keys(sqlFields).length <= 1) return null;
  const { data, error } = await sb
    .from('guild_settings')
    .update(sqlFields)
    .eq('guild_id', guildId)
    .select()
    .maybeSingle();
  if (error) throw new Error('[supabase:guild_settings] updateGuildSettings: ' + error.message);
  return data;
}

module.exports = { getGuildSettings, upsertGuildSettings, updateGuildSettings };
