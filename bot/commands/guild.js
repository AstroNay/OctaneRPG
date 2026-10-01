const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { GameAPI } = require('../utils/apiClient');
const { getLogger } = require('../utils/logging');
const { getSupabaseClient, tables } = require('../utils/supabase');
const { mapGuildSettingsRow } = require('../utils/supabase/mappers');

const { version: packageVersion } = require('../package.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guild')
        .setDescription('View guild information and settings.'),
    category: 'General',
    async execute(interaction) {
    let logger = await getLogger();
        const botVersion = process.env.BOT_VERSION || packageVersion;
        try {
            const api = new GameAPI();

            // Prefer API-backed guild settings (falls back to Supabase in the API client)
            let guildSettings = null;
            try {
                guildSettings = await api.getGuildSettings(interaction.guild.id);
            } catch (_) {
                const row = await tables.guildSettings.getGuildSettings(interaction.guild.id);
                guildSettings = mapGuildSettingsRow(row);
            }
            if (!guildSettings) {
                return interaction.reply('Guild settings not found.', { ephemeral: true });
            }

            const truncate = (value, max = 80) => {
                const text = String(value || '').trim();
                if (!text) return '';
                return text.length > max ? `${text.slice(0, max - 1)}…` : text;
            };

            let allowedChannels = guildSettings.allowedChannels.map(c => `<#${c}>`).join(', ');
            allowedChannels = allowedChannels || 'Not set';

            const levelUpNotifications = guildSettings.levelupMessages ? 'Enabled' : 'Disabled';
            const levelUpChannel = guildSettings.levelupChannel ? `<#${guildSettings.levelupChannel}>` : 'Not set';
            const levelUpColor = guildSettings.levelupColor ? String(guildSettings.levelupColor) : 'Default';
            const levelUpCadence = Number(guildSettings.levelupAnnounceEvery || 1);
            const levelUpTemplatePreview = truncate(guildSettings.levelupTemplate, 80);
            const levelUpTemplateLine = levelUpTemplatePreview
                ? `Custom ("${levelUpTemplatePreview}")`
                : 'Default';
            const carMeetChannel = guildSettings.carMeetChannel ? `<#${guildSettings.carMeetChannel}>` : 'Use `/carmeet` to set the channel';

            const ownerId = guildSettings.ownerId || interaction.guild?.ownerId || '';
            const ownerUsername = guildSettings.ownerUsername ? String(guildSettings.ownerUsername) : '';
            const ownerLine = ownerId
                ? `${ownerUsername ? `${ownerUsername} ` : ''}<@${ownerId}>`
                : (ownerUsername || 'Unknown');

            // Get guild statistics from API
            const guildStats = await api.getGuildStatistics(interaction.guild.id);
            
            // Get guild vehicle race stats from Supabase
            const sb = getSupabaseClient();
            const userIds = guildStats.players.map(p => p.userId);
            const { data: vehicleRows } = userIds.length > 0
                ? await sb.from('player_vehicles').select('wins, losses').in('user_id', userIds)
                : { data: [] };
            const totalWins = (vehicleRows || []).reduce((acc, v) => acc + (v.wins || 0), 0);
            const totalLosses = (vehicleRows || []).reduce((acc, v) => acc + (v.losses || 0), 0);
            const totalRaces = totalWins + totalLosses;

            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle(`Guild Information - ${interaction.guild.name}`)
                .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 256 }))
                .setDescription(
                    `**Settings**\n` +
                    `Owner: ${ownerLine}\n` +
                    `Level Up Notifications: ${levelUpNotifications}\n` +
                    `Level Up Channel: ${levelUpChannel}\n` +
                    `Level Up Color: ${levelUpColor}\n` +
                    `Level Up Cadence: Every ${Math.max(1, levelUpCadence)} level(s)\n` +
                    `Level Up Template: ${levelUpTemplateLine}\n` +
                    `Allowed Channels: ${allowedChannels}\n` +
                    `Car Meet Channel: ${carMeetChannel}\n\n` +
                    `*Use /settings command to change settings.*`
                )
                .addFields(
                { name: 'Players:', value: `${guildStats.playerCount}`, inline: true },
                { name: 'Total Coins', value: `<:coins:1269411594685644800> ${guildStats.totalCoins.toLocaleString()}`, inline: true },
                { name: 'Total XP', value: `${guildStats.totalXp.toLocaleString()}`, inline: true },
                { name: 'Total Races', value: `${totalWins}W / ${totalLosses}L\n(${totalRaces} Total)`, inline: true },
                { name: 'Dailies Collected', value: `${guildStats.totalDailyCount}`, inline: true },
                { name: 'Weeklies Collected', value: `${guildStats.totalWeeklyCount}`, inline: true }
                )
                .setFooter({ text: `${botVersion}`});
            
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            logger.error(interaction.user.tag+' | guild: '+error);
            await interaction.reply({ content: 'An error occurred while generating the profile.', ephemeral: true });
        }
    }
};


