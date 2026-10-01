/**
 * Supabase -- player_items table adapter
 *
 * Player item operations against Supabase/PostgreSQL.
 *
 * Tables: player_items
 */

const { getSupabaseClient } = require('../client');

// ---- Reads ----------------------------------------------------------------

async function getPlayerItems(userId) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('player_items')
    .select('*')
    .eq('user_id', userId);
  if (error) throw new Error('[supabase:player_items] getPlayerItems: ' + error.message);
  return data;
}

async function getPlayerItem(userId, itemId) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('player_items')
    .select('*')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .maybeSingle();
  if (error) throw new Error('[supabase:player_items] getPlayerItem: ' + error.message);
  return data;
}

// ---- Writes ---------------------------------------------------------------

/**
 * Add quantity to an existing item (used in shadow writes for addInventoryItem).
 */
async function addItemQuantity(userId, itemId, quantity) {
  const sb = getSupabaseClient();
  const { data: existing } = await sb
    .from('player_items')
    .select('id, quantity')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .maybeSingle();

  if (existing) {
    const { error } = await sb
      .from('player_items')
      .update({ quantity: existing.quantity + quantity })
      .eq('id', existing.id);
    if (error) throw new Error('[supabase:player_items] addItemQuantity update: ' + error.message);
  } else {
    const now = new Date().toISOString();
    const { error } = await sb.from('player_items').insert({
      user_id: userId, item_id: itemId, quantity, acquired_at: now,
    });
    if (error) throw new Error('[supabase:player_items] addItemQuantity insert: ' + error.message);
  }
}

/**
 * Remove quantity from an item (or delete the row if quantity reaches 0).
 */
async function removeItemQuantity(userId, itemId, quantity) {
  const sb = getSupabaseClient();
  const { data: existing } = await sb
    .from('player_items')
    .select('id, quantity')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .maybeSingle();
  if (!existing) return;

  const newQty = (existing.quantity ?? 1) - quantity;
  if (newQty <= 0) {
    const { error } = await sb.from('player_items').delete().eq('id', existing.id);
    if (error) throw new Error('[supabase:player_items] removeItemQuantity delete: ' + error.message);
  } else {
    const { error } = await sb.from('player_items').update({ quantity: newQty }).eq('id', existing.id);
    if (error) throw new Error('[supabase:player_items] removeItemQuantity update: ' + error.message);
  }
}

module.exports = {
  getPlayerItems,
  getPlayerItem,
  addItemQuantity,
  removeItemQuantity,
};
