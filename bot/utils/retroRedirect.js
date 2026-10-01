// Redirect embed for read-only mode. Anything that would write player
// state is replaced by this "OctaneRPG is becoming a full game" message with link buttons.

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { GAME_URL, DISCORD_INVITE_URL, gameMovedText } = require('./retroLinks');
const { safeReply } = require('./interactionUtils');

const DEFAULT_TITLE = 'This has moved to the OctaneRPG game';
const DEFAULT_BODY =
    'The Discord version of OctaneRPG is now read-only. Gameplay is moving to a standalone OctaneRPG game — alpha testing runs through our Discord.';
const DEFAULT_EXTRA = 'Played the Discord version? Your profile earns Founder rewards in the new game.';

// Returns { embeds, components }, ready to spread into a reply. Every field is overridable.
function buildRetroRedirectEmbed({ title, body, extra } = {}) {
    const embed = new EmbedBuilder()
        .setColor('#00b894')
        .setTitle(title || DEFAULT_TITLE)
        .setDescription(`${body || DEFAULT_BODY}\n\n${extra || DEFAULT_EXTRA}`);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Visit OctaneRPG').setStyle(ButtonStyle.Link).setURL(GAME_URL),
        new ButtonBuilder().setLabel('Join the Discord').setStyle(ButtonStyle.Link).setURL(DISCORD_INVITE_URL)
    );

    return { embeds: [embed], components: [row] };
}

// The canonical "what happened to OctaneRPG" message (same text as the top of /info). Used by /start in
// read-only mode, where it replaces onboarding.
function buildGameMovedMessage() {
    const { components } = buildRetroRedirectEmbed();
    const embed = new EmbedBuilder()
        .setColor('#00b894')
        .setTitle('OctaneRPG is becoming a full game')
        .setDescription(gameMovedText());
    return { embeds: [embed], components };
}

// Build the redirect and send it via safeReply. Ephemeral by default.
async function sendRetroRedirect(interaction, { title, body, extra, forceEphemeral = true } = {}) {
    return safeReply(interaction, buildRetroRedirectEmbed({ title, body, extra }), forceEphemeral);
}

module.exports = { buildRetroRedirectEmbed, buildGameMovedMessage, sendRetroRedirect };
