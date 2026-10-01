const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const { DateTime } = require('luxon');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Bot's own .env only.
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { getSupabaseClient } = require('./utils/supabase');
const { version: packageVersion } = require('./package.json');
const NODE_ENV = process.env.NODE_ENV || 'development';
const token = NODE_ENV === 'production' ? process.env.TOKEN_PROD : process.env.TOKEN_DEV;
const clientId = NODE_ENV === 'production' ? process.env.CLIENT_ID_PROD : process.env.CLIENT_ID_DEV;
const TIMEZONE = 'America/New_York';

const { getLogger } = require('./utils/logging');
const { GameAPI } = require('./utils/apiClient');
const { safeReply } = require('./utils/interactionUtils');
const { t } = require('./utils/lang');
const { cleanGroups, checkGuildSettings } = require('./utils/guildUtils');

const { isReadOnlyMode, isAllowedCommand, isAllowedComponent } = require('./utils/readOnly');
const { sendRetroRedirect } = require('./utils/retroRedirect');

async function startBot() {
    if (!token) {
        console.log('Token is missing. Please set the TOKEN environment variable.');
        process.exit(1);
    }

    try {
        try {
            getSupabaseClient();
            console.log('[supabase] Client initialized');
        } catch (sbErr) {
            console.error('[supabase] Failed to initialize Supabase:', sbErr.message);
            process.exit(1);
        }

        const supportGuildID = process.env.SUPPORT_GUILD_ID || process.env.GUILDID_SUPPORT || '';
        const devGuildID = process.env.DEV_GUILD_ID || process.env.GUILDID_DEV || process.env.GUILDID || '';
        const botVersion = process.env.BOT_VERSION || packageVersion;
        const gameAPI = new GameAPI();
        let logger = await getLogger();

        // Perform health check before loading settings to fix any corrupted data
        const { performStartupHealthCheck } = require('./utils/healthCheck');
        const healthResult = await performStartupHealthCheck();
        if (!healthResult.success) {
            console.warn('⚠️  Database health check failed:', healthResult.error);
        }

        const client = new Client({
            // Slash commands and components only need Guilds; no privileged intents.
            intents: [GatewayIntentBits.Guilds],
        });

        startHealthServer(client);

        client.commands = new Collection();
        const commandsDir = path.join(__dirname, 'commands');
        const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const command = require(`${commandsDir}/${file}`);
            client.commands.set(command.data.name, command);
        }

        client.once('clientReady', async () => {
            const startupTime = DateTime.now().setZone(TIMEZONE).toISO();
            let profilesCount = 0;
            try {
                const { count } = await getSupabaseClient().from('players').select('*', { count: 'exact', head: true });
                profilesCount = count ?? 0;
            } catch (_) {}
            logger.info(`${client.user.tag} connected | Guilds: ${client.guilds.cache.size} | Profiles: ${profilesCount} | Commands: ${client.commands.size} | Bot Version: ${botVersion}`);
            client.user.setPresence({ activities: [{ name: 'OctaneRPG.com | /help' }], status: 'dnd' });
            client.startupTime = startupTime;
            await cleanGroups(client, logger, TIMEZONE);
        });
        
        client.on('guildCreate', async guild => {
            await checkGuildSettings(client, logger, guild, TIMEZONE);
        });

        client.on('guildDelete', async guild => {
            try {
                if (guild.id === supportGuildID || guild.id === devGuildID) return;
                await getSupabaseClient().from('guild_settings').delete().eq('guild_id', guild.id);
                logger.info(`Left guild ${guild.name}`);
            } catch (error) {
                logger.error('guildDelete: '+error);
            }
        });
        
        client.on('interactionCreate', async interaction => {
            const profile = await gameAPI.players.getProfile(interaction.user.id).catch(() => null);

            // Global ban gate
            const allowedWhileBanned = new Set(['help', 'info', 'guild']);
            const supportInviteUrl = process.env.SUPPORT_INVITE_URL || 'https://discord.gg/yWEDMWd4AN';

            const buildBanEmbed = () => {
                const now = DateTime.now().setZone(TIMEZONE);
                const reason = profile?.banReason || 'No reason provided.';

                let untilText = t('banned_indefinite', interaction.locale);
                let remainingText = 'N/A';
                if (profile?.banUntil) {
                    const until = DateTime.fromJSDate(new Date(profile.banUntil)).setZone(TIMEZONE);
                    if (until.isValid) {
                        untilText = until.toLocaleString(DateTime.DATETIME_FULL);
                        const diff = until.diff(now, ['days', 'hours', 'minutes']).toObject();
                        if (until <= now) {
                            remainingText = t('banned_expired', interaction.locale);
                        } else {
                            const days = Math.floor(diff.days || 0);
                            const hours = Math.floor(diff.hours || 0);
                            const minutes = Math.floor(diff.minutes || 0);
                            const parts = [];
                            if (days) parts.push(`${days}d`);
                            if (hours || days) parts.push(`${hours}h`);
                            parts.push(`${minutes}m`);
                            remainingText = parts.join(' ');
                        }
                    }
                }

                return new EmbedBuilder()
                    .setTitle(t('banned_title', interaction.locale))
                    .setDescription(t('banned_description', interaction.locale, { supportLink: supportInviteUrl }))
                    .setColor(0xDC3545)
                    .addFields(
                        { name: t('banned_reason', interaction.locale), value: reason.slice(0, 1024) || 'No reason provided.', inline: false },
                        { name: t('banned_until', interaction.locale), value: untilText, inline: true },
                        { name: t('banned_remaining', interaction.locale), value: remainingText, inline: true },
                    )
                    .setTimestamp(new Date());
            };

            if (profile?.isBanned) {
                if (interaction.isCommand()) {
                    if (!allowedWhileBanned.has(interaction.commandName)) {
                        return await safeReply(interaction, { embeds: [buildBanEmbed()] }, true);
                    }
                } else if (interaction.isButton()) {
                    // Block interaction buttons while banned as well
                    return await safeReply(interaction, { embeds: [buildBanEmbed()] }, true);
                }
            }

            // Read-only mode: anything that isn't an allowlisted read view, and any button/menu that
            // routes to a write, gets the "game moved" redirect instead. Checked before the profile
            // lookups below so players without a profile get the redirect rather than "type /start".
            if (isReadOnlyMode()) {
                const blocked =
                    (interaction.isCommand() && !isAllowedCommand(interaction.commandName)) ||
                    ((interaction.isButton() || interaction.isStringSelectMenu()) && !isAllowedComponent(interaction.customId));
                if (blocked) return await sendRetroRedirect(interaction);
            }

            let publicCommands = ['help', 'start', 'info', 'guild'];
            if (!profile && interaction.isCommand() && !publicCommands.includes(interaction.commandName)) {
                console.log('Profile not found');
                return await safeReply(interaction, { content: t("no_profile", interaction.locale), ephemeral: true });
            }

            if (!interaction.guild) return;
            const guildSettings = await gameAPI.guildSettings.getGuildSettings(interaction.guild.id).catch(() => null);
            if (interaction.isCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) return;

                const options = interaction.options.data || null;
                let subCommand = '';
                if (options) {
                    subCommand = ' ';
                    for (const option of options) {
                        if (option.type === 1) { // SUB_COMMAND type
                            subCommand += `${option.name}`;
                            if (option.options) {
                                for (const subOption of option.options) {
                                    subCommand += ` ${subOption.name}: ${subOption.value}`;
                                }
                            }
                        } else if (option.type === 2) { // SUB_COMMAND_GROUP type
                            subCommand += `${option.name}`;
                            if (option.options) {
                                for (const subGroup of option.options) {
                                    if (subGroup.type === 1) { // SUB_COMMAND within group
                                        subCommand += ` ${subGroup.name}`;
                                        if (subGroup.options) {
                                            for (const subOption of subGroup.options) {
                                                subCommand += ` ${subOption.name}: ${subOption.value}`;
                                            }
                                        }
                                    }
                                }
                            }
                        } else {
                            // Regular option (not subcommand)
                            subCommand += ` ${option.name}: ${option.value}`;
                        }
                    }
                }
        
                if (guildSettings && guildSettings.allowedChannels.length > 0 && !guildSettings.allowedChannels.includes(interaction.channelId)) {
                    console.log('Channel not allowed');
                    return await safeReply(interaction, { content: t("bot_channel", interaction.locale), ephemeral: true });
                }
        
                if (profile && !isReadOnlyMode()) {
                    getSupabaseClient()
                        .from('players')
                        .update({ last_message_date: new Date().toISOString() })
                        .eq('user_id', interaction.user.id)
                        .then(() => {})
                        .catch(() => {});
                }
        
                try {
                    await command.execute(interaction);
                    logger.info(`[${interaction.guild.name}] - ${interaction.user.tag}: ${interaction.commandName} ${subCommand}`);
                } catch (error) {
                    logger.error(interaction.user.tag + ' | ' + interaction.commandName + ': ' + error);
                    // Distinguish "backend API is unreachable" (tagged by BaseAPIClient) from a
                    // normal command bug, so players get an accurate, actionable message instead
                    // of a generic one when the API is down.
                    const errorKey = error?.apiUnavailable ? "api_unavailable" : "command_error";
                    try {
                        await safeReply(interaction, { content: t(errorKey, interaction.locale) }, true);
                    } catch (replyError) {
                        logger.error(`Failed to send command_error reply: ${replyError}`);
                    }
                }
            }
        });

        client.login(token);

        process.on('SIGINT', function() {
            shutdownBot('Received SIGINT, shutting down gracefully.');
        });
        process.on('SIGTERM', function() {
            shutdownBot('Received SIGTERM, shutting down gracefully.');
        });
        process.on('unhandledRejection', (reason, promise) => {
            shutdownBot(`Unhandled Rejection at: ${promise} reason: ${reason}`);
        });
    } catch (error) {
        console.error('Startup error:', error);
        process.exit(1);
    }
}

function startHealthServer(client) {
    const portRaw = String(process.env.BOT_HEALTH_PORT || process.env.PORT || '').trim();
    const port = Number(portRaw);
    if (!portRaw || Number.isNaN(port) || port <= 0) return;

    const healthToken = String(process.env.BOT_HEALTH_TOKEN || '').trim();
    const server = http.createServer((req, res) => {
        const url = new URL(req.url || '/', 'http://localhost');

        if (url.pathname !== '/health') {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'not_found' }));
            return;
        }

        if (healthToken) {
            const headerToken = String(req.headers['x-bot-health-token'] || '').trim();
            const queryToken = String(url.searchParams.get('token') || '').trim();
            if (headerToken !== healthToken && queryToken !== healthToken) {
                res.statusCode = 401;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ status: 'unauthorized' }));
                return;
            }
        }

        const discordReady = Boolean(client?.isReady?.());

        const body = {
            status: 'ok',
            service: 'OctaneRPG Bot',
            timestamp: new Date().toISOString(),
            uptimeSeconds: Math.floor(process.uptime()),
            version: process.env.BOT_VERSION || packageVersion,
            discord: {
                ready: discordReady,
                ping: client?.ws?.ping ?? null,
                guilds: client?.guilds?.cache?.size ?? null,
                userTag: client?.user?.tag ?? null,
            },
        };

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(body));
    });

    server.listen(port, '127.0.0.1', () => {
        console.log(`✅ Bot health server listening on 127.0.0.1:${port}`);
    });
}

async function shutdownBot(reason) {
    const logger = await getLogger();
    logger.error(`Shutting down bot: ${reason}`);
    process.exit(0);
}

startBot();