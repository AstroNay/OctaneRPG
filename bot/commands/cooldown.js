const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { GameAPI } = require('../utils/apiClient');
const { DateTime } = require('luxon');
const { getLogger } = require('../utils/logging');
const { safeDeferReply, safeReply } = require('../utils/interactionUtils');
const { t } = require('../utils/lang');
const { retroFooterNote } = require('../utils/retroLinks');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cooldowns')
        .setDescription('Check and refresh the cooldowns for your next daily and weekly rewards.'),
    category: 'General',
    async execute(interaction) {
        await safeDeferReply(interaction, false);
        let logger = await getLogger();
        const api = new GameAPI();

        try {
            const profile = await api.getProfile(interaction.user.id);
            if (!profile) {
                return safeReply(interaction, t('no_profile', interaction.locale), true);
            }

            const now = DateTime.now().setZone('America/New_York');
            const embed = await buildCooldownEmbed(interaction.user.id, now, api);

            await safeReply(interaction, { embeds: [embed] });
        } catch (error) {
            logger.error(interaction.user.tag + ' | cooldowns: ' + error);
            return safeReply(interaction, t('cooldowns_error', interaction.locale), true);
        }
    }
};

async function buildCooldownEmbed(userId, now, api) {
    const logger = await getLogger();
    
    try {
        const cooldowns = await api.getAllCooldowns(userId);
        const config = await api.getGameConfig().catch(() => null);
        const baseRaceFuelCostRaw = Number(config?.racing?.baseFuelCost);
        const baseRaceFuelCost = Number.isFinite(baseRaceFuelCostRaw) && baseRaceFuelCostRaw > 0 ? baseRaceFuelCostRaw : 10;
        
        // Format time strings for display
        const formatTimeLeft = (timeLeft) => {
            if (timeLeft <= 0) return ':white_check_mark:';
            const hours = Math.floor(timeLeft / 60);
            const minutes = timeLeft % 60;
            
            if (hours > 0) {
                return `:no_entry: ${hours} hours, ${minutes} minutes`;
            } else {
                return `:no_entry: ${minutes} minutes`;
            }
        };
        
        const formatTimeLeftHours = (timeLeft) => {
            if (timeLeft <= 0) return ':white_check_mark:';
            const hours = Math.floor(timeLeft / 60);
            const minutes = timeLeft % 60;
            
            if (hours >= 24) {
                const days = Math.floor(hours / 24);
                const remainingHours = hours % 24;
                return `:no_entry: ${days} days, ${remainingHours} hours`;
            } else if (hours > 0) {
                return `:no_entry: ${hours} hours, ${minutes} minutes`;
            } else {
                return `:no_entry: ${minutes} minutes`;
            }
        };

        const dailyResetString = cooldowns.daily.ready ? ':white_check_mark:' : formatTimeLeftHours(cooldowns.daily.timeLeft);
        const weeklyResetString = cooldowns.weekly.ready ? ':white_check_mark:' : formatTimeLeftHours(cooldowns.weekly.timeLeft);
        const workCooldown = cooldowns.work.ready ? ':white_check_mark:' : formatTimeLeft(cooldowns.work.timeLeft);
        const afkCooldown = cooldowns.afk.ready ? ':white_check_mark:' : formatTimeLeft(cooldowns.afk.timeLeft);
        const refuelCooldown = cooldowns.refuel.ready ? ':white_check_mark:' : formatTimeLeft(cooldowns.refuel.timeLeft);
        
        // Race/fuel logic
        let raceCooldown = ':white_check_mark:';
        if (cooldowns.profileData.playerVehicle) {
            const fuelCost = baseRaceFuelCost;
            if (cooldowns.profileData.playerVehicle.stats.currentFuel < fuelCost) {
                raceCooldown = ':no_entry: No fuel, use `/refuel` to top up.';
            } else {
                raceCooldown = `:white_check_mark: ${cooldowns.profileData.playerVehicle.stats.currentFuel}% Fuel`;
            }
        } else {
            raceCooldown = ':no_entry: No active vehicle';
        }

        // Lottery tokens logic
        const lotteryCooldown = cooldowns.lotteryTokens > 0 
            ? `:white_check_mark: ${cooldowns.lotteryTokens} Lucky Tokens` 
            : dailyResetString; // Use same reset as daily for lottery tokens

        // Supply runs
        let supplyRunCooldown = '';
        cooldowns.supplyRuns.forEach(run => {
            if (run.ready && run.state === 'Ready to Collect') {
                supplyRunCooldown += `:white_check_mark: [${run.index}] Ready to Collect\n`;
            } else if (!run.ready && run.state === 'In Progress') {
                const hours = Math.floor(run.timeLeft / 60);
                const minutes = run.timeLeft % 60;
                supplyRunCooldown += `:no_entry: [${run.index}] ${hours > 0 ? `${hours} hours, ` : ''}${minutes} minutes remaining\n`;
            } else {
                supplyRunCooldown += `:white_check_mark: [${run.index}] Available\n`;
            }
        });

        // Get active boosters and format remaining time
        let boosterText = '';
        try {
            const boosters = await api.getActiveBoosters(userId);
            
            // XP Booster
            if (boosters.booster_xp) {
                const expiry = DateTime.fromJSDate(new Date(boosters.booster_xp)).setZone('America/New_York');
                const timeLeft = expiry.diff(now, ['hours', 'minutes']);
                if (timeLeft.hours > 0) {
                    boosterText += `XP: :white_check_mark: ${Math.floor(timeLeft.hours)}h ${Math.floor(timeLeft.minutes)}m\n`;
                } else if (timeLeft.minutes > 0) {
                    boosterText += `XP: :white_check_mark: ${Math.floor(timeLeft.minutes)}m\n`;
                } else {
                    boosterText += `XP: Inactive\n`;
                }
            } else {
                boosterText += `XP: Inactive\n`;
            }

            // Coin Booster
            if (boosters.booster_coins) {
                const expiry = DateTime.fromJSDate(new Date(boosters.booster_coins)).setZone('America/New_York');
                const timeLeft = expiry.diff(now, ['hours', 'minutes']);
                if (timeLeft.hours > 0) {
                    boosterText += `Coin: :white_check_mark: ${Math.floor(timeLeft.hours)}h ${Math.floor(timeLeft.minutes)}m\n`;
                } else if (timeLeft.minutes > 0) {
                    boosterText += `Coin: :white_check_mark: ${Math.floor(timeLeft.minutes)}m\n`;
                } else {
                    boosterText += `Coin: Inactive\n`;
                }
            } else {
                boosterText += `Coin: Inactive\n`;
            }

            // Luck Booster
            if (boosters.booster_luck) {
                const expiry = DateTime.fromJSDate(new Date(boosters.booster_luck)).setZone('America/New_York');
                const timeLeft = expiry.diff(now, ['hours', 'minutes']);
                if (timeLeft.hours > 0) {
                    boosterText += `Luck: :white_check_mark: ${Math.floor(timeLeft.hours)}h ${Math.floor(timeLeft.minutes)}m`;
                } else if (timeLeft.minutes > 0) {
                    boosterText += `Luck: :white_check_mark: ${Math.floor(timeLeft.minutes)}m`;
                } else {
                    boosterText += `Luck: Inactive`;
                }
            } else {
                boosterText += `Luck: Inactive`;
            }
        } catch (error) {
            logger.warn('Error getting boosters for ' + userId + ': ' + error);
            boosterText = 'XP: Inactive\nCoin: Inactive\nLuck: Inactive';
        }

        return new EmbedBuilder()
            .setColor('#0000ff')
            .setTitle(`Your Cooldowns`)
            .setDescription(`**AFK Rewards**\n${afkCooldown}\n\n**Daily**\n${dailyResetString}\n\n**Weekly**\n${weeklyResetString}\n\n**Boosters**\n${boosterText}`)
            .addFields(
                { name: '📬 Mail', value: mailSummary, inline: false },
                { name: '\u200B', value: '\u200B' },
                { name: 'Work', value: `${workCooldown}`, inline: false },
                { name: 'Race', value: `${raceCooldown}`, inline: false },
                { name: 'Refuel', value: `${refuelCooldown}`, inline: false },
                { name: 'Lottery', value: `${lotteryCooldown}`, inline: false },
                { name: 'Supply Runs', value: `${supplyRunCooldown}`, inline: false }
            )
            .setFooter({ text: `Refreshed ${now.toLocaleString(DateTime.DATETIME_MED)} • ${retroFooterNote()}` });
    
    } catch (error) {
        logger.error('Error building cooldown embed: ' + error);
        return new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Error')
            .setDescription('Failed to load cooldown data. Please try again.');
    }
}


