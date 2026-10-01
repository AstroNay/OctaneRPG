const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('@discordjs/builders');
const { ButtonStyle } = require('discord-api-types/v9');
const { getLogger } = require('../utils/logging');
const { GameAPI } = require('../utils/apiClient');
const { safeDeferReply, safeReply, safeButtonCollector } = require('../utils/interactionUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the OctaneRPG player leaderboard.')
        .addStringOption(option => 
            option.setName('sort')
                .setDescription('Sort by XP, Coins, Level, or Street Cred')
                .setRequired(true)
                .addChoices(
                    { name: 'XP', value: 'xp' },
                    { name: 'Coins', value: 'coins' },
                    { name: 'Level', value: 'level' },
                    { name: 'Street Cred', value: 'reputation' }
                )),
    category: 'General',
    async execute(interaction) {
        await safeDeferReply(interaction);
        let logger = await getLogger();
        try {
            const api = new GameAPI();
            const sort = interaction.options.getString('sort') || 'xp';
            let sortField = sort === 'coins' ? 'coins' : sort === 'level' ? 'level' : sort === 'reputation' ? 'reputation' : 'xp';

            const guildPlayers = await api.getGuildLeaderboard(interaction.guild.id, sortField);
            const globalPlayers = await api.getLeaderboard(sortField, 100); // Get top 100 for global

            let page = 0;
            let leaderboard = 'Guild';
            let players = guildPlayers;
    
        const {embed, row } = await generateEmbed(0, players, leaderboard, page, sortField);
        const message = await safeReply(interaction, { embeds: [embed], components: [row] });
        if (!message) return;
        safeButtonCollector(interaction, message, {
            allowedIds: [interaction.user.id],
            time: 60000,
            onCollect: async (i) => {
                if (['next', 'previous'].includes(i.customId)) {
                    if (i.customId === 'next' && (page + 1) * 5 < players.length) {
                        page++;
                    } else if (i.customId === 'previous' && page > 0) {
                        page--;
                    }
                    const { embed, row } = await generateEmbed(page * 5, players, leaderboard, page, sortField);
                    await i.editReply({ embeds: [embed], components: [row] });
                } else if (i.customId === 'guild' || i.customId === 'global') {
                    leaderboard = i.customId.charAt(0).toUpperCase() + i.customId.slice(1);
                    players = i.customId === 'guild' ? guildPlayers : globalPlayers;
                    page = 0;
                    const { embed, row } = await generateEmbed(0, players, leaderboard, page, sortField);
                    await i.editReply({ embeds: [embed], components: [row] });
                }
            },
            onEnd: async (collected, reason) => {
                if (reason !== 'completed') {
                    try {
                      await interaction.editReply({ components: [] });
                    } catch (err) {
                      logger.error('Error clearing buttons after timeout:', err);
                    }
                }
            }
        });
        } catch (error) {
            logger.error(interaction.user.tag + ' | leaderboard: ' + error);
            await safeReply(interaction, 'An error occurred while loading the leaderboard.', true);
        }
    }
};

async function generateEmbed(startIndex, players, leaderboard, page, sortField) {
    const current = players.slice(startIndex, startIndex + 5);
    if (!current.length) {
        const embed = new EmbedBuilder()
            .setTitle(`**${leaderboard} Leaderboard** - *Sorted by ${sortField} in descending order*`)
            .setDescription(`No players assigned to this guild.`)
            .setColor(0x00AE86);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('previous').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('guild').setLabel('Guild').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('global').setLabel('Global').setStyle(ButtonStyle.Primary)
        );

        return { embed, row };
    }
    const embed = new EmbedBuilder()
        .setTitle(`**${leaderboard} Leaderboard** - *Sorted by ${sortField} in descending order*`)
        .setDescription(current.map(player => {
            const crewString = player.crew ? `**[${player.crew}]**` : "";
            const joinDate = player.joinDate ? new Date(player.joinDate).toLocaleDateString() : 'Unknown';
            const lastActive = player.lastMessageDate ? new Date(player.lastMessageDate).toLocaleDateString() : 'Unknown';
            const statsLine = sortField === 'reputation'
                ? `┗ Level: ${player.level} | Street Cred: ${Math.floor(player.reputation || 0).toLocaleString()} | Coins: ${Math.floor(player.coins).toLocaleString()}`
                : `┗ Level: ${player.level} | XP: ${Math.floor(player.xp)} | Coins: ${Math.floor(player.coins).toLocaleString()}`;
            return `${crewString} ${player.username} | <@${player.userId}>\n` +
            `┣ Joined: ${joinDate} - Last Active: ${lastActive}\n` +
            statsLine;
        }).join('\n\n'))
        .setFooter({ text: `Page ${page + 1} of ${Math.ceil(players.length / 5)}` })
        .setColor(0x00AE86);

    const row = new ActionRowBuilder();
    if (page === 0) {
        row.addComponents(
            new ButtonBuilder().setCustomId('previous').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(players.length <= 5),
            new ButtonBuilder().setCustomId('guild').setLabel('Guild').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('global').setLabel('Global').setStyle(ButtonStyle.Primary)
        );
    } else {
        row.addComponents(
            new ButtonBuilder().setCustomId('previous').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(startIndex === 0),
            new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(startIndex + 5 >= players.length),
            new ButtonBuilder().setCustomId('guild').setLabel('Guild').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('global').setLabel('Global').setStyle(ButtonStyle.Primary)
        );
    }

    return { embed, row };
}


