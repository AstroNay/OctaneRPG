// Command registration helper
//
// Friendly usage examples:
//   node bot/regCom.js                       (interactive)
//   node bot/regCom.js --bot dev --scope guild --apply
//   node bot/regCom.js --bot prod --scope global --apply
//   node bot/regCom.js --bot dev --scope guild --clear
//   node bot/regCom.js --bot dev --scope guild --only settings,stats
//
// Token handling:
// - Dev defaults: TOKEN_DEV + CLIENT_ID_DEV from bot/.env
// - Prod defaults: TOKEN_PROD + CLIENT_ID_PROD
// - If you don't want prod secrets in bot/.env, create local-only files:
//     bot/.env.regcom
//     bot/.env.regcom.prod
//   These will be loaded automatically by this script (if present).

const path = require('path');
const fs = require('fs');

// Bot's own .env only.
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env.local'), override: false });
require('dotenv').config({ path: path.join(__dirname, '.env.regcom'), override: false });
require('dotenv').config({ path: path.join(__dirname, '.env.regcom.prod'), override: false });

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

function parseArgs(argv) {
    const args = {
        bot: null,
        scope: null,
        guildId: null,
        only: null,
        apply: false,
        clear: false,
        list: false,
        help: false,
        legacy: null,
    };

    // Legacy mode: node regCom.js guild true|false
    // environment = argv[0], devBot = argv[1]
    if (argv.length >= 1 && !argv[0].startsWith('--')) {
        args.legacy = { environment: argv[0], devBot: argv[1] };
        return args;
    }

    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (!token) continue;

        if (token === '--help' || token === '-h') args.help = true;
        else if (token === '--list') args.list = true;
        else if (token === '--apply') args.apply = true;
        else if (token === '--clear') args.clear = true;
        else if (token.startsWith('--bot')) {
            const value = token.includes('=') ? token.split('=')[1] : argv[++i];
            args.bot = value;
        } else if (token.startsWith('--scope')) {
            const value = token.includes('=') ? token.split('=')[1] : argv[++i];
            args.scope = value;
        } else if (token.startsWith('--guild')) {
            const value = token.includes('=') ? token.split('=')[1] : argv[++i];
            args.guildId = value;
        } else if (token.startsWith('--only')) {
            const value = token.includes('=') ? token.split('=')[1] : argv[++i];
            args.only = value;
        }
    }

    return args;
}

function printHelp() {
    console.log(`\nOctaneRPG command registrar\n\n` +
        `Usage:\n` +
        `  node bot/regCom.js                         (interactive)\n` +
        `  node bot/regCom.js --bot dev --scope guild --apply\n` +
        `  node bot/regCom.js --bot prod --scope global --apply\n` +
        `  node bot/regCom.js --bot dev --scope guild --clear\n` +
        `  node bot/regCom.js --list\n` +
        `  node bot/regCom.js --bot dev --scope guild --only settings,stats --apply\n\n` +
        `Options:\n` +
        `  --bot dev|prod         Which bot/app to target\n` +
        `  --scope guild|global   Register to a guild or globally\n` +
        `  --guild <id>           Guild ID (required for guild scope)\n` +
        `  --only a,b,c           Only register these command names\n` +
        `  --clear                Clear commands (instead of registering)\n` +
        `  --apply                Actually perform changes (otherwise dry-run)\n` +
        `  --list                 List discovered command names\n` +
        `  --help                 Show this help\n\n` +
        `Env vars (dev): TOKEN, CLIENT_ID\n` +
        `Env vars (prod): TOKEN_PROD, CLIENT_ID_PROD\n` +
        `Guild ID env fallback: COMMANDS_GUILD_ID (or DEV_GUILD_ID)\n`
    );
}

function loadCommands(onlyCsv) {
    const commandsDir = path.join(__dirname, 'commands');
    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));

    const includeDevCommand = String(process.env.INCLUDE_DEV_COMMAND || '').toLowerCase() === 'true';

    const only = onlyCsv
        ? new Set(String(onlyCsv).split(',').map(s => s.trim()).filter(Boolean))
        : null;

    const commands = [];
    const names = [];

    for (const file of files) {
        if (file === 'extrascrap.js') continue;
        if (file === 'dev.js' && !includeDevCommand) continue;
        const mod = require(path.join(commandsDir, file));
        const name = mod?.data?.name;
        if (!name) continue;
        names.push(name);
        if (only && !only.has(name)) continue;
        commands.push(mod.data.toJSON());
    }

    names.sort((a, b) => a.localeCompare(b));
    return { commands, names, only };
}

function resolveBotConfig(bot) {
    const normalized = String(bot || '').toLowerCase();
    const isProd = normalized === 'prod' || normalized === 'production';

    const token = isProd
        ? (process.env.TOKEN_PROD || process.env.TOKEN)
        : process.env.TOKEN;
    const clientId = isProd
        ? (process.env.CLIENT_ID_PROD || process.env.CLIENTID_PROD || process.env.CLIENT_ID || process.env.CLIENTID)
        : (process.env.CLIENT_ID || process.env.CLIENTID);

    return {
        isProd,
        botName: isProd ? 'Octane Prod' : 'Octane Dev',
        token,
        clientId,
    };
}

async function interactiveConfig(defaultGuildId) {
    const { createInterface } = require('readline');

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise(resolve => rl.question(q, resolve));

    console.log('\nOctaneRPG command registrar (interactive)');
    console.log('1) Dev -> Guild register');
    console.log('2) Dev -> Guild clear');
    console.log('3) Prod -> Global register');
    console.log('4) Prod -> Global clear');
    console.log('5) Custom');

    const choice = String(await ask('Select option (1-5): ')).trim();

    let bot = 'dev';
    let scope = 'guild';
    let clear = false;

    if (choice === '1') { bot = 'dev'; scope = 'guild'; clear = false; }
    else if (choice === '2') { bot = 'dev'; scope = 'guild'; clear = true; }
    else if (choice === '3') { bot = 'prod'; scope = 'global'; clear = false; }
    else if (choice === '4') { bot = 'prod'; scope = 'global'; clear = true; }
    else if (choice === '5') {
        bot = String(await ask('Bot (dev/prod): ')).trim() || 'dev';
        scope = String(await ask('Scope (guild/global): ')).trim() || 'guild';
        clear = (String(await ask('Clear commands? (y/N): ')).trim().toLowerCase() === 'y');
    }

    let guildId = null;
    if (String(scope).toLowerCase() === 'guild') {
        guildId = String(await ask(`Guild ID (${defaultGuildId || 'required'}): `)).trim() || defaultGuildId;
    }

    const only = String(await ask('Only commands (comma-separated names, blank = all): ')).trim() || null;
    const apply = (String(await ask('Apply changes? (y/N): ')).trim().toLowerCase() === 'y');

    rl.close();
    return { bot, scope, guildId, clear, only, apply };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const defaultGuildId = process.env.COMMANDS_GUILD_ID || process.env.DEV_GUILD_ID || process.env.GUILDID || process.env.GUILDID_DEV;

    if (args.legacy) {
        // Keep old behavior for muscle-memory
        const environment = args.legacy.environment;
        const devBot = args.legacy.devBot;
        const bot = devBot === 'false' ? 'prod' : 'dev';
        const scope = environment === 'guild' ? 'guild' : 'global';
        const clear = environment === 'reset';
        const apply = true;
        return await run({ bot, scope, guildId: defaultGuildId, clear, only: null, apply });
    }

    if (args.help) {
        printHelp();
        return;
    }

    if (args.list) {
        const { names } = loadCommands(null);
        console.log('\nDiscovered commands:');
        for (const n of names) console.log(`- ${n}`);
        return;
    }

    const needsInteractive = !args.bot && !args.scope && !args.guildId && !args.only && !args.apply && !args.clear;
    if (needsInteractive) {
        const config = await interactiveConfig(defaultGuildId);
        return await run(config);
    }

    return await run({
        bot: args.bot || 'dev',
        scope: args.scope || 'guild',
        guildId: args.guildId || defaultGuildId,
        only: args.only || null,
        clear: args.clear,
        apply: args.apply,
    });
}

async function run({ bot, scope, guildId, only, clear, apply }) {
    const { isProd, botName, token, clientId } = resolveBotConfig(bot);
    const scopeNorm = String(scope || '').toLowerCase();

    if (!token || !clientId) {
        console.error(`Missing token/clientId for ${botName}.`);
        console.error(`Expected env vars: ${isProd ? 'TOKEN_PROD + CLIENT_ID_PROD' : 'TOKEN + CLIENT_ID'}`);
        console.error('Tip: create bot/.env.regcom.prod with TOKEN_PROD and CLIENT_ID_PROD for local-only usage.');
        process.exit(1);
    }

    if (scopeNorm === 'guild' && !guildId) {
        console.error('Guild scope requires a guild id. Provide --guild or set COMMANDS_GUILD_ID / DEV_GUILD_ID.');
        process.exit(1);
    }

    const { commands, names, only: onlySet } = loadCommands(only);

    if (onlySet && commands.length === 0) {
        console.error('No commands matched --only. Use --list to see available names.');
        process.exit(1);
    }

    const target = scopeNorm === 'global'
        ? `global (applicationCommands)`
        : `guild ${guildId} (applicationGuildCommands)`;

    console.log(`\n${botName}: ${clear ? 'CLEAR' : 'REGISTER'} / scope=${target}`);
    console.log(`Client ID: ${clientId}`);
    if (!clear) {
        console.log(`Commands: ${commands.length}${onlySet ? ` (filtered)` : ''}`);
        if (onlySet) {
            console.log(`Only: ${Array.from(onlySet).join(', ')}`);
        }
    }
    if (!apply) {
        console.log('\nDry-run (no changes). Re-run with --apply to execute.');
        return;
    }

    const rest = new REST({ version: '9' }).setToken(token);
    const route = scopeNorm === 'global'
        ? Routes.applicationCommands(clientId)
        : Routes.applicationGuildCommands(clientId, guildId);

    try {
        if (clear) {
            await rest.put(route, { body: [] });
            console.log(`${botName}: Successfully cleared (/) commands.`);
            return;
        }

        // PUT replaces the entire command set for the given scope.
        await rest.put(route, { body: commands });
        console.log(`${botName}: Successfully registered (/) commands.`);
        return;
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
