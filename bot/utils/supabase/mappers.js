/**
 * Supabase row mappers
 *
 * Converts Supabase table rows (snake_case) to the camelCase field shape
 * the bot's commands consume.
 */

function mapPlayerRow(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    guildId: row.guild_id,
    username: row.username,
    coins: row.coins,
    xp: row.xp,
    level: row.level,
    lastCachedXp: row.last_cached_xp,
    lastAFKClaim: row.last_afk_claim ? new Date(row.last_afk_claim) : null,
    lastXpTime: row.last_xp_time ? new Date(row.last_xp_time) : null,
    lastDaily: row.last_daily ? new Date(row.last_daily) : null,
    lastWeekly: row.last_weekly ? new Date(row.last_weekly) : null,
    lastWorkTime: row.last_work_time ? new Date(row.last_work_time) : null,
    lastLotteryPlay: row.last_lottery_play ? new Date(row.last_lottery_play) : null,
    lastRefuel: row.last_refuel ? new Date(row.last_refuel) : null,
    lastCrewDonation: row.last_crew_donation ? new Date(row.last_crew_donation) : null,
    crew: row.crew_tag,
    crewTokens: row.crew_tokens,
    dailyCount: row.daily_count,
    weeklyCount: row.weekly_count,
    workCount: row.work_count,
    lotteryCount: row.lottery_count,
    feastSupplies: row.feast_supplies,
    lastFeastRun: row.last_feast_run ? new Date(row.last_feast_run) : null,
    reputation: row.reputation,
    heatLevel: row.heat_level,
    heatLevelTime: row.heat_level_time ? new Date(row.heat_level_time) : null,
    heatLevelMax: row.heat_level_max,
    heatLevelMaxTime: row.heat_level_max_time ? new Date(row.heat_level_max_time) : null,
    shrineXP: row.shrine_xp,
    prestigeLevel: row.prestige_level,
    prestigeTokens: row.prestige_tokens,
    job: row.job_tag,
    junkyardVisits: row.junkyard_visits,
    lastJunkyardVisit: row.last_junkyard_visit ? new Date(row.last_junkyard_visit) : null,
    retiredStats: row.retired_stats,
    activeVehicleId: row.active_vehicle_id,
    isBanned: row.is_banned,
    banUntil: row.ban_until ? new Date(row.ban_until) : null,
    banReason: row.ban_reason,
    joinDate: row.join_date ? new Date(row.join_date) : null,
    lastMessageDate: row.last_message_date ? new Date(row.last_message_date) : null,
    streaks: row.streaks || {},
    lastDailyChallengeResetDay: row.last_daily_challenge_reset_day,
    identity: row.identity || null,
  };
}

/**
 * Maps a getPlayerFull() result ({ player, settings, stats, bank }) to a
 * single profile object with nested settings/stats/bank.
 */
function mapPlayerFull({ player, settings, stats, bank }) {
  const profile = mapPlayerRow(player);
  if (!profile) return null;

  if (settings) {
    profile.settings = {
      profileImage: settings.profile_image,
      profileLastUpdate: settings.profile_last_update ? new Date(settings.profile_last_update) : null,
      profileImageLastUpdate: settings.profile_image_last_update ? new Date(settings.profile_image_last_update) : null,
      backgroundColor: settings.background_color,
      borderColor: settings.border_color,
      xpColor: settings.xp_color,
      customImage: settings.custom_image,
      pfpImage: settings.pfp_image,
    };
  }

  if (stats) {
    profile.stats = {
      speed: stats.speed,
      acceleration: stats.acceleration,
      grip: stats.grip,
      suspension: stats.suspension,
      brakes: stats.brakes,
      torque: stats.torque,
      horsepower: stats.horsepower,
      aero: stats.aero,
      durability: stats.durability,
      luck: stats.luck,
      fuelEfficiency: stats.fuel_efficiency,
    };
  }

  if (bank) {
    // Flatten the bank row onto the profile (profile.bank, profile.maxBankCapacity)
    profile.bank = bank.balance ?? 0;
    profile.maxBankCapacity = bank.capacity ?? 100000;
  }

  return profile;
}

function mapPlayerVehicleRow(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    vehicleId: row.vehicle_id,
    userId: row.user_id,
    make: row.make,
    model: row.model,
    year: row.year,
    image: row.image,
    isActive: row.is_active,
    isStarterCar: row.is_starter_car,
    status: row.status,
    fuelType: row.fuel_type,
    purchasedDate: row.purchased_date ? new Date(row.purchased_date) : null,
    stats: {
      grip: row.stat_grip,
      suspension: row.stat_suspension,
      brakes: row.stat_brakes,
      torque: row.stat_torque,
      horsepower: row.stat_horsepower,
      aero: row.stat_aero,
      durability: row.stat_durability,
      fuelCapacity: row.fuel_capacity,
      currentFuel: row.current_fuel,
    },
    raceTrackStats: {
      raceCount: row.race_count,
      wins: row.wins,
      losses: row.losses,
      highestLevelUnlocked: row.highest_level_unlocked,
      highestBossWin: row.highest_boss_win,
      lastRaceDate: row.last_race_date ? new Date(row.last_race_date) : null,
    },
    upgrades: (row.player_vehicle_upgrades || []).map((u) => ({
      type: u.type,
      level: u.level,
      stats: {
        grip: u.grip,
        suspension: u.suspension,
        brakes: u.brakes,
        torque: u.torque,
        horsepower: u.horsepower,
        aero: u.aero,
        durability: u.durability,
      },
    })),
  };
}

function mapGuildSettingsRow(row) {
  if (!row) return null;
  return {
    guildId: row.guild_id,
    name: row.name,
    image: row.image,
    ownerId: row.owner_id,
    ownerUsername: row.owner_username,
    allowedChannels: row.allowed_channels || [],
    levelupMessages: row.levelup_messages,
    levelupChannel: row.levelup_channel,
    levelupColor: row.levelup_color,
    levelupAnnounceEvery: row.levelup_announce_every,
    levelupTemplate: row.levelup_template,
    carMeetChannel: row.car_meet_channel,
    carMeetMessage: row.car_meet_message,
    lastUpdate: row.updated_at ? new Date(row.updated_at) : null,
  };
}

function mapPlayerItemRow(row) {
  if (!row) return null;
  return {
    _id: row.id,
    userId: row.user_id,
    itemId: row.item_id,
    quantity: row.quantity,
    acquiredAt: row.acquired_at ? new Date(row.acquired_at) : null,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    condition: row.condition,
    category: row.category,
    rarity: row.rarity,
    value: row.value,
  };
}

module.exports = { mapPlayerRow, mapPlayerFull, mapPlayerVehicleRow, mapGuildSettingsRow, mapPlayerItemRow };
