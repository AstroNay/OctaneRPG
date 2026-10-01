/**
 * Supabase Client Singleton
 *
 * Provides a lazily-initialized Supabase client for use throughout the bot.
 * Only instantiates if SUPABASE_URL and SUPABASE_KEY are present.
 *
 * Usage:
 *   const { getSupabaseClient } = require('./client');
 *   const supabase = getSupabaseClient();
 *   const { data, error } = await supabase.from('players').select('*').eq('user_id', userId);
 */

const { createClient } = require('@supabase/supabase-js');
const { assertWritable } = require('../readOnly');

// guild_settings is bot housekeeping (server config), not player state, so it stays writable.
const WRITABLE_TABLES = new Set(['guild_settings']);
const WRITE_METHODS = new Set(['insert', 'update', 'upsert', 'delete']);

// Defense in depth for READONLY_MODE: reads pass through untouched, but any write on a player table
// throws instead of reaching the database.
function withReadOnlyGuard(client) {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop !== 'from') return Reflect.get(target, prop, receiver);
      return (table) => {
        const query = target.from(table);
        if (WRITABLE_TABLES.has(table)) return query;
        return new Proxy(query, {
          get(q, method) {
            if (WRITE_METHODS.has(method)) {
              return (...args) => {
                assertWritable(`${method} ${table}`);
                return q[method](...args);
              };
            }
            const value = Reflect.get(q, method);
            return typeof value === 'function' ? value.bind(q) : value;
          },
        });
      };
    },
  });
}

let _client = null;
let _initialized = false;

/**
 * Returns the Supabase client instance, creating it if necessary.
 * Throws if SUPABASE_URL or SUPABASE_KEY are not set.
 */
function getSupabaseClient() {
  if (_initialized) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;

  if (!url || !key) {
    throw new Error(
      '[supabase] Missing SUPABASE_URL or SUPABASE_KEY. ' +
      'Provide SUPABASE_URL and SUPABASE_KEY.'
    );
  }

  _client = withReadOnlyGuard(createClient(url, key, {
    auth: {
      // Bot process — no persistent session needed
      persistSession: false,
      autoRefreshToken: false,
    },
  }));

  _initialized = true;
  console.log('[supabase] Client initialized for', url.replace(/https?:\/\/([^.]+).*/, '$1.supabase.co'));
  return _client;
}

/**
 * Resets the singleton (for testing only).
 */
function _resetClient() {
  _client = null;
  _initialized = false;
}

module.exports = { getSupabaseClient, _resetClient };
