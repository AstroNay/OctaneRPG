const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { GameAPI } = require('../utils/apiClient');
const { getVehicleStats, getUpgradeStats, getBlessingStats, getTotalStats } = require('../utils/racing');
const { getLogger } = require('../utils/logging');
const { t } = require('../utils/lang');
const { safeDeferReply, safeReply } = require('../utils/interactionUtils');
const { isReadOnlyMode } = require('../utils/readOnly');

module.exports = {
    data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View player stats.')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The player you want to view')
            .setRequired(false)),
    category: 'General',
    async execute(interaction) {
        await safeDeferReply(interaction, false);
        let logger = await getLogger();
        const api = new GameAPI();
        const targetUser = interaction.options.getUser('user') || interaction.user;
        
        try {
            const profile = await api.getProfile(targetUser.id);
            if (!profile) {
                return safeReply(interaction, `${targetUser.username}'s profile does not exist.`, true);
            }
            
            // Get active vehicle using same approach as working profile command
            const vehicleData = await api.getPlayerVehicles(targetUser.id);
            let playerVehicle = null;
            if (vehicleData && vehicleData.vehicles && Array.isArray(vehicleData.vehicles)) {
                playerVehicle = vehicleData.vehicles.find(v => v.isActive) || 
                               vehicleData.vehicles.find(v => v.status === 'Active') || 
                               vehicleData.vehicles[0];
            }
            
            if (!playerVehicle) {
                return safeReply(interaction, `${profile.username} does not have an active vehicle.`, true);
            }

            const crewTag = profile.crew ? '\u200B\u200B\u200B['+profile.crew+']' : '';
            const vehicleStats = await getVehicleStats(profile, playerVehicle);
            const upgradeStats = await getUpgradeStats(profile, playerVehicle);
            const blessingStats = await getBlessingStats(profile, playerVehicle);
            const totalStats = await getTotalStats(profile, playerVehicle);
            
            // Update challenge via API - don't let challenge failures crash the command
            // Skipped in read-only mode: it writes challenge progress.
            if (!isReadOnlyMode()) {
                try {
                    await api.updateChallengeByType(targetUser.id, 'checkStats');
                } catch (error) {
                    logger.debug(`Challenge update failed for stats command: ${error.message}`);
                }
            }
            
            const embed = new EmbedBuilder()
                .setColor(profile.settings.customColor || '#00ff00')
                .setTitle(`:bar_chart:  ${profile.username} - Level ${profile.level} ${crewTag}`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
                .setDescription(`**Power** - ${totalStats.totalPower.toLocaleString()} ⚡`)
                .addFields(
                    { name: 'Active Vehicle', value: `${playerVehicle.make} ${playerVehicle.model}\n**Fuel**\n${playerVehicle?.stats?.currentFuel ?? 0}% ${playerVehicle.fuelType || ''}`.trim(), inline: true },
                    { name: 'Races', value: `${playerVehicle.raceTrackStats.wins}W / ${playerVehicle.raceTrackStats.losses}L\n${playerVehicle.raceTrackStats.wins + playerVehicle.raceTrackStats.losses} Total`, inline: true },
                    { name: '\u200B', value: '\u200B', inline: false },
                    { name: 'Vehicle Stats', value: `Horsepower: ${vehicleStats.horsepower.toFixed(1)}\nTorque: ${vehicleStats.torque.toFixed(1)}\nGrip: ${vehicleStats.grip.toFixed(1)}\nSuspension: ${vehicleStats.suspension.toFixed(1)}\nBrakes: ${vehicleStats.brakes.toFixed(1)}\nAero: ${vehicleStats.aero.toFixed(1)}`, inline: true },
                    { name: 'Upgrades Stats', value: `Horsepower: ${upgradeStats.horsepowerBonus.toFixed(1)}\nTorque: ${upgradeStats.torqueBonus.toFixed(1)}\nGrip: ${upgradeStats.gripBonus.toFixed(1)}\nSuspension: ${upgradeStats.suspensionBonus.toFixed(1)}\nBrakes: ${upgradeStats.brakesBonus.toFixed(1)}\nAero: ${upgradeStats.aeroBonus.toFixed(1)}`, inline: true },
                    { name: 'Shrine Stats', value: `Horsepower: ${blessingStats.horsepowerBlessing.toFixed(1)}\nTorque: ${blessingStats.torqueBlessing.toFixed(1)}\nGrip: ${blessingStats.gripBlessing.toFixed(1)}\nSuspension: ${blessingStats.suspensionBlessing.toFixed(1)}\nBrakes: ${blessingStats.brakesBlessing.toFixed(1)}\nAero: ${blessingStats.aeroBlessing.toFixed(1)}`, inline: true },
                    { name: 'Player Stats', value: `Luck: ${profile.stats.luck.toFixed(1)}\nFuel Efficiency: ${profile.stats.fuelEfficiency.toFixed(1)}`, inline: true },
                )
                //.setFooter({ text: `` })
                .setTimestamp();
            
            return safeReply(interaction, { embeds: [embed] }, false);
        } catch (error) {
            logger.error(interaction.user.tag+' | stats: '+error);
            return safeReply(interaction, t("command_error", interaction.locale), true);
        }
    }
};


