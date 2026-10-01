const test = require('node:test');
const assert = require('node:assert/strict');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const readOnly = require('../utils/readOnly');
const { buildRetroRedirectEmbed } = require('../utils/retroRedirect');
const { _resetClient, getSupabaseClient } = require('../utils/supabase/client');
const BaseAPIClient = require('../utils/api/baseClient');

function withMode(value, fn) {
    const prev = process.env.READONLY_MODE;
    if (value === undefined) delete process.env.READONLY_MODE; else process.env.READONLY_MODE = value;
    try { return fn(); } finally {
        if (prev === undefined) delete process.env.READONLY_MODE; else process.env.READONLY_MODE = prev;
    }
}

test('mode off: everything is allowed', () => {
    withMode('false', () => {
        assert.equal(readOnly.isAllowedCommand('race'), true);
        assert.equal(readOnly.isAllowedComponent('confirmpurchase_x_1'), true);
        assert.doesNotThrow(() => readOnly.assertWritable('x'));
    });
});

test('mode on: commands follow the allowlist, unknown commands are blocked', () => {
    withMode('true', () => {
        for (const c of readOnly.ALLOWED_COMMANDS) assert.equal(readOnly.isAllowedCommand(c), true, c);
        for (const c of ['race', 'daily', 'afk', 'work', 'job', 'company', 'crew', 'store', 'mail', 'cars', 'brand-new-command']) {
            assert.equal(readOnly.isAllowedCommand(c), false, c);
        }
        assert.equal(readOnly.isAllowedCommand('RACE'), false);
    });
});

test('mode on: write components blocked, navigation and collector ids allowed', () => {
    withMode('true', () => {
        for (const id of ['togglelock_1', 'joinmeet', 'selectqty_item_2', 'confirmpurchase_item_2', 'perk_upgrade_select', 'title_select', 'badge_pin_select', 'execute_daily', 'execute_scrap', 'execute_mail', 'execute_vote']) {
            assert.equal(readOnly.isAllowedComponent(id), false, id);
        }
        for (const id of ['leaderboard_next', 'perk_category_select', 'perk_back_overview', 'cancel_purchase', 'general', 'select_vehicle_0']) {
            assert.equal(readOnly.isAllowedComponent(id), true, id);
        }
    });
});

test('mode on: assertWritable throws ReadOnlyError', () => {
    withMode('true', () => assert.throws(() => readOnly.assertWritable('giveCoins'), readOnly.ReadOnlyError));
});

test('filterAllowedRows drops blocked buttons and empty rows only in read-only mode', () => {
    const make = () => [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('execute_daily').setLabel('Daily').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('leaderboard_next').setLabel('Next').setStyle(ButtonStyle.Secondary)),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('execute_scrap').setLabel('Scrap').setStyle(ButtonStyle.Secondary)),
    ];
    withMode('false', () => assert.equal(readOnly.filterAllowedRows(make()).length, 2));
    withMode('true', () => {
        const rows = readOnly.filterAllowedRows(make());
        assert.equal(rows.length, 1);
        assert.deepEqual(rows[0].components.map(c => c.data.custom_id), ['leaderboard_next']);
    });
});

test('redirect embed has no stale copy and two link buttons', () => {
    const { embeds, components } = buildRetroRedirectEmbed();
    const text = JSON.stringify(embeds[0].toJSON());
    assert.doesNotMatch(text, /carries over|OctaneRetro|guest play|browser/i);
    assert.deepEqual(components[0].components.map(c => c.data.label), ['Visit OctaneRPG', 'Join the Discord']);
});

test('supabase backstop: player-table writes throw, reads and guild_settings pass through', () => {
    process.env.SUPABASE_URL = 'http://127.0.0.1:1';
    process.env.SUPABASE_KEY = 'test-key';
    _resetClient();
    const sb = getSupabaseClient();
    withMode('true', () => {
        for (const m of ['insert', 'update', 'upsert', 'delete']) {
            assert.throws(() => sb.from('players')[m]({}), readOnly.ReadOnlyError, m);
        }
        assert.doesNotThrow(() => sb.from('players').select('*').eq('user_id', '1'));
        assert.doesNotThrow(() => sb.from('guild_settings').upsert({ guild_id: '1' }));
    });
    withMode('false', () => assert.doesNotThrow(() => sb.from('players').update({})));
});

test('api backstop: non-GET blocked except read-by-POST and guild settings', async () => {
    const client = new BaseAPIClient();
    client.baseURL = 'http://127.0.0.1:1';
    const attempt = (method, endpoint) => withMode('true', () => client._request(method, endpoint, {}, { timeoutMs: 200 }));
    await assert.rejects(attempt('POST', '/players/1/daily'), readOnly.ReadOnlyError);
    await assert.rejects(attempt('PATCH', '/players/1'), readOnly.ReadOnlyError);
    await assert.rejects(attempt('DELETE', '/players/1/vehicles/2'), readOnly.ReadOnlyError);
    // Allowed endpoints get past the guard and fail on the unreachable host instead.
    for (const [m, e] of [['GET', '/players/1'], ['POST', '/players/1/practice'], ['POST', '/racing/stats'], ['POST', '/guild-settings/upsert']]) {
        await assert.rejects(attempt(m, e), err => !(err instanceof readOnly.ReadOnlyError), `${m} ${e}`);
    }
});

test('every shipped command loads and is on the read-only allowlist', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const dir = path.join(__dirname, '..', 'commands');
    const names = fs.readdirSync(dir).filter(f => f.endsWith('.js')).map(f => require(path.join(dir, f)).data.name);
    assert.deepEqual([...names].sort(), [...readOnly.ALLOWED_COMMANDS].sort());
});
