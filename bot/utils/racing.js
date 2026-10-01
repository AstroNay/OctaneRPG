const { DateTime } = require('luxon');
const { getLogger } = require('./logging');
const { GameAPI } = require('./api');

async function getWeatherCondition(track) {
    const api = new GameAPI();
    try {
        return await api.getWeatherCondition(track.type);
    } catch (error) {
        // Fallback to local calculation
        const conditions = ["Clear", "Rain", "Snow", "Windy"];
        let baseWeights = [0.75, 0.15, 0.0, 0.05];

        if (track.type === "Offroad") {
            baseWeights = [0.6, 0.25, 0.1, 0.05];
        } else if (track.type === "Speedway") {
            baseWeights = [0.8, 0.1, 0.05, 0.05];
        } else if (track.type === "Hillclimb") {
            baseWeights = [0.7, 0.2, 0.05, 0.05];
        }

        const randomIndex = Math.random() < baseWeights[1] ? 1 : 0;
        return conditions[randomIndex];
    }
};

async function getVehicleStats(profile, vehicle) {
    const api = new GameAPI();
    let logger = await getLogger();
    
    try {
        const result = await api.getVehicleStats(profile.userId, vehicle._id);
        return {
            horsepower: result.stock.horsepower,
            torque: result.stock.torque,
            grip: result.stock.grip,
            suspension: result.stock.suspension,
            brakes: result.stock.brakes,
            aero: result.stock.aero,
            level: result.level
        };
    } catch (error) {
        logger.error(`getVehicleStats: API error for user ${profile.userId}: ${error.message}`);
        return null;
    }
}

async function getUpgradeStats(profile, vehicle) {
    const api = new GameAPI();
    let logger = await getLogger();
    
    try {
        const result = await api.getVehicleStats(profile.userId, vehicle._id);
        return {
            horsepowerBonus: result.upgrades.horsepower,
            torqueBonus: result.upgrades.torque,
            gripBonus: result.upgrades.grip,
            suspensionBonus: result.upgrades.suspension,
            brakesBonus: result.upgrades.brakes,
            aeroBonus: result.upgrades.aero
        };
    } catch (error) {
        logger.error(`getUpgradeStats: API error for user ${profile.userId}: ${error.message}`);
        return { horsepowerBonus: 0, torqueBonus: 0, gripBonus: 0, suspensionBonus: 0, brakesBonus: 0, aeroBonus: 0 };
    }
}

async function getBlessingStats(profile) {
    const api = new GameAPI();
    let logger = await getLogger();
    
    try {
        // Check if user has any vehicles first (prevents 400 error after seasonal reset)
        const garage = await api.getGarage(profile.userId);
        const vehicles = Array.isArray(garage) ? garage : (garage?.vehicles || []);
        
        if (vehicles.length === 0) {
            // No vehicles = no blessings, return zeros
            return { horsepowerBlessing: 0, torqueBlessing: 0, gripBlessing: 0, suspensionBlessing: 0, brakesBlessing: 0, aeroBlessing: 0 };
        }
        
        const result = await api.getVehicleStats(profile.userId);
        return {
            horsepowerBlessing: result.blessings.horsepower,
            torqueBlessing: result.blessings.torque,
            gripBlessing: result.blessings.grip,
            suspensionBlessing: result.blessings.suspension,
            brakesBlessing: result.blessings.brakes,
            aeroBlessing: result.blessings.aero
        };
    } catch (error) {
        logger.error(`getBlessingStats: API error for user ${profile.userId}: ${error.message}`);
        return { horsepowerBlessing: 0, torqueBlessing: 0, gripBlessing: 0, suspensionBlessing: 0, brakesBlessing: 0, aeroBlessing: 0 };
    }
}

async function getTotalStats(profile, playerVehicle) {
    const api = new GameAPI();
    let logger = await getLogger();
    
    try {
        const result = await api.getVehicleStats(profile.userId, playerVehicle._id);
        return {
            horsepower: result.total.horsepower,
            torque: result.total.torque,
            grip: result.total.grip,
            suspension: result.total.suspension,
            brakes: result.total.brakes,
            aero: result.total.aero,
            totalPower: result.totalPower
        };
    } catch (error) {
        logger.error(`getTotalStats: API error for user ${profile.userId}: ${error.message}`);
        return null;
    }
}

async function generateStatsText(profile, playerVehicle) {
    if (!profile || !profile.userId || !playerVehicle) {
        const logger = await getLogger();
        logger.warn(`generateStatsText: missing profile or vehicle (profile.userId=${profile?.userId}, vehicleId=${playerVehicle?._id || playerVehicle?.id})`);
        return {
            torqueText: 'Torque: —',
            horsepowerText: 'Horsepower: —',
            gripText: 'Grip: —',
            suspensionText: 'Suspension: —',
            brakesText: 'Brakes: —',
            aeroText: 'Aero: —',
            totalPowerText: '**Total Power:** — ⚡'
        };
    }

    const vehicleStats = await getVehicleStats(profile, playerVehicle);
    const upgradeStats = await getUpgradeStats(profile, playerVehicle);
    const blessingStats = await getBlessingStats(profile);
    const bonusStats = {
        horsepower: upgradeStats.horsepowerBonus + blessingStats.horsepowerBlessing,
        torque: upgradeStats.torqueBonus + blessingStats.torqueBlessing,
        grip: upgradeStats.gripBonus + blessingStats.gripBlessing,
        suspension: upgradeStats.suspensionBonus + blessingStats.suspensionBlessing,
        brakes: upgradeStats.brakesBonus + blessingStats.brakesBlessing,
        aero: upgradeStats.aeroBonus + blessingStats.aeroBlessing
    };
    const totalStats = await getTotalStats(profile, playerVehicle);

    const torqueText = `Torque: ${vehicleStats.torque.toFixed(1)} (+${bonusStats.torque.toFixed(1)})`;
    const horsepowerText = `Horsepower: ${vehicleStats.horsepower.toFixed(1)} (+${bonusStats.horsepower.toFixed(1)})`;
    const gripText = `Grip: ${vehicleStats.grip.toFixed(1)} (+${(bonusStats.grip).toFixed(1)})`;
    const suspensionText = `Suspension: ${vehicleStats.suspension.toFixed(1)} (+${(bonusStats.suspension).toFixed(1)})`;
    const brakesText = `Brakes: ${vehicleStats.brakes.toFixed(1)} (+${(bonusStats.brakes).toFixed(1)})`;
    const aeroText = `Aero: ${vehicleStats.aero.toFixed(1)} (+${bonusStats.aero.toFixed(1)})`;
    const totalPowerText = totalStats ? `**Total Power:** ${totalStats.totalPower.toFixed(1)}  ⚡` : '**Total Power:** — ⚡';

    return { torqueText, horsepowerText, gripText, suspensionText, brakesText, aeroText, totalPowerText };
}

async function generatePlayers(profiles, fuelCost) {
    const api = new GameAPI();
    const { getSupabaseClient } = require('./supabase');
    const { mapPlayerVehicleRow } = require('./supabase/mappers');
    const sb = getSupabaseClient();
    let playerVehicles = [];

    for (const profile of profiles) {
        const { data: vehicleRow } = await sb
            .from('player_vehicles')
            .select('*, player_vehicle_upgrades(*)')
            .eq('user_id', profile.userId)
            .eq('is_active', true)
            .maybeSingle();
        const playerVehicle = mapPlayerVehicleRow(vehicleRow);
        
        if (!playerVehicle) {
            console.warn(`generatePlayers: No active vehicle for user ${profile.userId}`);
            continue;
        }
        if (playerVehicle.status === 'Impounded') {
            console.warn(`generatePlayers: Vehicle for user ${profile.userId} is impounded`);
            continue;
        }
        
        const adjustedFuelCost = Math.floor(fuelCost * (1 - (profile.stats.fuelEfficiency / 100)));
        const logger = await getLogger();
        logger.debug(`generatePlayers: ${profile.username} - Fuel Cost: ${adjustedFuelCost} - Current Fuel: ${playerVehicle.stats.currentFuel} - Fuel Efficiency: ${profile.stats.fuelEfficiency}`);
        
        if (playerVehicle.stats.currentFuel < adjustedFuelCost) {
            console.warn(`generatePlayers: Not enough fuel for user ${profile.userId}`);
            continue;
        }
        
        try {
            const vehicleStats = await api.getVehicleStats(profile.userId);
            playerVehicles.push({
                vehicleId: playerVehicle.vehicleId,
                make: playerVehicle.make,
                model: playerVehicle.model,
                level: vehicleStats.level,
                driverName: profile.username,
                userId: profile.userId,
                profile: profile, // Include profile for perk calculations
                power: vehicleStats.totalPower,
                stats: {
                    horsepower: vehicleStats.total.horsepower,
                    torque: vehicleStats.total.torque,
                    grip: vehicleStats.total.grip,
                    suspension: vehicleStats.total.suspension,
                    brakes: vehicleStats.total.brakes,
                    aero: vehicleStats.total.aero,
                    currentFuel: vehicleStats.vehicleInfo.currentFuel
                }
            });
        } catch (error) {
            console.error(`generatePlayers: Error getting vehicle stats for user ${profile.userId}: ${error.message}`);
            continue;
        }
    }

    return playerVehicles;
}

async function generateAIOpponents(aiPower, level, count) {
    const api = new GameAPI();
    try {
        return await api.generateAIOpponents(aiPower, level, count);
    } catch (error) {
        console.error(`generateAIOpponents: API error: ${error.message}`);
        return [];
    }
}


async function simulateRace(vehicles, track, weather) {
    const api = new GameAPI();
    try {
        return await api.simulateRace(vehicles, track.trackId, weather);
    } catch (error) {
        console.error(`simulateRace: API error: ${error.message}, using fallback`);
        // Fallback to local calculation
        return vehicles.map(vehicle => {
            let power = vehicle.power;
            let trackBonus = 0;
            let weatherBonus = 0;

            if (track.type === "Drag") {
                trackBonus = vehicle.stats.grip * 1.2 + vehicle.stats.torque * 1.5;
            } else if (track.type === "Circuit") {
                trackBonus = vehicle.stats.brakes * 0.8 + vehicle.stats.suspension * 1.1;
            } else if (track.type === "Offroad") {
                trackBonus = vehicle.stats.suspension * 1.2 + vehicle.stats.grip * 0.5;
            } else if (track.type === "Speedway") {
                trackBonus = vehicle.stats.aero * 1.7 + vehicle.stats.horsepower * 0.9;
            } else if (track.type === "Hillclimb") {
                trackBonus = vehicle.stats.suspension * 0.5 + vehicle.stats.aero * 1.3;
            } else if (track.type === "Drift") {
                trackBonus = vehicle.stats.brakes * 0.2 + vehicle.stats.torque * 1.5;
            }

            // Weather effects
            if (weather === "Rain") {
                weatherBonus = vehicle.stats.grip * 0.2;
            } else if (weather === "Clear") {
                weatherBonus = vehicle.stats.aero * 0.1;
            } else if (weather === "Snow") {
                weatherBonus = vehicle.stats.grip * 0.4 + vehicle.stats.torque * 0.2;
            } else if (weather === "Windy") {
                weatherBonus = vehicle.stats.aero * 0.4;
            }

            if (trackBonus > 0) {
                power += trackBonus;
            }
            if (weatherBonus > 0) {
                power += weatherBonus;
            }

            return { vehicle, power, driverName: vehicle.driverName, userId: vehicle.userId ? vehicle.userId : 0, level: vehicle.level };
        }).sort((a, b) => b.power - a.power);
    }
}

async function addRaceLevel(userId, level, winner, fuelCost) {
    const { getSupabaseClient } = require('./supabase');
    let logger = await getLogger();
    const TIMEZONE = 'America/New_York';

    try {
        const sb = getSupabaseClient();

        // Fetch active vehicle row
        const { data: vehicleRow, error: fetchErr } = await sb
            .from('player_vehicles')
            .select('id, wins, losses, race_count, highest_level_unlocked')
            .eq('user_id', userId)
            .eq('is_active', true)
            .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!vehicleRow) {
            logger.warn(`addRaceLevel: No active vehicle found for user ${userId}`);
            return;
        }

        const currentHighest = vehicleRow.highest_level_unlocked || 0;
        logger.debug(`addRaceLevel: User ${userId}, Winner: ${winner}, Current Highest: ${currentHighest}, New Level: ${level}`);

        const updates = {
            race_count: (vehicleRow.race_count || 0) + 1,
            last_race_date: DateTime.now().setZone(TIMEZONE).toJSDate().toISOString(),
            updated_at: new Date().toISOString(),
        };

        if (level > currentHighest) {
            updates.highest_level_unlocked = level;
            logger.info(`addRaceLevel: Updated highest level to ${level} for user ${userId}`);
        }

        if (winner) {
            updates.wins = (vehicleRow.wins || 0) + 1;
        } else {
            updates.losses = (vehicleRow.losses || 0) + 1;
        }

        const { error: updateErr } = await sb
            .from('player_vehicles')
            .update(updates)
            .eq('id', vehicleRow.id);
        if (updateErr) throw updateErr;
    } catch (error) {
        logger.error(`addRaceLevel: DB error for user ${userId}: ${error.message}`);
    }
}

module.exports = {
    generatePlayers,
    getWeatherCondition,
    generateAIOpponents,
    simulateRace,
    addRaceLevel,
    generateStatsText,
    getVehicleStats,
    getUpgradeStats,
    getBlessingStats,
    getTotalStats
};

