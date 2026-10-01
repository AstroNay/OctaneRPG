const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { GameAPI } = require('../utils/apiClient');
const { getLogger } = require('../utils/logging');
const { t } = require('../utils/lang');
const { safeDeferReply, safeReply } = require('../utils/interactionUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('Displays your inventory.'),
    category: 'General',
    async execute(interaction) {
        //await safeDeferReply(interaction);
        let logger = await getLogger();
        const api = new GameAPI();
        
        try {
            const profile = await api.getProfile(interaction.user.id);
            if (!profile) {
                return interaction.reply({ content: t("profile_not_found", interaction.locale), ephemeral: true });
            }

            // Get inventory from PlayerItem collection via API
            const { inventory } = await api.getInventory(interaction.user.id);
            const inventoryArray = Array.isArray(inventory) ? inventory : [];
            
            const parts = inventoryArray.filter(item => item.category === 'Part' && item.condition !== 'Installed');
            const partsSummary = parts.reduce((acc, item) => {
                // Extract base part name from itemId
                // Handle legacy format: "engine_new" -> "Engine"
                // Handle new format: use itemId directly if condition field exists
                let basePartName;
                if (item.itemId.includes('_')) {
                    // Legacy format with condition in itemId
                    basePartName = item.itemId.split('_').slice(0, -1).join(' ')
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                } else {
                    // New format - capitalize itemId
                    basePartName = item.itemId.charAt(0).toUpperCase() + item.itemId.slice(1);
                }
                
                if (!acc[basePartName]) {
                    acc[basePartName] = {};
                }
                if (!acc[basePartName][item.condition]) {
                    acc[basePartName][item.condition] = 0;
                }
                acc[basePartName][item.condition]++;
                return acc;
            }, {});
            
            const scrappableParts = parts.filter(item => item.condition !== 'Usable' && item.category === 'Part' && item.condition !== 'Installed');
            const upgradableParts = parts.filter(item => item.condition === 'Usable' && item.category === 'Part' && item.condition !== 'Installed');
            const inventoryValue = parts.reduce((acc, item) => acc + (item.value || 0), 0); // Only car parts
            const scrappableValue = scrappableParts.reduce((acc, item) => acc + (item.value || 0), 0);
            
            // Turbo/supercharger installs live on the active vehicle's upgrades (player_vehicle_upgrades),
            // not as an inventory item condition — installing a part consumes/deletes the item entirely.
            const activeVehicle = await api.getActiveVehicle(interaction.user.id).catch(() => null);
            const vehicleUpgrades = activeVehicle?.upgrades || [];
            const hasTurbo = vehicleUpgrades.some(u => u.type === 'turbo' && u.level > 0);
            const hasSupercharger = vehicleUpgrades.some(u => u.type === 'supercharger' && u.level > 0);
            const hasUsableTurbo = inventoryArray.some(item => item.itemId.toLowerCase() === 'turbo' && item.condition === 'Usable');
            const hasUsableSupercharger = inventoryArray.some(item => item.itemId.toLowerCase() === 'supercharger' && item.condition === 'Usable');
            let extraScrap = '\n\n';
            if (hasTurbo && hasUsableSupercharger) {
                extraScrap += '**You can scrap Superchargers while you have a Turbo installed.\n';
            }
            if (hasSupercharger && hasUsableTurbo) {
                extraScrap += '**You can scrap Turbos while you have a Supercharger installed.\n';
            }

            const embed = new EmbedBuilder()
                .setTitle(`${interaction.user.username}'s Inventory`)
                .setColor('#00ff00')
                .setDescription(t("inventory_description", interaction.locale))
                .setFooter({ text: t("inventory_footer", interaction.locale, { inventoryValue: Math.floor(inventoryValue), scrappableValue: Math.floor(scrappableValue) }) });
    
            Object.entries(partsSummary).forEach(([part, conditions]) => {
                let description = '';
                Object.entries(conditions).forEach(([condition, count]) => {
                    let icon = '♻️';
                    if (condition === 'Usable') { icon = ':tools: '; }
                    else if (condition === 'Installed') { icon = ':white_check_mark: ' };
                    description += `${icon} ${condition}: ${count}\n`;
                });
                embed.addFields({ name: part, value: description, inline: true });
            });

            try {
                await safeReply(interaction, { embeds: [embed] });
                
            } catch (error) {
                logger.error(interaction.user.tag+' | inventory: '+error);
                await safeReply(interaction, { content: t("command_error", interaction.locale), ephemeral: true });
            }
        } catch (error) {
            logger.error(interaction.user.tag+' | inventory: '+error);
            await safeReply(interaction, { content: t("command_error", interaction.locale), ephemeral: true });
        }
    }
};


