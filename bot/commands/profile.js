const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { GameAPI } = require('../utils/apiClient');
const { calculateLevel, calculatePassiveIncome } = require('../utils/core');
const { getTotalStats } = require('../utils/racing');
const { generateAndCacheProfileImage } = require('../utils/profileUtils');
const { checkInventory } = require('../utils/core');
const { checkAndPromptPrestigeRedemption } = require('../utils/prestigeUtils');
const { getLogger } = require('../utils/logging');
const { DateTime } = require('luxon');
const { safeDeferReply, safeReply } = require('../utils/interactionUtils');
const { generatePartsGrid } = require('../utils/newprofileUtils');
const { t } = require('../utils/lang');
const { getDefinitionsCached } = require('../utils/identityUtils');
const { retroFooterNote } = require('../utils/retroLinks');
const { isReadOnlyMode } = require('../utils/readOnly');

module.exports = {
    data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View player profiles.')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The player you want to view')
            .setRequired(false)),
    category: 'General',
    async execute(interaction) {
        await safeDeferReply(interaction, false);
        let logger = await getLogger();
        const api = new GameAPI();
        const targetUser = interaction.options.getUser('user') || interaction.user;
        
        try {
            // Use batch endpoint to get both profile and vehicle data in a single call
            let dashboardData, profile, playerVehicle;
            
            try {
                dashboardData = await api.getPlayerDashboard(targetUser.id);
                profile = dashboardData.profile;
                playerVehicle = dashboardData.activeVehicle;
            } catch (batchError) {
                logger.debug(`Batch dashboard API failed, falling back to individual calls: ${batchError.message}`);
                
                // Fallback to individual API calls
                profile = await api.getProfile(targetUser.id);
                
                if (!profile) {
                    return safeReply(interaction, t('profile_not_found', interaction.locale, { username: targetUser.username }), true);
                }
                
                // Get active vehicle via API with correct response structure handling
                try {
                    const vehicleData = await api.getPlayerVehicles(targetUser.id);
                    if (vehicleData && vehicleData.vehicles && Array.isArray(vehicleData.vehicles)) {
                        // API returns { userId, activeVehicleId, vehicles: [...] }
                        playerVehicle = vehicleData.vehicles.find(v => v.isActive) || 
                                       vehicleData.vehicles.find(v => v.status === 'Active') || 
                                       vehicleData.vehicles[0];
                    }
                } catch (vehicleError) {
                    logger.debug(`Vehicle API failed, using fallback: ${vehicleError.message}`);
                    // Fallback: try to get from Supabase
                    const { tables } = require('../utils/supabase');
                    const { mapPlayerVehicleRow } = require('../utils/supabase/mappers');
                    const row = await tables.playerVehicles.getActiveVehicle(profile.userId);
                    playerVehicle = mapPlayerVehicleRow(row);
                }
            }
            
            // Only check for prestige redemption if viewing own profile
            if (targetUser.id === interaction.user.id) {
                if (await checkAndPromptPrestigeRedemption(profile, interaction)) {
                    return;
                }
            }
            
            if (!profile) {
                logger.error(`Profile is undefined for user: ${targetUser.id}`);
                return safeReply(interaction, t('profile_not_found', interaction.locale, { username: targetUser.username }), true);
            }
            
            // Ensure profile has required structure
            if (!profile.settings) {
                logger.warn(`Profile settings missing for user: ${targetUser.id}`);
                profile.settings = {};
            }
            
            if (!playerVehicle) {
                logger.warn(`${profile.username} has no vehicles available.`);
                return safeReply(interaction, t('profile_no_vehicles', interaction.locale, { username: targetUser.username }), true);
            }
            
            // Ensure we have a valid vehicle with required properties
            if (!playerVehicle.make || !playerVehicle.model) {
                logger.warn(`${profile.username} has invalid vehicle data:`, playerVehicle);
                return safeReply(interaction, t('profile_vehicle_corrupt', interaction.locale), true);
            }

            // Incidental syncs (challenge ping, avatar backfill) write state, so skip them in read-only mode.
            if (!isReadOnlyMode()) {
                // Update challenge via API - don't let challenge failures crash the command
                try {
                    await api.updateChallengeByType(targetUser.id, 'checkProfile');
                } catch (error) {
                    // Log but don't fail the entire command if challenge update fails
                    logger.debug(`Challenge update failed for profile command: ${error.message}`);
                }
                await tempUpdatePfp(profile, interaction);
            }

            let v = await profileEmbed(profile, playerVehicle, { viewerUserId: interaction.user.id });            
            await safeReply(interaction, { embeds: [v.embed], files: [v.attachment] }, false);
        } catch (error) {
            logger.error(interaction.user.tag+' | profile: '+error);
            return safeReply(interaction, t('profile_error', interaction.locale), true);
        }
    }
};

async function profileEmbed(profile, playerVehicle, opts = {}) {
    const api = new GameAPI();
    const definitions = await getDefinitionsCached(api);
    const levelInfo = calculateLevel(profile.xp);
    if (!isReadOnlyMode()) await tempUpdateLevel(profile, levelInfo);
    let progressText = `XP: ${Math.floor(profile.xp)} / ${Math.floor(levelInfo.nextLevelXp)} | ${Math.floor(levelInfo.remainingXp)} to next level`;
    if (levelInfo.progress < 0 || levelInfo.progress >= 1) {
        progressText = `XP: ${Math.floor(profile.xp)} | Max level`;
    }

    const vehicleStats = await getTotalStats(profile, playerVehicle);
    const passiveIncome = await calculatePassiveIncome(profile);
    const cleanCoins = Math.floor(profile.coins);
    const crewTag = profile.crew ? '\u200B\u200B\u200B['+profile.crew+']' : '';
    //const bannerImg = await generateAndCacheProfileImage(profile);
    //const attachment = new AttachmentBuilder(bannerImg, { name: 'profile.png' });
        const buffer = await generatePartsGrid(playerVehicle, playerVehicle.upgrades, levelInfo, profile);
        const attachment = new AttachmentBuilder(buffer, { name: 'parts.png' });
    
    // Get active boosters from API
    const boosters = await api.getActiveBoosters(profile.userId);
    const coinBooster = boosters.booster_coins ? 'Active' : 'Inactive';
    const xpBooster = boosters.booster_xp ? 'Active' : 'Inactive';
    const luckBooster = boosters.booster_luck ? 'Active' : 'Inactive';
    const pfp = profile.settings.pfpImage;
    const { getSupabaseClient } = require('../utils/supabase');
    const sb = getSupabaseClient();
    const { data: vehicleRows } = await sb.from('player_vehicles').select('wins, losses').eq('user_id', profile.userId);
    const trackWins = (vehicleRows || []).reduce((acc, v) => acc + (v.wins || 0), 0);
    const trackLosses = (vehicleRows || []).reduce((acc, v) => acc + (v.losses || 0), 0);
    
    // Identity system - Street Cred & Infamy
    const streetCred = profile.reputation || 0;
    const infamy = profile.identity?.infamy || 0;
    const activeTitleId = profile.identity?.titleId;
    const activeTitle = activeTitleId ? definitions.titles.find(t => t.id === activeTitleId) : null;
    const titleDisplay = activeTitle ? activeTitle.name : 'Rookie';
    
    // Pinned badges
    const pinnedBadgeIds = profile.identity?.pinnedBadgeIds || [];
    const pinnedBadges = pinnedBadgeIds
        .map(id => definitions.badges.find(b => b.id === id))
        .filter(Boolean)
        .map(badge => badge.name)
        .join(', ');
    
    // Perk points
    const perkPoints = profile.identity?.perkPoints || 0;
    const totalPerkPointsEarned = profile.identity?.totalPerkPointsEarned || 0;
    
    const luckyTokens = await checkInventory(profile, 'lucky_token');
    const basicCoupons = await checkInventory(profile, 'coupon_basic');
    const premiumCoupons = await checkInventory(profile, 'coupon_premium');
    const junkyardPasses = await checkInventory(profile, 'junkyard_pass');
    
    const embed = new EmbedBuilder()
        .setTitle(`:mag:  ${profile.username} - Level ${profile.level} ${crewTag}`)
        .setDescription(`**Title**: ${titleDisplay}\n**Power**: ${vehicleStats ? vehicleStats.totalPower.toLocaleString() : '—'} ⚡ | **Street Cred**: ${streetCred.toLocaleString()} | **Infamy**: ${infamy.toLocaleString()}`)
        .setImage('attachment://parts.png');

    // Only set thumbnail if pfp is a valid URL
    if (pfp && typeof pfp === 'string' && (pfp.startsWith('http://') || pfp.startsWith('https://'))) {
        try {
            embed.setThumbnail(pfp);
        } catch (error) {
            console.warn('Invalid thumbnail URL for profile:', pfp);
        }
    }

    embed.addFields(
            { name: 'Coins', value: `<:coins:1269411594685644800> ${cleanCoins.toLocaleString()}`, inline: true },
            { name: 'Tokens', value: `<:lotterytoken:1269399775065804862> ${luckyTokens.toLocaleString()}\n<:crewtoken:1269432351407083610> ${profile.crewTokens.toLocaleString()}\n<:junkyardpass:1273688549429870633> ${junkyardPasses.toLocaleString()}`, inline: true },
            { name: 'Feast', value: `<:feastSupplies:1286849566523654269> ${profile.feastSupplies}\n<:couponBasic:1286853815550742538> ${basicCoupons}\n<:couponPremium:1286853816859365408> ${premiumCoupons}`, inline: true },
            { name: 'Identity', value: `Perk Points: ${perkPoints} (${totalPerkPointsEarned} earned)${pinnedBadges ? `\nBadges: ${pinnedBadges}` : ''}`, inline: false },
            { name: 'Dailies Collected', value: `${profile.dailyCount}`, inline: true },
            { name: 'Weeklies Collected', value: `${profile.weeklyCount}`, inline: true },
            { name: 'Jobs Worked', value: `${profile.workCount}`, inline: true },
            { name: 'Boosters', value: `XP: ${xpBooster}\nCoin: ${coinBooster}\nLuck: ${luckBooster}`, inline: true },
            { name: 'Income', value: `<:coins:1269411594685644800> ${passiveIncome.moneyIncome.toLocaleString()}/hr\nXP ${passiveIncome.xpIncome.toLocaleString()}/hr`, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'Active Vehicle', value: `${playerVehicle.make} ${playerVehicle.model}\nFuel: ${playerVehicle.stats?.currentFuel?.toLocaleString() ?? '?'}%\nFuel Type: ${playerVehicle.fuelType ?? playerVehicle.fuel_type ?? '?'}\n\nStock Power: ${vehicleStats ? vehicleStats.horsepower + vehicleStats.torque + vehicleStats.brakes + vehicleStats.suspension + vehicleStats.aero + vehicleStats.grip : '—'}`, inline: true },
            { name: 'Races', value: `**Track Stats**:\n${trackWins}W / ${trackLosses}L\n(${trackWins+trackLosses} Total)`, inline: true }
        )
        .setFooter({ text: `${progressText} • ${retroFooterNote()}` })
        .setColor(profile.settings.customColor || '#00ff00');
    
    return { embed, attachment };
}

async function tempUpdatePfp(profile, interaction) {
    if (!profile || !profile.settings) {
        console.warn('Profile or profile.settings is undefined in tempUpdatePfp');
        return;
    }
    
    const now = DateTime.now().setZone('America/New_York');
    if (!profile.settings.pfpImage) {
        let newPfp = null;
        
        // Safely construct Discord avatar URL
        if (interaction.user.avatar) {
            newPfp = `https://cdn.discordapp.com/avatars/${interaction.user.id}/${interaction.user.avatar}.png?size=256`;
        } else {
            // Use default Discord avatar if user has no custom avatar
            const defaultAvatarId = parseInt(interaction.user.discriminator) % 5;
            newPfp = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarId}.png`;
        }
        
        console.log("Setting profile picture:", newPfp);
        
        // Use API client to update profile since profile is now a plain object
        const api = new GameAPI();
        try {
            // Note: Backend might not support nested field updates like 'settings.pfpImage'
            // This may need adjustment depending on UpdatePlayerDto structure
            await api.updateProfile(interaction.user.id, {
                'settings.pfpImage': newPfp,
                'settings.profileLastUpdate': now
            });
        } catch (error) {
            // Log but don't fail if profile picture update fails
            console.debug('Failed to update profile picture via API:', error.message);
        }
    }
}

async function tempUpdateLevel(profile, levelInfo) {
    if (profile.level !== levelInfo.level) {
        // Use API client to update profile since profile is now a plain object
        const api = new GameAPI();
        await api.updateProfile(profile.userId, {
            level: levelInfo.level
        });
    }
}


