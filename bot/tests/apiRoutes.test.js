const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

// The bot has no database access: every aggregate it shows comes from an API route. A stub server records what it asks for.

function withStub(handler, fn) {
    return new Promise((resolve, reject) => {
        const seen = [];
        const server = http.createServer((req, res) => {
            let body = '';
            req.on('data', (c) => { body += c; });
            req.on('end', () => {
                seen.push({ method: req.method, url: req.url, key: req.headers['x-api-key'], body: body ? JSON.parse(body) : null });
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify(handler(req)));
            });
        });
        server.listen(0, '127.0.0.1', async () => {
            const prevUrl = process.env.API_URL;
            const prevKey = process.env.API_KEY_BOT;
            const prevMode = process.env.READONLY_MODE;
            process.env.API_URL = `http://127.0.0.1:${server.address().port}`;
            process.env.API_KEY_BOT = 'test-key';
            process.env.READONLY_MODE = 'true';
            try {
                await fn(seen);
                resolve();
            } catch (e) {
                reject(e);
            } finally {
                for (const [k, v] of [['API_URL', prevUrl], ['API_KEY_BOT', prevKey], ['READONLY_MODE', prevMode]]) {
                    if (v === undefined) delete process.env[k]; else process.env[k] = v;
                }
                server.close();
            }
        });
    });
}

test('guild and player aggregates come from /guild-stats', async () => {
    await withStub(() => ({ ok: true, totalWins: 4 }), async (seen) => {
        const { GameAPI } = require('../utils/api/index');
        const api = new GameAPI();
        await api.getTopGuilds('coins');
        await api.getGuildStatistics('123');
        await api.getGuildLeaderboard('123', 'xp');
        await api.getRaceRecord('42');
        assert.deepEqual(
            seen.map((r) => `${r.method} ${r.url}`),
            ['GET /guild-stats/top?metric=coins', 'GET /guild-stats/123', 'GET /guild-stats/123/leaderboard?type=xp', 'GET /guild-stats/record/42'],
        );
        assert.ok(seen.every((r) => r.key === 'test-key'));
    });
});

test('guild settings are saved and removed through the API, which the read-only guard allows', async () => {
    await withStub(() => ({ ok: true }), async (seen) => {
        const { GameAPI } = require('../utils/api/index');
        const api = new GameAPI();
        await api.upsertGuildSettings({ guildId: '9', name: 'G', allowedChannels: ['1'], levelupMessages: true });
        await api.deleteGuildSettings('9');
        assert.deepEqual(
            seen.map((r) => `${r.method} ${r.url}`),
            ['POST /guild-settings/upsert', 'DELETE /guild-settings/9'],
        );
        assert.deepEqual(seen[0].body, { guildId: '9', name: 'G', allowedChannels: ['1'], levelupMessages: true });
    });
});
