# OctaneRPG 🏎️

OctaneRPG is a street-racing RPG about collecting cars, tuning parts and climbing the ranks. It started life
as a Discord bot; it is now becoming a **standalone game**.

> **Status: the Discord bot is read-only.**
> Gameplay has moved to the new OctaneRPG game, which is currently in alpha testing through our Discord
> server. The new game starts fresh for everyone. Played the Discord version? Your profile earns **Founder
> rewards** (title and badge) in the new game once you link your Discord account.

## Links

- 🌐 Website and game: <https://octanerpg.com/>
- 💬 Discord (alpha testing, support): <https://discord.octanerpg.com/>
<!-- TODO(Nay): add Bluesky and Ko-fi URLs here -->

## What the bot still does

The bot is a read-only window onto the Discord version of the game. Nothing it does changes your profile.

| Command | What it shows |
|---------|---------------|
| `/profile`, `/stats` | A player's profile, level and racing record |
| `/garage` | A player's cars and their stats |
| `/inventory` | Parts a player is holding |
| `/cooldowns` | Reward cooldowns as of the last time the Discord game was played |
| `/challenges` | Challenge progress |
| `/leaderboard`, `/top` | Player and guild rankings |
| `/guild` | Server information |
| `/practice` | A free practice race against another player (no rewards) |
| `/settings` | Server admins: level-up announcements and allowed channels |
| `/help`, `/info`, `/start` | Help, bot info, and where the game went |

Every other command from the Discord version has been removed; the old slash commands disappear from the
Discord picker once the bot re-registers its commands. See the [player wiki](docs/wiki/index.md) for how the
game's systems work.

## Running the bot

For anyone who wants to look at the code or self-host a read-only viewer.

- Node.js 20.x
- A Discord application and bot token
- Access to the data the bot reads (a Supabase project and the OctaneAPI it was built against; neither is
  included in this repository)

```bash
cd bot
npm install
cp .env.example .env     # fill in your values
node regCom.js           # register slash commands
npm start
```

`READONLY_MODE=true` (set in `.env`) is the supported configuration. It blocks every state-changing path in
the bot and its API and database clients as a backstop.

```bash
npm test
```

## License

**All rights reserved.** No open-source license is granted. The code, art and other assets in this repository
may not be copied, modified or redistributed without permission.
