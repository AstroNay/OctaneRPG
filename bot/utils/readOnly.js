// Read-only mode: one env switch (READONLY_MODE) that turns the bot into a read-only window onto the
// legacy game.
//
// Set READONLY_MODE=true to block everything that writes player state; unset or false restores the
// full game (instant rollback, no code change). Read on every call so tests can flip it at runtime.

class ReadOnlyError extends Error {
    constructor(operation) {
        super(`OctaneRPG is read-only: blocked write${operation ? ` (${operation})` : ''}`);
        this.name = 'ReadOnlyError';
        this.readOnly = true;
    }
}

function isReadOnlyMode() {
    return String(process.env.READONLY_MODE || '').trim().toLowerCase() === 'true';
}

// Slash commands that stay available in read-only mode. This is an allowlist on purpose: a command
// that is new or forgotten is blocked by default.
//   - start is allowed only because it renders the "game moved" message instead of onboarding.
//   - settings is guild-admin tooling and unchanged.
//   - garage, inventory, cooldowns and profile are kept but have their write paths blocked inside.
const ALLOWED_COMMANDS = new Set([
    'help', 'info', 'profile', 'stats', 'garage', 'leaderboard', 'top', 'challenges', 'guild',
    'practice', 'cooldowns', 'inventory', 'start', 'settings',
]);

function isAllowedCommand(commandName) {
    if (!isReadOnlyMode()) return true;
    return ALLOWED_COMMANDS.has(String(commandName || '').toLowerCase());
}

// Button/select-menu ids that the central interactionCreate handler routes to a write.
const WRITE_COMPONENT_PREFIXES = ['togglelock', 'joinmeet', 'selectqty_', 'confirmpurchase_'];
const WRITE_COMPONENT_IDS = new Set(['perk_upgrade_select', 'title_select', 'badge_pin_select']);

// False only for components the central handler would route to a write. Everything else (including
// ids owned by in-command collectors such as help/garage) returns true so the central handler leaves it
// alone. Pure navigation (leaderboard_*, perk_category_select, perk_back_overview, cancel_purchase) is
// allowed. `execute_<command>` buttons re-run another command's execute(), so they follow the command
// allowlist.
function isAllowedComponent(customId) {
    if (!isReadOnlyMode()) return true;
    const id = String(customId || '');
    if (id.startsWith('execute_')) return ALLOWED_COMMANDS.has(id.split('_')[1]);
    if (WRITE_COMPONENT_IDS.has(id)) return false;
    return !WRITE_COMPONENT_PREFIXES.some(prefix => id.startsWith(prefix));
}

// Drops buttons that route to a blocked write (and rows left empty) from ActionRowBuilders, so
// read-only views don't offer buttons that would only show the redirect. No-op outside read-only mode.
function filterAllowedRows(rows) {
    if (!isReadOnlyMode()) return rows;
    return rows
        .map(row => {
            row.setComponents(row.components.filter(c => {
                const id = c.data?.custom_id;
                return !id || isAllowedComponent(id);
            }));
            return row;
        })
        .filter(row => row.components.length > 0);
}

// Backstop for code paths that write. Throws a ReadOnlyError when read-only mode is on.
function assertWritable(operation) {
    if (isReadOnlyMode()) throw new ReadOnlyError(operation);
}

module.exports = {
    ReadOnlyError,
    ALLOWED_COMMANDS,
    isReadOnlyMode,
    isAllowedCommand,
    isAllowedComponent,
    filterAllowedRows,
    assertWritable,
};
