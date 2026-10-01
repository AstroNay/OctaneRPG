const { Client, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { DateTime } = require('luxon');
const { GameAPI } = require('../utils/apiClient');
const { getLogger } = require('../utils/logging');
const { t } = require('../utils/lang');
const { getAssetUrl } = require('../utils/assetLoader');
const { GAME_URL, gameMovedText } = require('../utils/retroLinks');

const { version: packageVersion } = require('../package.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('View information about the bot and its developers.'),
    category: 'Misc',
    async execute(interaction) {
        let logger = await getLogger();
        try {
            const api = new GameAPI();
            const botVersion = process.env.BOT_VERSION || packageVersion;

            const devIDRaw = process.env.ADMIN_USERS || '';
            const devList = devIDRaw
                ? devIDRaw.split(',').map(id => `<@${id.trim()}>`).join(', ')
                : 'Unknown';

            const supportInviteURL = process.env.SUPPORT_INVITE_URL || '';
            const botInvite = process.env.BOT_INVITE_URL || '';
            const client = interaction.client;

            const logoUrl = getAssetUrl('logo1.png');
            const profilesCount = await api.getPlayerCount();
            const commandCount = client.commands.size;
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle(`:robot: OctaneRPG`)
                .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setImage(logoUrl)
                .setDescription(gameMovedText() + '\n\nThe OctaneRPG bot is now a read-only window onto the Discord version: look up profiles, garages and leaderboards. Use `/help` to see what is still available.')
                .addFields(
                { name: 'Players', value: `${profilesCount.toLocaleString()}`, inline: true },
                { name: 'Servers', value: `${client.guilds.cache.size.toLocaleString()}`, inline: true },
                { name: 'Commands', value: `${commandCount.toLocaleString()}`, inline: true },
                { name: 'Developers', value: `${devList}`, inline: true },
                { name: 'Artists', value: `GandalfHardcore`, inline: true },
                { name: 'Links', value: `[OctaneRPG.com](${GAME_URL})\n\n[Invite Octane to your server](${botInvite})\n[Join the Support server](${supportInviteURL})`, inline: false }
                //{ name: 'Links', value: `~~[Invite Octane to your server]~~\n*Invites disabled during beta testing*\n[Join the Support server](${supportInviteURL})`, inline: true }
                )
                .setFooter({ text: ` ${botVersion}`});
            
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            logger.error(interaction.user.tag+' | info: '+error);
            await interaction.reply(t("command_error", interaction.locale), { ephemeral: true });
        }
    }
};


