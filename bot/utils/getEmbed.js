const { EmbedBuilder } = require('discord.js');

async function getLeaderboardEmbed(leaderboardData, interaction, page = 0) {
    const pageSize = 10;
    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    const pageData = leaderboardData.slice(startIndex, endIndex);
    if (pageData.length === 0) {
        return { embed: new EmbedBuilder().setDescription('No data available for this page.') };
    }

    let metricName = interaction.options.getString('metric');
    if (metricName === 'carmeets') {
        metricName = 'Total Attendees';
    } else if (metricName === 'xp') {
        metricName = 'XP Earned';
    } else if (metricName === 'coins') {
        metricName = 'Coins Earned';
    }

    const embed = new EmbedBuilder()
        .setTitle(`🏆 Top Guilds by ${metricName}`)
        .setColor(0x00AE86)
        .setDescription(pageData.map((guildDoc, index) => {
            const guildName = guildDoc?.name || 'Unknown Guild';
            // getTopGuilds (GET /guild-stats/top) returns { guildId, name, totalXp, totalCoins, totalCarMeets }
            let totalValue = 0;
            if (metricName === 'XP Earned') totalValue = guildDoc?.totalXp || 0;
            else if (metricName === 'Coins Earned') totalValue = guildDoc?.totalCoins || 0;
            else if (metricName === 'Total Attendees') totalValue = guildDoc?.totalCarMeets || 0;
            
            return `\`#${index + 1}\` - \`${guildName}\` - ${totalValue.toLocaleString()}`;
        }).join('\n'))
        .setFooter({ text: `Page ${page + 1} of ${Math.ceil(leaderboardData.length / pageSize)}` });

    return { embed };
}

async function getStandardEmbed(title, fields, options) {
    const { description, color, footerText } = options || {};
    const embed = new EmbedBuilder();

    if (color !== undefined && color !== null) {
        embed.setColor(color);
    }

    if (title) {
        embed.setTitle(title);
    }

    // Discord can reject empty-string fields (e.g., description: ""). Only set when non-empty.
    if (typeof description === 'string' ? description.trim().length > 0 : !!description) {
        embed.setDescription(description);
    }

    if (Array.isArray(fields) && fields.length > 0) {
        embed.setFields(fields);
    }

    if (typeof footerText === 'string' ? footerText.trim().length > 0 : !!footerText) {
        embed.setFooter({ text: footerText });
    }
    return embed;
}

module.exports = {
    getStandardEmbed,
    getLeaderboardEmbed,
};
