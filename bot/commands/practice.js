const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { GameAPI } = require('../utils/apiClient');
const { getLogger } = require('../utils/logging');
const { t } = require('../utils/lang');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('practice')
        .setDescription('Practice race against another player.')
        .addUserOption(option => 
            option.setName('opponent')
                .setDescription('The player you want to race against')
                .setRequired(true)),
    category: 'Racing',
    async execute(interaction) {
        const api = new GameAPI();
        const logger = await getLogger();
        const opponentUser = interaction.options.getUser('opponent');

        try {
            await interaction.deferReply();

            const result = await api.practiceRace(interaction.user.id, opponentUser.id);

            const formatStats = (stats) => {
                const stock = stats.stock;
                const upgrades = stats.upgrades;
                const blessings = stats.blessings;
                
                return [
                    `**Total Power:** ${stats.totalPower.toFixed(1)} ⚡`,
                    ``,
                    `Horsepower: ${stock.horsepower.toFixed(1)} (+${(upgrades.horsepower + blessings.horsepower).toFixed(1)})`,
                    `Torque: ${stock.torque.toFixed(1)} (+${(upgrades.torque + blessings.torque).toFixed(1)})`,
                    `Grip: ${stock.grip.toFixed(1)} (+${(upgrades.grip + blessings.grip).toFixed(1)})`,
                    `Suspension: ${stock.suspension.toFixed(1)} (+${(upgrades.suspension + blessings.suspension).toFixed(1)})`,
                    `Brakes: ${stock.brakes.toFixed(1)} (+${(upgrades.brakes + blessings.brakes).toFixed(1)})`,
                    `Aero: ${stock.aero.toFixed(1)} (+${(upgrades.aero + blessings.aero).toFixed(1)})`
                ].join('\n');
            };

            const embed = new EmbedBuilder()
                .setTitle(':checkered_flag: Practice Race Results')
                .addFields(
                    { name: `${result.player.username}`, value: `${result.player.vehicle.make} ${result.player.vehicle.model}`, inline: true },
                    { name: 'Power', value: `${result.player.stats.totalPower.toFixed(1)}`, inline: true },
                    { name: 'Stats', value: formatStats(result.player.stats), inline: true },
                    { name: `${result.opponent.username}`, value: `${result.opponent.vehicle.make} ${result.opponent.vehicle.model}`, inline: true },
                    { name: 'Power', value: `${result.opponent.stats.totalPower.toFixed(1)}`, inline: true },
                    { name: 'Stats', value: formatStats(result.opponent.stats), inline: true },
                    { name: '\u200B', value: '\u200B', inline: false },
                    { name: 'Result', value: result.playerWins ? `${result.player.username} won!` : `${result.opponent.username} won!`, inline: false }
                )
                .setColor(result.playerWins ? '#00FF00' : '#FF0000');

            await interaction.followUp({ embeds: [embed] });
        } catch (err) {
            logger.error(interaction.user.tag + ' | practice: ' + err.message);
            
            if (err.message.includes('cannot race against yourself')) {
                return interaction.followUp({ content: "You cannot race against yourself.", ephemeral: true });
            }
            if (err.message.includes('active vehicle')) {
                return interaction.followUp({ content: "Both players need to have an active vehicle to race.", ephemeral: true });
            }
            if (err.message.includes('profiles')) {
                return interaction.followUp({ content: "Both players need to have a profile and an active vehicle to race.", ephemeral: true });
            }
            
            await interaction.followUp({ content: t("command_error", interaction.locale), ephemeral: true });
        }
    }
};


