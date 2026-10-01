const { SlashCommandBuilder, EmbedBuilder, ActionRow, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { GameAPI } = require('../utils/apiClient');
const { getLogger } = require('../utils/logging');
const { safeDeferReply, safeReply, safeButtonCollector } = require('../utils/interactionUtils');
const { t } = require('../utils/lang');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('challenges')
        .setDescription('View challenge progress.'),
    category: 'Rewards',
    async execute(interaction) {
        await safeDeferReply(interaction, false);
        let logger = await getLogger();
        const api = new GameAPI();
        
        try {
            const [profile, challengesData, streakData] = await Promise.all([
                api.getProfile(interaction.user.id),
                api.getAllChallengesWithProgress(interaction.user.id),
                api.getStreaks(interaction.user.id)
            ]);

            if (!profile) {
                return safeReply(interaction, t('no_profile', interaction.locale), true);
            }

            const streaks = streakData?.streaks || {};
            
            let page = 0;
            let category = 'Daily';
            let challenges = challengesData.daily;

            const v = await getChallengesEmbed(0, challenges, category, streaks);
            const message = await interaction.editReply({ embeds: [v.embed], components: [v.row] });
            
            safeButtonCollector(interaction, message, {
                allowedIds: [interaction.user.id],
                time: 60000,
                onCollect: async (i) => {
                    if (['next', 'previous'].includes(i.customId)) {
                        if (i.customId === 'next' && (page + 1) * 5 < challenges.length) {
                            page++;
                        } else if (i.customId === 'previous' && page > 0) {
                            page--;
                        }
                        const x = await getChallengesEmbed(page * 5, challenges, category, streaks);
                        await i.editReply({ embeds: [x.embed], components: [x.row] });
                    } else if (i.customId === 'daily' || i.customId === 'starter') {
                        category = i.customId.charAt(0).toUpperCase() + i.customId.slice(1);
                        challenges = i.customId === 'daily' ? challengesData.daily : challengesData.starter;
                        page = 0;
                        const z = await getChallengesEmbed(page * 5, challenges, category, streaks);
                        await i.editReply({ embeds: [z.embed], components: [z.row] });
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
            logger.error(interaction.user.tag + ' | challenges: ' + error);
            return safeReply(interaction, t('challenges_error', interaction.locale), true);
        }
    }
};

const STREAK_TARGET_TYPE_TO_KEYS = {
    race_won: ['daily_race_wins'],
    first_v2race: ['daily_race_participation'],
    startSupplyRun: ['daily_feast_runner'],
    getBlessing: ['daily_shrine_devotion'],
    junkyard_search: ['daily_junkyard_scavenger'],
};

function streakBar(count, max = 5, filledEmoji = '⭐', emptyEmoji = '☆') {
    const safeCount = Math.max(0, Number(count || 0));
    const filled = Math.min(max, safeCount);
    return `${filledEmoji.repeat(filled)}${emptyEmoji.repeat(max - filled)}`;
}

async function getChallengesEmbed(startIndex, challenges, currentCategory, streaks = {}) {
    const currentChallenges = challenges.slice(startIndex, startIndex + 5);
    const page = Math.floor(startIndex / 5);
    const isDaily = (currentCategory || '').toLowerCase() === 'daily';
    
    const embed = new EmbedBuilder()
        .setTitle(`**${currentCategory} Challenges**`)
        .setDescription(currentChallenges.map((ch, index) => {
            const progress = ch.userProgress?.progress || 0;
            const completed = ch.isCompleted ? ':white_check_mark:' : ':hourglass:';

            let streakLine = '';
            if (isDaily) {
                const keys = STREAK_TARGET_TYPE_TO_KEYS[(ch.targetType || '').toString()] || [];
                const key = keys[0];
                if (key && streaks[key]) {
                    const count = streaks[key]?.count || 0;
                    streakLine = `\nStreak: ${streakBar(count)} (${count})`;
                }
            }

            return `**${index + 1}**. ${ch.name} (${completed} ${progress}/${ch.targetCount})${streakLine}\nRewards: ${ch.xpReward} XP, ${ch.coinReward} Coins\n${ch.description}`;
        }).join('\n\n'))
        .setFooter({ text: `Page ${page + 1} of ${Math.ceil(challenges.length / 5)}` })
        .setColor(0x00AE86);
    
    const row = new ActionRowBuilder();
    row.addComponents(
        new ButtonBuilder().setCustomId('previous').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled((page + 1) * 5 >= challenges.length),
        new ButtonBuilder().setCustomId('daily').setLabel('Daily').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('starter').setLabel('Starter').setStyle(ButtonStyle.Success)
    );

    return { embed, row };
}


