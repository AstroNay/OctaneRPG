const { getSupabaseClient } = require('./supabase');
const { getLogger } = require('./logging');

async function logInventoryEvent(event) {
  try {
    const sb = getSupabaseClient();
    const { error } = await sb.from('player_events').insert({
      user_id: event.userId,
      item_id: event.itemId,
      delta: event.delta,
      quantity_before: event.quantityBefore ?? null,
      quantity_after: event.quantityAfter ?? null,
      category: event.category ?? null,
      condition: event.condition ?? null,
      value: event.value ?? null,
      reason: event.reason ?? null,
      source: event.source ?? null,
      metadata: event.metadata ?? null,
      created_at: event.createdAt ? new Date(event.createdAt).toISOString() : new Date().toISOString(),
    });
    if (error) {
      const logger = await getLogger();
      logger.warn(`logInventoryEvent insert failed for ${event.userId}/${event.itemId}: ${error.message}`);
    }
  } catch (error) {
    // Best-effort: don't block gameplay if audit logging fails, but don't go
    // silent either -- this exact pattern (swallowed error, wrong table name)
    // is how logging broke unnoticed for days last time.
    const logger = await getLogger();
    logger.warn(`logInventoryEvent threw for ${event.userId}/${event.itemId}: ${error?.message || error}`);
  }
}

async function logCoinsEvent({ userId, delta, before, after, reason, source, metadata }) {
  return logInventoryEvent({
    userId,
    itemId: 'coins',
    delta,
    quantityBefore: before,
    quantityAfter: after,
    category: 'currency',
    reason,
    source,
    metadata,
  });
}

async function logCrewTokensEvent({ userId, delta, before, after, reason, source, metadata }) {
  return logInventoryEvent({
    userId,
    itemId: 'crew_tokens',
    delta,
    quantityBefore: before,
    quantityAfter: after,
    category: 'currency',
    reason,
    source,
    metadata,
  });
}

module.exports = {
  logInventoryEvent,
  logCoinsEvent,
  logCrewTokensEvent,
};
