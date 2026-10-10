const { DateTime } = require('luxon');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getLogger } = require('./logging');
const { safeDeferReply, safeReply } = require('../utils/interactionUtils');
const { GameAPI } = require('./api');
const { assertWritable } = require('./readOnly');
const TIMEZONE = 'America/New_York';
const levelXpTable = require('../data/level_xp.json');

function calculateLevel(xp) {
    let level = 1;
    for (let i = levelXpTable.length - 1; i >= 0; i--) {
        if (xp >= levelXpTable[i]) {
            level = i + 1;
            break;
        }
    }
    const currentLevelXp = levelXpTable[level - 1] || 0;
    const nextLevelXp = levelXpTable[level] || currentLevelXp;
    const remainingXp = nextLevelXp - xp;
    const progress = nextLevelXp > currentLevelXp
        ? (xp - currentLevelXp) / (nextLevelXp - currentLevelXp)
        : 1;

    return {
        level,
        currentLevelXp,
        remainingXp,
        nextLevelXp,
        progress
    };
}

async function calculateShrineLevel(xp) {
    let level = 1;
    if (xp >= 100000) { // 10000 / 5 = 2000 blessings
        level = 6;
    } else if (xp >= 5000) { // 5000 / 5 = 1000 blessings
        level = 5;
    } else if (xp >= 2500) { // 2500 / 5 = 500 blessings
        level = 4;
    } else if (xp >= 1000) { // 1000 / 5 = 200 blessings
        level = 3;
    } else if (xp >= 500) { // 500 / 5 = 100 blessings
        level = 2;
    }
    return level;
}

async function rewardsTable(prof) {
    let logger = await getLogger();
    const now = DateTime.now().setZone(TIMEZONE);
    try {

        const minXp = prof.level * 2;
        const maxXp = prof.level * 10;
        const xpBooster = prof.booster_xp > now ? 2 : 1;
        const chatXP = Math.floor(Math.random() * (maxXp - minXp + 1) + minXp) * xpBooster;
        const workXP = Math.floor(Math.random() * (125 - 75 + 1) + 75) * xpBooster;
        const dailyCoins = prof.level * 100 || 100;
        const weeklyCoins = prof.level * 500 || 500;
        if (isNaN(dailyCoins)) {
            logger.warn('Daily coins calculation resulted in NaN');
            throw new Error('Invalid daily coins calculation');
        }
        return { chatXP, workXP, dailyCoins, weeklyCoins };
    } catch (err) {
        logger.error(prof.userId+' | rewardsTable: '+err);
        throw err;
    }
}

async function calculatePassiveIncome(profile) {
    const now = DateTime.now().setZone(TIMEZONE);
    const xpBooster = profile.booster_xp > now ? 2.0 : 1.0;
    const moneyBooster = profile.booster_xp > now ? 2.0 : 1.0;
    const xpIncome = (profile.level * 1.5) * xpBooster;
    const moneyIncome = (profile.level * 50) * moneyBooster;
    return { xpIncome, moneyIncome };
}

async function getItemDetails(item, quantity) {
    let logger = await getLogger();
    const api = new GameAPI();
    const itemData = await api.inventory.getStoreItem(item);
    if (!itemData) return null;


    if (isNaN(itemData.value) || typeof itemData.value !== 'number') {
        logger.error(`Invalid item value for ${item}: ${itemData.value}`);
        return null;
    }

    return {
        itemId: itemData.itemId,
        name: itemData.name,
        totalCost: itemData.value * (quantity || 1),
        currency: itemData.currency, // 'coins' or 'CrewTokens'
        type: itemData.type,
        enabled: itemData.enabled
    };
}

function normalizeHexColor(input) {
    if (!input) return null;
    const raw = String(input).trim();
    const hex = raw.startsWith('#') ? raw.slice(1) : raw;
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    return `#${hex.toLowerCase()}`;
}

function formatLevelUpTemplate(template, { userMention, username, level, oldLevel }) {
    const base = String(template || '');
    return base
        .replaceAll('{user}', userMention)
        .replaceAll('{username}', username)
        .replaceAll('{level}', String(level))
        .replaceAll('{oldLevel}', String(oldLevel));
}

function getProfileLevelSafe(profile) {
    const level = Number(profile?.level);
    if (Number.isFinite(level) && level > 0) return level;
    const xp = Number(profile?.xp);
    if (Number.isFinite(xp)) {
        return calculateLevel(xp).level;
    }
    return 1;
}

async function getBotMemberSafe(guild) {
    if (!guild) return null;
    let me = guild.members?.me || null;
    if (!me && guild.members?.fetchMe) {
        try {
            me = await guild.members.fetchMe();
        } catch (_) {
            me = null;
        }
    }
    return me;
}

async function canBotPostEmbedInChannel(interaction, channel) {
    const guild = interaction?.guild;
    if (!guild || !channel?.permissionsFor) return false;
    const me = await getBotMemberSafe(guild);
    if (!me) return false;
    const perms = channel.permissionsFor(me);
    if (!perms) return false;
    return (
        perms.has(PermissionFlagsBits.ViewChannel) &&
        perms.has(PermissionFlagsBits.SendMessages) &&
        perms.has(PermissionFlagsBits.EmbedLinks)
    );
}

async function withLevelUpCheck(userId, interaction, operation, options = {}) {
    const logger = await getLogger();
    const api = new GameAPI();

    const preProfile = options.preProfile || await api.getProfile(userId);
    const preLevel = getProfileLevelSafe(preProfile);

    const result = await operation();

    const postProfile = options.postProfile || await api.getProfile(userId);
    const postLevel = getProfileLevelSafe(postProfile);

    if (postLevel > preLevel) {
        const announceProfile = {
            ...postProfile,
            userId: postProfile?.userId || userId,
            username: postProfile?.username || preProfile?.username || interaction?.user?.username,
            level: postLevel,
        };
        await levelUp(announceProfile, interaction, postLevel, { oldLevel: preLevel });
    }

    return { result, preProfile, postProfile, preLevel, postLevel };
}

async function giveXP(profile, xp, source, interaction) {
    assertWritable('giveXP');
    let logger = await getLogger();
    const api = new GameAPI();
    const now = DateTime.now().setZone(TIMEZONE);
    if (!profile) {
        logger.error('Profile not found');
        return;
    }
    const preLevel = profile.level || 1;

    // Check active XP booster via API (degrade gracefully if API is down)
    let xpBooster = 1;
    try {
        const boosters = await api.inventory.getActiveBoosters(profile.userId);
        xpBooster = boosters?.booster_xp ? 2 : 1;
    } catch (error) {
        logger.debug(`${profile.userId} | giveXP booster check failed: ${error?.message || error}`);
    }
    xp = Math.floor(xp * xpBooster);

    profile.xp += xp;
    profile.lastXpTime = now.toJSDate();

    try {
        const postLevelInfo = calculateLevel(profile.xp);
        const postLevel = postLevelInfo.level;

        profile.level = postLevel;
        await api.updateProfile(profile.userId, { xp: profile.xp, level: postLevel, lastXpTime: profile.lastXpTime });
        logger.debug(`${profile.username} earned ${xp} XP with ${xpBooster}x booster from ${source}`);
        if (postLevel > preLevel) {
            logger.debug(`${profile.username} leveled up to ${postLevel}!!`);
            await levelUp(profile, interaction, postLevel, { oldLevel: preLevel });
            return true;
        };

    } catch (error) {
        logger.error(profile.userId+' | giveXP: '+error);
        return false;
    }
}

async function levelUp(profile, interaction, postLevel, options = {}) {
    const logger = await getLogger();
    if (!interaction) return;
    const guild = interaction.guildId;
    const api = new GameAPI();
    const settings = await api.guildSettings.getGuildSettings(guild);
    if (settings && settings.levelupMessages && settings.levelupChannel !== '0' && settings.levelupChannel && interaction) {
        try {
            const announceEvery = Math.max(1, Number(settings.levelupAnnounceEvery || 1));
            if (announceEvery > 1 && (postLevel % announceEvery) !== 0) {
                return;
            }

            const client = interaction.client;
            let channel = client.channels.cache.get(settings.levelupChannel);
            if (!channel) {
                try {
                    channel = await client.channels.fetch(settings.levelupChannel);
                } catch (fetchError) {
                    logger.warn(`levelUp: failed to fetch channel ${settings.levelupChannel} in guild ${guild}: ${fetchError?.message || fetchError}`);
                }
            }

            // Prefer configured channel if bot can post there; otherwise fall back to the interaction channel.
            let targetChannel = null;
            let usedFallback = false;
            if (channel && channel.isTextBased && channel.isTextBased() && await canBotPostEmbedInChannel(interaction, channel)) {
                targetChannel = channel;
            } else if (interaction.channel && interaction.channel.isTextBased && interaction.channel.isTextBased() && await canBotPostEmbedInChannel(interaction, interaction.channel)) {
                targetChannel = interaction.channel;
                usedFallback = true;
            }

            if (targetChannel) {
                const color = normalizeHexColor(settings.levelupColor) || '#00ff00';
                const userMention = `<@${profile.userId}>`;
                const oldLevel = Math.max(1, Number(options.oldLevel || 0) || Math.max(1, Number(profile.level || postLevel) - 1));

                const template = settings.levelupTemplate || '';
                const description = template
                    ? formatLevelUpTemplate(template, {
                        userMention,
                        username: profile.username,
                        level: postLevel,
                        oldLevel,
                    })
                    : `🏁 ${userMention} just shifted into **Level ${postLevel}**!\n💨 Keep pushing—next race awaits.`;

                const embed = new EmbedBuilder()
                    .setColor(color)
                    .setTitle('🏎️ Level Up!')
                    .setDescription(description)
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setTimestamp();

                try {
                    await targetChannel.send({ embeds: [embed] });
                } catch (sendError) {
                    const code = sendError?.code;
                    const isAccessError = code === 50001 || code === 50013;
                    if (!usedFallback && isAccessError && interaction.channel && interaction.channel.isTextBased && interaction.channel.isTextBased()) {
                        // Last-ditch fallback to the current channel.
                        try {
                            if (await canBotPostEmbedInChannel(interaction, interaction.channel)) {
                                await interaction.channel.send({ embeds: [embed] });
                                usedFallback = true;
                            }
                        } catch (_) {
                            // ignore
                        }
                    }

                    if (isAccessError) {
                        logger.warn(`${profile.userId} | levelUp: cannot post in configured channel (guild=${guild} channel=${settings.levelupChannel}) code=${code}`);
                        if (usedFallback) {
                            await safeReply(
                                interaction,
                                {
                                    content:
                                        `I couldn't post level-up messages in <#${settings.levelupChannel}> (missing access). ` +
                                        `I posted it in this channel instead. Update it with /settings levelup channel:#channel`,
                                    ephemeral: true,
                                },
                                true,
                            );
                        } else {
                            await safeReply(
                                interaction,
                                {
                                    content:
                                        `I couldn't post level-up messages in <#${settings.levelupChannel}> (missing access). ` +
                                        `Choose a channel I can access via /settings levelup channel:#channel`,
                                    ephemeral: true,
                                },
                                true,
                            );
                        }
                        return;
                    }

                    throw sendError;
                }
            } else {
                logger.warn(`levelUp: no accessible text channel found (guild=${guild} configured=${settings.levelupChannel} interactionChannel=${interaction.channelId})`);
            }
        } catch (error) {
            logger.error(profile.userId+' | levelUp: '+error);
        }
    }
}

async function purchaseItem(profile, itemId, quantity = 1) {
    const api = new GameAPI();
    try {
        await api.inventory.purchaseStoreItem(profile.userId, itemId, quantity);
        return true;
    } catch (error) {
        if (error?.message?.includes('Insufficient') || error?.message?.includes('insufficient')) {
            return false;
        }
        throw error;
    }
}

async function useItem(profile, itemId, quantity = 1) {
    const api = new GameAPI();
    const itemData = await api.inventory.getStoreItem(itemId);
    if (!itemData) throw new Error('Item not found.');

    // Get current inventory from API
    const { inventory } = await api.inventory.getInventory(profile.userId);
    const playerItem = inventory.find(item => item.itemId === itemId);
    if (!playerItem || playerItem.quantity < quantity) {
        return false;
    }
    
    // Remove item via API (tag for inventory_events attribution)
    await api.inventory.removeInventoryItem(profile.userId, itemId, quantity, {
        reason: `useItem:${itemId}`,
        source: 'bot:core',
    });

    // Handle booster activation via API
    if (itemId === 'booster_xp' || itemId === 'booster_coins' || itemId === 'booster_luck') {
        const boosterType = itemId.replace('booster_', '');
        await api.inventory.activateBooster(profile.userId, boosterType, 24);
    } else if (itemId === 'junkyard_pass') {
        const lastJunkyardVisit = DateTime.now().toJSDate();
        const junkyardVisits = (profile.junkyardVisits || 0) + 1;
        profile.lastJunkyardVisit = lastJunkyardVisit;
        profile.junkyardVisits = junkyardVisits;
        await api.updateProfile(profile.userId, { lastJunkyardVisit, junkyardVisits });
    } else if (itemId === 'lucky_token') {
        const lastLotteryPlay = DateTime.now().setZone(TIMEZONE).toJSDate();
        const lotteryCount = (profile.lotteryCount || 0) + quantity;
        profile.lastLotteryPlay = lastLotteryPlay;
        profile.lotteryCount = lotteryCount;
        await api.updateProfile(profile.userId, { lastLotteryPlay, lotteryCount });
    } else if (itemId === 'coupon_basic' || itemId === 'coupon_premium') {
        const supplyCouponsSpent = (profile.supplyCouponsSpent || 0) + 1;
        profile.supplyCouponsSpent = supplyCouponsSpent;
        await api.updateProfile(profile.userId, { supplyCouponsSpent });
    }

    return true;
}

async function checkInventory(profile, itemId) {
    const api = new GameAPI();

    // Get inventory from PlayerItem collection via API
    let inventoryArray = [];
    const response = await api.getInventory(profile.userId);
    const { inventory } = response || {};
    inventoryArray = Array.isArray(inventory) ? inventory : [];

    const playerItem = inventoryArray.find(item => item.itemId === itemId);
    
    // Daily lucky token refresh logic - only at midnight if last play was yesterday
    if (itemId === 'lucky_token' && profile.lastLotteryPlay) {
        const lastLotteryPlay = DateTime.fromJSDate(profile.lastLotteryPlay).setZone(TIMEZONE);
        const now = DateTime.now().setZone(TIMEZONE);
        
        // Check if we've crossed midnight since last lottery play
        const lastPlayDate = lastLotteryPlay.startOf('day');
        const currentDate = now.startOf('day');
        
        // Only refresh if it's a new day AND we have less than 5 tokens
        const lotteryTokens = playerItem ? playerItem.quantity : 0;
        if (currentDate > lastPlayDate && lotteryTokens < 5) {
            const tokensToGive = 5 - lotteryTokens;
            await giveItem(profile, 'lucky_token', tokensToGive, 'Daily Reset');
            return 5;
        }
    }
    
    if (!playerItem) {
        return 0;
    } else {
        return playerItem.quantity;
    }
}

async function purchaseVehicle(profile, vehicle) {
    const api = new GameAPI();
    return api.vehicle.purchaseVehicle(profile.userId, vehicle._id || vehicle.id, vehicle.price);
}

async function sellVehicle(profile, vehicle) {
    const api = new GameAPI();
    const garage = await api.vehicle.getGarage(profile.userId);
    const vehicles = Array.isArray(garage?.vehicles) ? garage.vehicles : Array.isArray(garage) ? garage : [];
    const catalogId = String(vehicle._id || vehicle.id || '');
    const playerVehicle = vehicles.find(v =>
        String(v.vehicleId) === catalogId || String(v.vehicleId?.id || v.vehicleId?._id || '') === catalogId
    );
    if (!playerVehicle) return false;
    await api.vehicle.sellVehicle(profile.userId, playerVehicle._id || playerVehicle.id);
    return true;
}

module.exports = {
    calculateLevel,
    calculateShrineLevel,
    rewardsTable,
    calculatePassiveIncome,
    getItemDetails,
    giveXP,           // Used by race.js - now checks boosters via API
    levelUp,          // For commands that award XP via API and need to announce
    withLevelUpCheck, // Wrap any XP-granting operation and auto-announce
    checkInventory,   // Used by profile.js - now queries PlayerItem via API
    useItem,          // For item consumption with booster activation
    purchaseItem,     // For store purchases
    purchaseVehicle,  // For vehicle purchases
    sellVehicle       // For vehicle sales
};

