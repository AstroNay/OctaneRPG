
const { DateTime } = require('luxon');
const { GameAPI } = require('./apiClient');

async function cleanGroups(client, logger, TIMEZONE) {
    const api = new GameAPI();
    client.guilds.cache.forEach(async guild => {
        try {
            await api.guildSettings.upsertGuildSettings({
                guildId: guild.id,
                name: guild.name,
                image: guild.iconURL(),
                ownerId: guild.ownerId || '',
                lastUpdate: DateTime.now().setZone(TIMEZONE).toJSDate(),
            });
        } catch (error) {
            logger.error('updateGuildSettings: ' + error);
        }
    });
}

async function checkGuildSettings(client, logger, guild, TIMEZONE) {
    try {
        const ownerId = guild.ownerId || '';
        let ownerUsername = '';
        try {
            const owner = await guild.fetchOwner();
            ownerUsername = owner?.user?.username || owner?.user?.tag || '';
        } catch (_) {}

        const api = new GameAPI();
        await api.guildSettings.upsertGuildSettings({
            guildId: guild.id,
            name: guild.name,
            image: guild.iconURL(),
            ownerId,
            ownerUsername,
        });
        logger.info(`Joined guild ${guild.name}, settings upserted`);
    } catch (error) {
        logger.error('guildCreate: ' + error);
    }
}

module.exports = {
    cleanGroups,
    checkGuildSettings
};
