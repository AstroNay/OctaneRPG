const { t } = require('./lang');

/**
 * Format awards payload into user-friendly message lines
 * @param {Object} awards - Awards object from API response
 * @param {Object} definitions - Identity definitions (titles, badges, perks)
 * @param {string} locale - User's locale for i18n
 * @returns {string[]} Array of formatted award messages
 */
function formatAwardsToast(awards, definitions, locale = 'en-US') {
    if (!awards) return [];
    
    const messages = [];
    
    // Street Cred gain
    if (awards.reputationDelta > 0) {
        messages.push(`✨ **+${awards.reputationDelta} Street Cred** (${awards.totalReputation} total)`);
    }
    
    // Infamy gain (for future crime system)
    if (awards.infamyDelta > 0) {
        messages.push(`🔥 **+${awards.infamyDelta} Infamy** (${awards.totalInfamy} total)`);
    }
    
    // New titles unlocked
    if (awards.newTitles && awards.newTitles.length > 0) {
        for (const titleId of awards.newTitles) {
            const title = definitions.titles.find(t => t.id === titleId);
            const titleName = title ? title.name : titleId;
            messages.push(`🏆 **Title Unlocked:** ${titleName}`);
        }
    }
    
    // New badges earned
    if (awards.newBadges && awards.newBadges.length > 0) {
        for (const badgeId of awards.newBadges) {
            const badge = definitions.badges.find(b => b.id === badgeId);
            const badgeName = badge ? badge.name : badgeId;
            messages.push(`🎖️ **Badge Earned:** ${badgeName}`);
        }
    }
    
    // Perk points earned
    if (awards.perkPointsEarned > 0) {
        messages.push(`⭐ **+${awards.perkPointsEarned} Perk Point${awards.perkPointsEarned > 1 ? 's' : ''}!** (${awards.totalPerkPoints} available)`);
    }
    
    return messages;
}

/**
 * Calculate active perk bonuses for a player
 * @param {Object} profile - Player profile with identity.perks
 * @param {Object} definitions - Identity definitions
 * @param {string} target - Target to calculate bonus for (e.g., 'junkyard_scrap_value')
 * @returns {Object} { multiplier, reduction, bonus } - Calculated bonuses
 */
function calculatePerkBonuses(profile, definitions, target) {
    const ownedPerks = profile?.identity?.perks || [];
    
    let totalMultiplier = 0;
    let totalReduction = 0;
    let totalBonus = 0;
    
    for (const owned of ownedPerks) {
        const perkDef = definitions.perks.find(p => p.id === owned.perkId);
        if (!perkDef) continue;
        
        const level = owned.level || 0;
        if (level === 0) continue;
        
        // Get effect for current level (0-indexed: level 1 = effects[0])
        const effect = perkDef.effects?.[level - 1];
        if (!effect || effect.target !== target) continue;
        
        // Accumulate bonuses by type
        if (effect.type === 'multiplier') {
            totalMultiplier += effect.value;
        } else if (effect.type === 'reduction') {
            totalReduction += effect.value;
        } else if (effect.type === 'bonus') {
            totalBonus += effect.value;
        }
    }
    
    return {
        multiplier: totalMultiplier,  // e.g., 0.30 = +30%
        reduction: totalReduction,    // e.g., 0.15 = -15%
        bonus: totalBonus            // e.g., 0.05 = +5%
    };
}

/**
 * Apply perk multiplier to a base value
 * @param {number} baseValue - Base value before bonuses
 * @param {number} multiplier - Multiplier from perks (e.g., 0.30 for +30%)
 * @returns {number} Final value after multiplier
 */
function applyPerkMultiplier(baseValue, multiplier) {
    return Math.floor(baseValue * (1 + multiplier));
}

/**
 * Apply perk reduction to a base value (for costs/cooldowns)
 * @param {number} baseValue - Base value before reduction
 * @param {number} reduction - Reduction from perks (e.g., 0.15 for -15%)
 * @returns {number} Final value after reduction
 */
function applyPerkReduction(baseValue, reduction) {
    return Math.floor(baseValue * (1 - reduction));
}


/**
 * Get a summary line for awards (compact version for embeds)
 * @param {Object} awards - Awards object from API response
 * @returns {string} Single-line summary
 */
function getAwardsSummary(awards) {
    if (!awards) return null;
    
    const parts = [];
    
    if (awards.reputationDelta > 0) {
        parts.push(`+${awards.reputationDelta} Cred`);
    }
    
    if (awards.infamyDelta > 0) {
        parts.push(`+${awards.infamyDelta} Infamy`);
    }
    
    if (awards.newTitles && awards.newTitles.length > 0) {
        parts.push(`${awards.newTitles.length} Title${awards.newTitles.length > 1 ? 's' : ''}`);
    }
    
    if (awards.perkPointsEarned > 0) {
        parts.push(`+${awards.perkPointsEarned} PP`);
    }
    
    return parts.length > 0 ? `✨ ${parts.join(' • ')}` : null;
}

/**
 * Send awards as a follow-up message (for commands that defer reply)
 * @param {Object} interaction - Discord interaction
 * @param {Object} awards - Awards object from API response
 * @param {Object} definitions - Identity definitions
 */
async function sendAwardsFollowUp(interaction, awards, definitions) {
    if (!awards || !interaction) return;
    
    const messages = formatAwardsToast(awards, definitions, interaction.locale);
    if (messages.length === 0) return;
    
    try {
        await interaction.followUp({
            content: messages.join('\n'),
            ephemeral: true
        });
    } catch (error) {
        // Silent fail - awards display is nice-to-have
        console.error('[Awards] Failed to send follow-up:', error.message);
    }
}

/**
 * Add awards field to an embed
 * @param {EmbedBuilder} embed - Discord embed to add awards to
 * @param {Object} awards - Awards object from API response
 * @param {Object} definitions - Identity definitions
 * @returns {EmbedBuilder} Modified embed
 */
function addAwardsToEmbed(embed, awards, definitions) {
    if (!awards) return embed;
    
    const messages = formatAwardsToast(awards, definitions);
    if (messages.length === 0) return embed;
    
    embed.addFields({
        name: '🎁 Rewards',
        value: messages.join('\n'),
        inline: false
    });
    
    return embed;
}

/**
 * Cache for identity definitions (avoid repeated API calls)
 */
let definitionsCache = null;
let definitionsCacheTime = 0;
const CACHE_TTL = 3600000; // 1 hour

/**
 * Get identity definitions with caching
 * @param {GameAPI} api - API client instance
 * @returns {Promise<Object>} Definitions object
 */
async function getDefinitionsCached(api) {
    const now = Date.now();
    
    if (definitionsCache && (now - definitionsCacheTime) < CACHE_TTL) {
        return definitionsCache;
    }
    
    try {
        definitionsCache = await api.getIdentityDefinitions();
        definitionsCacheTime = now;
        return definitionsCache;
    } catch (error) {
        // Fallback to local file if API fails
        console.error('[Identity] Failed to load definitions from API:', error.message);
        try {
            definitionsCache = require('../data/identity-definitions.json');
            definitionsCacheTime = now;
            return definitionsCache;
        } catch {
            // Return minimal structure
            return { titles: [], badges: [], achievements: [], perks: [], version: 1 };
        }
    }
}

module.exports = {
    formatAwardsToast,
    getAwardsSummary,
    sendAwardsFollowUp,
    addAwardsToEmbed,
    getDefinitionsCached,
    calculatePerkBonuses,
    applyPerkMultiplier,
    applyPerkReduction
};
