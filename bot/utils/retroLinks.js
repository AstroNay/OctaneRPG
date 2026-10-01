// Shared "OctaneRPG is becoming a full game" copy and links.
// One place for the URLs and blurbs so /info, /help, /start and the redirect embed stay in sync.

// GAME_URL is a stable landing page that links to wherever the game is playable (itch.io now, Steam
// later), so the bot never needs an update when the game moves.
const GAME_URL = process.env.GAME_URL || 'https://octanerpg.com/';
const DISCORD_INVITE_URL = process.env.DISCORD_INVITE_URL || 'https://discord.octanerpg.com/';

// Ready-to-drop-in markdown line for embed descriptions/fields.
function retroPromoLine() {
    return `🏁 **OctaneRPG is becoming a full game.** The Discord version is now read-only — [see what's next](${GAME_URL}).`;
}

// Short plain-text nod for embed footers (Discord footers don't render markdown links).
function retroFooterNote() {
    return `OctaneRPG is becoming a full game — ${GAME_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
}

// Canonical "what happened to OctaneRPG" explanation, shown by /info and /start.
function gameMovedText() {
    return (
        '**OctaneRPG is becoming a full game.**\n' +
        'The Discord version is now **read-only**: you can still look at profiles, garages and leaderboards, ' +
        'but gameplay has moved to a standalone OctaneRPG game.\n\n' +
        `• Alpha testing runs through our [Discord](${DISCORD_INVITE_URL}).\n` +
        '• The new game starts fresh for everyone — progress from the Discord version does not carry over.\n' +
        '• Played the Discord version? Your profile earns **Founder rewards** in the new game.\n\n' +
        `[Visit OctaneRPG](${GAME_URL})`
    );
}

module.exports = { GAME_URL, DISCORD_INVITE_URL, retroPromoLine, retroFooterNote, gameMovedText };
