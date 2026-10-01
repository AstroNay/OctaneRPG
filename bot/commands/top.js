const { SlashCommandBuilder } = require('discord.js');
const { GameAPI } = require('../utils/apiClient');
const { getLogger } = require('../utils/logging');
const { getLeaderboardEmbed } = require('../utils/getEmbed');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('top')
        .setDescription('View top guilds.')
        .addStringOption(option => 
            option.setName('metric')
                .setDescription('Metric to rank guilds by')
                .setRequired(true)
                .addChoices(
                    { name: 'XP', value: 'xp' },
                    { name: 'Coins', value: 'coins' },
                    { name: 'Car Meets', value: 'carmeets' }
                )),
    category: 'General',
    async execute(interaction) {
        const logger = await getLogger();
        try {
            const api = new GameAPI();
            const metric = interaction.options.getString('metric');
            
            const leaderboardData = await api.getTopGuilds(metric);

            if (leaderboardData.length === 0) {
                return interaction.reply({ content: 'No data available for this metric.', ephemeral: true });
            }

            const { embed } = await getLeaderboardEmbed(leaderboardData, interaction);
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            logger.error(interaction.user.tag + ' | top: ' + error);
            await interaction.reply({ content: 'An error occurred while loading the top guilds.', ephemeral: true });
        }
    }
};


