const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getLogger } = require('../utils/logging');
const { getStandardEmbed } = require('../utils/getEmbed');
const { safeDeferReply, safeReply, safeButtonCollector } = require('../utils/interactionUtils');
const { GAME_URL, retroPromoLine } = require('../utils/retroLinks');

const { version: packageVersion } = require('../package.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Displays help information for commands.'),
    category: 'Misc',
    async execute(interaction) {
        let logger = await getLogger();

        const buttonRows = [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('general')
                    .setLabel('General')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('rewards')
                    .setLabel('Rewards')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('racing')
                    .setLabel('Racing')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('misc')
                    .setLabel('Misc')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setLabel('Visit OctaneRPG')
                    .setStyle(ButtonStyle.Link)
                    .setURL(GAME_URL)
            )
        ];

        try {
            const botVersion = process.env.BOT_VERSION || packageVersion || 'In-Development v0.0.0';
            const description =
                retroPromoLine() + '\n\n' +
                '**What you can do here**\nLook up profiles and garages with `/profile`, `/stats` and `/garage`, check `/leaderboard`, `/top` and `/challenges`, ' +
                'or run a free `/practice` race. Use the buttons below to browse the commands that are still available. Everything else has moved to the new game.';

            const embed = await getStandardEmbed('Octane Guide', [], {
                description: description,
                color: '#00ff00',
                footerText: botVersion
            });

            const message = await interaction.reply({ embeds: [embed], components: buttonRows, ephemeral: true });

            safeButtonCollector(interaction, message, {
                allowedIds: [interaction.user.id],
                time: 60000,
                onCollect: async (i) => {
                    let e = null;
                    switch (i.customId) {
                        case 'general':
                            e = await getHelpEmbedbyCat(interaction, 'General');
                            break;
                        case 'rewards':
                            e = await getHelpEmbedbyCat(interaction, 'Rewards');
                            break;
                        case 'racing':
                            e = await getHelpEmbedbyCat(interaction, 'Racing');
                            break;
                        case 'misc':
                            e = await getHelpEmbedbyCat(interaction, 'Misc');
                            break;
                    }

                    if (e) {
                        await i.editReply({ embeds: [e], components: buttonRows, ephemeral: true });
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
        } catch (error) {
            logger.error(interaction.user.tag + ' | help: ' + error);
            await interaction.reply('An error occurred while viewing help.', { ephemeral: true });
        }
    }
};

async function getHelpEmbedbyCat(interaction, category) {
    const botVersion = process.env.BOT_VERSION || packageVersion || 'In-Development v0.0.0';
    const commands = interaction.client.commands;
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`Category - ${category}`)
        .setDescription('Available commands:')
        .setFooter({ text: botVersion });

    commands.forEach(command => {
        if (command.category === category && command.data.name && command.data.description) {
            embed.addFields({ 
                name: `/${command.data.name}`, 
                value: command.data.description || 'No description available', 
                inline: true 
            });
        }
    });

    return embed;
}
