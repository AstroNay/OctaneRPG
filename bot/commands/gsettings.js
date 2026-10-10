const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { GameAPI } = require('../utils/api');
const { getLogger } = require('../utils/logging');
const { safeReply } = require('../utils/interactionUtils');

function normalizeHexColor(input) {
    if (!input) return null;
    const raw = String(input).trim();
    const hex = raw.startsWith('#') ? raw.slice(1) : raw;
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    return `#${hex.toLowerCase()}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Edit settings for your guild')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('levelup')
                .setDescription('Configure level-up notifications')
                .addBooleanOption(option =>
                    option
                        .setName('enabled')
                        .setDescription('Enable or disable level-up messages')
                        .setRequired(false))
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Channel for level-up messages')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false))
                .addStringOption(option =>
                    option
                        .setName('color')
                        .setDescription('Embed hex color (e.g. #00ff00)')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option
                        .setName('cadence')
                        .setDescription('Announce every N levels (1 = every level)')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(false))
                .addStringOption(option =>
                    option
                        .setName('template')
                        .setDescription('Message template: {user} {username} {level} {oldLevel}')
                        .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('allowedchannels')
                .setDescription('Set the channels where commands can be used')
                .addStringOption(option =>
                    option
                        .setName('channels')
                        .setDescription('Comma-separated channel IDs')
                        .setRequired(true))
        ),
    category: 'Misc',
    async execute(interaction) {
        const logger = await getLogger();

        if (!interaction.guildId) {
            return safeReply(interaction, { content: 'This command can only be used in a server.', ephemeral: true }, true);
        }

        // Extra safety: slash default perms should block, but keep a runtime check too
        const isOwner = interaction.guild?.ownerId && interaction.user?.id === interaction.guild.ownerId;
        const canManage = interaction.memberPermissions?.has?.(PermissionFlagsBits.ManageGuild);
        if (!isOwner && !canManage) {
            return safeReply(interaction, { content: 'You need Manage Server permission to change settings.', ephemeral: true }, true);
        }

        const subcommand = interaction.options.getSubcommand();
        const api = new GameAPI();
        let settings = await api.getGuildSettings(interaction.guildId);

        if (!settings) {
            settings = {
                guildId: interaction.guildId,
                name: interaction.guild?.name || '',
                image: interaction.guild?.iconURL?.({ dynamic: true, size: 256 }) || '',
                allowedChannels: [],
                levelupMessages: false,
                levelupChannel: null,
                levelupColor: null,
                levelupAnnounceEvery: 1,
                levelupTemplate: null,
                carMeetChannel: null,
                carMeetMessage: null,
            };
        }

        if (subcommand === 'allowedchannels') {
            const channels = interaction.options.getString('channels', true);
            settings.allowedChannels = channels
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);

            await api.upsertGuildSettings(settings);
            logger.debug(`Allowed channels updated: ${settings.allowedChannels}`);
            return safeReply(interaction, { content: 'Allowed channels updated.', ephemeral: true }, true);
        }

        if (subcommand === 'levelup') {
            const enabled = interaction.options.getBoolean('enabled');
            const channel = interaction.options.getChannel('channel');
            const colorRaw = interaction.options.getString('color');
            const cadence = interaction.options.getInteger('cadence');
            const template = interaction.options.getString('template');

            if (channel && channel.type !== ChannelType.GuildText) {
                return safeReply(interaction, { content: 'Invalid channel type provided. Please provide a text channel.', ephemeral: true }, true);
            }

            if (enabled === true && !channel && !settings.levelupChannel) {
                return safeReply(interaction, { content: 'Please provide a channel when enabling level-up messages.', ephemeral: true }, true);
            }

            // If a channel is provided, ensure the bot can actually post there.
            if (channel) {
                const guild = interaction.guild;
                let me = guild?.members?.me || null;
                if (!me && guild?.members?.fetchMe) {
                    try {
                        me = await guild.members.fetchMe();
                    } catch (_) {
                        me = null;
                    }
                }

                const perms = me ? channel.permissionsFor(me) : null;
                const canView = perms?.has(PermissionFlagsBits.ViewChannel);
                const canSend = perms?.has(PermissionFlagsBits.SendMessages);
                const canEmbed = perms?.has(PermissionFlagsBits.EmbedLinks);

                if (!canView || !canSend || !canEmbed) {
                    const missing = [
                        !canView ? 'View Channel' : null,
                        !canSend ? 'Send Messages' : null,
                        !canEmbed ? 'Embed Links' : null,
                    ].filter(Boolean);

                    return safeReply(
                        interaction,
                        {
                            content:
                                `I can't post level-up messages in ${channel} yet. Missing: ${missing.join(', ')}.\n` +
                                `Choose a different channel, or update that channel's permissions for the bot role.`,
                            ephemeral: true,
                        },
                        true,
                    );
                }
            }

            if (enabled !== null && enabled !== undefined) settings.levelupMessages = enabled;
            if (channel) settings.levelupChannel = channel.id;

            if (colorRaw !== null && colorRaw !== undefined) {
                const normalized = normalizeHexColor(colorRaw);
                if (!normalized) {
                    return safeReply(interaction, { content: 'Invalid color. Use a hex like `#00ff00`.', ephemeral: true }, true);
                }
                settings.levelupColor = normalized;
            }

            if (cadence !== null && cadence !== undefined) {
                settings.levelupAnnounceEvery = Math.max(1, Number(cadence));
            }

            if (template !== null && template !== undefined) {
                settings.levelupTemplate = String(template).slice(0, 1000);
            }

            await api.upsertGuildSettings(settings);
            logger.debug(`Level-up settings updated: enabled=${settings.levelupMessages} channel=${settings.levelupChannel} color=${settings.levelupColor} cadence=${settings.levelupAnnounceEvery}`);
            return safeReply(interaction, { content: 'Level-up settings updated.', ephemeral: true }, true);
        }

        return safeReply(interaction, { content: 'Unknown settings option.', ephemeral: true }, true);
    }
};


