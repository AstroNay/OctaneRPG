const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { GameAPI } = require('../utils/apiClient');
const { generateStatsText } = require('../utils/racing');
const { getLogger } = require('../utils/logging');
const { safeDeferReply, safeReply, safeButtonCollector } = require('../utils/interactionUtils');
const { checkAndPromptPrestigeRedemption } = require('../utils/prestigeUtils');
const { t } = require('../utils/lang');
const { isReadOnlyMode } = require('../utils/readOnly');
const { sendRetroRedirect } = require('../utils/retroRedirect');
const garageSize = 2;

function normalizeGarageData(raw) {
    if (!raw) return { profile: null, vehicles: [] };
    // Preferred shape
    if (raw.profile && Array.isArray(raw.vehicles)) {
        return { profile: raw.profile, vehicles: raw.vehicles };
    }
    // Common API/fallback shape: profile fields at root + vehicles array
    if (Array.isArray(raw.vehicles)) {
        const profile = raw.userId ? raw : null;
        return { profile, vehicles: raw.vehicles };
    }
    // Sometimes vehicle list may come back as an object
    if (raw.profile && raw.vehicles && !Array.isArray(raw.vehicles)) {
        return { profile: raw.profile, vehicles: raw.vehicles.vehicles || [] };
    }
    return { profile: raw.userId ? raw : null, vehicles: [] };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('garage')
        .setDescription('View your stored cars and their stats.'),
    category: 'General',
    async execute(interaction) {
        let logger = await getLogger();
        const api = new GameAPI();

        // Defer immediately to avoid Discord interaction expiry on slow API calls/timeouts
        await safeDeferReply(interaction, true);
        
        // Use batch endpoint to get both profile and garage data
        let garageData;
        try {
            garageData = normalizeGarageData(await api.getVehicleGarage(interaction.user.id));
        } catch (batchError) {
            logger.debug(`Batch vehicle garage API failed, falling back to individual calls: ${batchError.message}`);
            // Fallback to individual API calls
            const profile = await api.getProfile(interaction.user.id);
            let vehicles = await api.getGarage(interaction.user.id);
            // Handle different response formats (API might return object with vehicles array)
            if (vehicles && !Array.isArray(vehicles)) {
                vehicles = vehicles.vehicles || [];
            }
            garageData = { profile, vehicles: vehicles || [] };
        }
        
        // Check if player needs to redeem prestige token (ensure profile exists)
        if (!isReadOnlyMode() && garageData && garageData.profile && await checkAndPromptPrestigeRedemption(garageData.profile, interaction)) {
            return;
        }
        
        let v = await getGarageEmbed(interaction, garageData);    
        const message = await interaction.editReply({ embeds: [v.embed], components: v.components });
        safeButtonCollector(interaction, message, {
            allowedIds: [interaction.user.id],
            time: 60000,
            onCollect: async (i) => {
                // Release-impound and set-active write state; the buttons aren't rendered in read-only
                // mode, but a stale message from before the switch could still send them.
                if (isReadOnlyMode() && (i.customId.startsWith('release_vehicle') || i.customId.startsWith('select_vehicle_'))) {
                    return await sendRetroRedirect(i);
                }
                const api = new GameAPI();
                
                // Use batch endpoint for button interactions too
                let buttonGarageData;
                try {
                    buttonGarageData = normalizeGarageData(await api.getVehicleGarage(interaction.user.id));
                } catch (batchError) {
                    // Fallback to individual calls for button interactions
                    const profile = await api.getProfile(interaction.user.id);
                    let vehicles = await api.getGarage(interaction.user.id);
                    if (vehicles && !Array.isArray(vehicles)) {
                        vehicles = vehicles.vehicles || [];
                    }
                    buttonGarageData = { profile, vehicles: vehicles || [] };
                }
                
                if (i.customId.startsWith('release_vehicle')) {
                    const index = parseInt(i.customId.split('_').pop());
                    if (buttonGarageData.vehicles[index].status !== 'Impounded') return;
                  
                    if (buttonGarageData.profile.coins < 600) {
                      return i.reply({ content: t("garage_release_not_enough", interaction.locale), ephemeral: true });
                    }
    
                    try {
                        await api.releaseImpoundedVehicle(interaction.user.id, buttonGarageData.vehicles[index]._id);
                    } catch (error) {
                        logger.error('Error releasing vehicle: ' + error);
                        return await i.followUp({ content: t("garage_status_error", interaction.locale), ephemeral: true });
                    }
    
                    let v = await getGarageEmbed(interaction);
                    try {
                        return await safeReply(i, { content: t("garage_release_success", interaction.locale), embeds: [v.embed], components: v.components }, true);
                    } catch (error) {
                        logger.error('Error updating message components: ' + error);
                        return await i.followUp({ content: t("garage_status_error", interaction.locale), ephemeral: true });
                    }
                } else if (i.customId.startsWith('select_vehicle_')) {
                    const index = parseInt(i.customId.split('_').pop());
                    try {
                        // Use buttonGarageData.vehicles instead of calling API again
                        const vehicleArray = buttonGarageData.vehicles || [];
                        
                        if (index < 0 || index >= vehicleArray.length) {
                            return i.reply({ content: t("garage_status_error", interaction.locale), ephemeral: true });
                        }
                        if (vehicleArray[index]?.status === 'Impounded') {
                            return i.reply({ content: t("garage_active_impound", interaction.locale), ephemeral: true });
                        }
    
                        await api.selectActiveVehicle(interaction.user.id, vehicleArray[index]._id);
                    } catch (error) {
                        logger.error('Error setting vehicle active status: ' + error);
                        return await i.followUp({ content: t("garage_status_error", interaction.locale), ephemeral: true });
                    }            
                
                    let v = await getGarageEmbed(interaction);
                    try {
                        return await safeReply(i, { content: t("garage_active_success", interaction.locale, { number: index + 1 }), embeds: [v.embed], components: v.components }, true);
                    } catch (error) {
                        logger.error('Error updating message components: ' + error);
                        return await i.followUp({ content: t("garage_status_error", interaction.locale), ephemeral: true });
                    }
                }
            },
            onEnd: async (collected, reason) => {
                if (reason !== 'completed') {
                    try {
                      await interaction.editReply({ components: [] });
                    } catch (err) {
                      console.error('Error clearing buttons after timeout:', err);
                    }
                }
            }
        });
    }
};


async function getGarageEmbed(interaction, garageData = null) {
    const api = new GameAPI();
    
    // Use provided garageData or fetch individually if not available
    let profile, vehicles;
    if (garageData) {
        const normalized = normalizeGarageData(garageData);
        profile = normalized.profile;
        vehicles = normalized.vehicles || [];
    } else {
        // Fallback for internal calls that don't provide batched data
        try {
            const normalized = normalizeGarageData(await api.getVehicleGarage(interaction.user.id));
            profile = normalized.profile;
            vehicles = normalized.vehicles || [];
        } catch (batchError) {
            // Final fallback to individual API calls
            profile = await api.getProfile(interaction.user.id);
            let vehicleData = await api.getGarage(interaction.user.id);
            // Handle different response formats (API might return object with vehicles array)
            if (vehicleData && !Array.isArray(vehicleData)) {
                vehicles = vehicleData.vehicles || [];
            } else {
                vehicles = vehicleData || [];
            }
        }
    }
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(t("garage_title", interaction.locale))
        .setDescription(t("garage_description", interaction.locale))
        .setFooter({ text: t("garage_footer", interaction.locale, { maxCars: garageSize }) });

    const safeVehicles = Array.isArray(vehicles) ? vehicles.filter(Boolean) : [];

    for (const vehicle of safeVehicles) {
        const vehicleStatsText = await generateStatsText(profile, vehicle);
        
        // Fix status display logic - use isActive flag for Active/Stored
        let displayStatus;
        if (vehicle.status === 'Impounded') {
            displayStatus = 'Impounded';
        } else if (vehicle.isActive) {
            displayStatus = 'Active';
        } else {
            displayStatus = 'Stored';
        }
        
        const raceLevel = vehicle?.raceTrackStats?.highestLevelUnlocked ?? 0;
        const wins = vehicle?.raceTrackStats?.wins ?? 0;
        const losses = vehicle?.raceTrackStats?.losses ?? 0;
        const currentFuel = vehicle?.stats?.currentFuel;
        const fuelText = (currentFuel === 0 || currentFuel) ? Number(currentFuel).toLocaleString() : '—';

        const statsText = `[${displayStatus}]\n\n**Stats**\n${vehicleStatsText.horsepowerText}\n${vehicleStatsText.torqueText}\n${vehicleStatsText.gripText}\n${vehicleStatsText.suspensionText}\n${vehicleStatsText.brakesText}\n${vehicleStatsText.aeroText}\n\n**Races:**\nTrack Races: Level ${raceLevel}\n${wins}W / ${losses}L\n\n**Fuel:**\n${fuelText}% ${vehicle.fuelType} Fuel`;
        embed.addFields({
            name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
            value: statsText,
            inline: true
        });
    }

    const row = new ActionRowBuilder();
        safeVehicles.forEach((vehicle, index) => {
            if (vehicle.status === 'Impounded') {
                row.addComponents(
                  new ButtonBuilder()
                    .setCustomId(`release_vehicle_${index}`)
                    .setLabel(`Release (💰600)`)
                    .setStyle(ButtonStyle.Danger)
                );
            } else {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`select_vehicle_${index}`)
                        .setLabel(`Set ${index + 1} Active`)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(vehicle.isActive)
                );
            }
        });

    // Read-only mode: the Release and Set Active buttons are writes, so show the list without them.
    return { embed, row, components: row.components.length > 0 && !isReadOnlyMode() ? [row] : [] };
}


