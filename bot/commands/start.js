const { SlashCommandBuilder } = require('discord.js');
const { buildGameMovedMessage } = require('../utils/retroRedirect');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('Find out where OctaneRPG went'),
  category: 'Misc',
  async execute(interaction) {
    // The Discord version no longer creates profiles; explain where the game went.
    return await interaction.reply({ ...buildGameMovedMessage(), ephemeral: true });
  }
};
