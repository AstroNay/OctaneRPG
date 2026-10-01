const { EmbedBuilder } = require('discord.js');
const { safeReply } = require('./interactionUtils');

/**
 * Check if a player needs to redeem their prestige token and prompt them
 * @param {Object} profile - Player profile from API
 * @param {Object} interaction - Discord interaction
 * @returns {Boolean} - True if player needs prestige redemption (command should exit)
 */
async function checkAndPromptPrestigeRedemption(profile, interaction) {
    if (profile.needsPrestigeReward && profile.prestigeTokens > 0) {
        const embed = new EmbedBuilder()
            .setTitle('🎄 Seasonal Reset - Action Required 🎄')
            .setDescription(
                `**Welcome back!** The season has reset and your progress has been archived.\n\n` +
                `You have **${profile.prestigeTokens} Prestige Token(s)** 🏆 to redeem!\n\n` +
                `**Please use \`/cars\` to claim your FREE mid-tier vehicle** before using other commands.\n\n` +
                `This will unlock your account and let you start racing again! 🏁`
            )
            .setColor('#FFD700')
            .setFooter({ text: 'This is a one-time setup after the seasonal wipe' });

        await safeReply(interaction, { embeds: [embed], ephemeral: true });
        return true;
    }
    return false;
}

module.exports = { checkAndPromptPrestigeRedemption };

