# Vishwa Bot 🛡️

A professional, production-ready Discord.js v14 moderation bot with anti-link, anti-invite, anti-spam, warning/mute/ban systems, welcome/goodbye messages, auto-role, and full logging — all powered by simple JSON file storage (no database required).

## ✨ Features

- **Anti-Link System** — auto-deletes messages containing links
- **Anti-Discord-Invite System** — auto-deletes Discord invite links
- **Anti-Spam System** — detects and stops rapid message flooding
- **Auto Moderation Logging** — every automod action is logged with a self-deleting (5s) warning in-channel
- **Welcome Message** — customizable embed sent when members join
- **Goodbye Message** — customizable embed sent when members leave
- **Auto Role System** — automatically assigns a role to new members
- **Logging System** — centralized log channel for all moderation/automod events
- **Warning System** — persistent, per-user warning history
- **Mute/Timeout System** — Discord-native timeouts with flexible durations (`10m`, `1h`, `2d`)
- **Ban / Kick System** — full moderation commands with DM notifications
- **Clear Messages Command** — bulk message deletion
- **Server Setup Commands** — configure everything via simple chat commands

## 🔐 Permission Bypass Rules

The following always bypass Anti-Link, Anti-Invite, and Anti-Spam:
1. **Server Owner**
2. **Administrators**
3. **Moderators** (anyone with `Manage Messages` permission)
4. **Other bots** (to avoid breaking webhooks/integrations)

Regular members are subject to all enabled automod systems.

All moderation **commands** (`!warn`, `!kick`, `!ban`, etc.) require `Manage Messages` or higher to use.

## 📁 Project Structure

```
vishwa-bot/
├── commands/
│   ├── moderation/   → warn, warnings, kick, ban, timeout, untimeout, clear
│   ├── setup/         → setup-welcome, setup-goodbye, setup-logs, setup-autorole,
│   │                     antilink, antiinvite, antispam
│   └── utility/       → help, ping, settings
├── events/
│   ├── ready.js
│   ├── messageCreate.js   → command parsing + automod (anti-link/invite/spam)
│   ├── guildMemberAdd.js  → welcome message + auto-role
│   ├── guildMemberRemove.js → goodbye message
│   ├── guildCreate.js
│   └── error.js
├── utils/
│   ├── database.js     → JSON read/write for config & warnings
│   ├── permissions.js  → owner/admin/mod bypass logic
│   ├── logger.js       → sends embeds to the log channel
│   ├── spamTracker.js  → in-memory spam detection
│   ├── contentFilter.js → link/invite regex detection
│   ├── duration.js     → timeout duration parsing
│   ├── commandHandler.js
│   └── eventHandler.js
├── data/
│   ├── config.json    → per-guild settings (auto-created)
│   └── warnings.json  → per-guild warning history (auto-created)
├── index.js
├── package.json
├── .env.example
└── .gitignore
```

## 🚀 Setup Instructions

### 1. Create Your Bot Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**, name it (e.g. "Vishwa Bot")
3. Go to the **Bot** tab → click **Add Bot**
4. Under **Privileged Gateway Intents**, enable:
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent**
5. Copy your **Bot Token** (Reset Token if needed) — you'll need this shortly

### 2. Invite the Bot to Your Server

In the Developer Portal, go to **OAuth2 → URL Generator**:
- Scopes: `bot`
- Bot Permissions: `Administrator` (simplest, recommended), or at minimum:
  `Kick Members`, `Ban Members`, `Moderate Members`, `Manage Messages`, `Manage Roles`, `View Channels`, `Send Messages`, `Embed Links`, `Read Message History`

Copy the generated URL and open it in your browser to invite the bot.

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your bot token:

```bash
cp .env.example .env
```

Edit `.env`:
```
DISCORD_TOKEN=your_bot_token_here
PREFIX=!
OWNER_IDS=your_discord_user_id
```

### 5. Run the Bot

```bash
npm start
```

You should see:
```
========================================
  Vishwa Bot is online!
  Logged in as: VishwaBot#1234
  Serving 1 guild(s)
========================================
```

## ☁️ Deploying to WispByte (or similar free hosting)

1. Upload the entire project folder (zip or via Git) to your WispByte panel.
2. Set the **Startup Command** to: `npm install && node index.js` (or configure install/start steps separately if the panel supports it).
3. Add `DISCORD_TOKEN` as an environment variable in the panel's configuration tab (do **not** commit your `.env` file).
4. Ensure the Node.js version selected is **18 or higher**.
5. Start the server — check console logs to confirm "Vishwa Bot is online!".

> The bot uses local JSON files for storage. On most free hosts the filesystem persists between restarts, but if your platform uses ephemeral storage, back up `/data/config.json` and `/data/warnings.json` periodically.

## 📜 Commands

| Command | Description |
|---|---|
| `!warn @user [reason]` | Issues a warning |
| `!warnings @user` | Lists a user's warnings |
| `!clear <amount>` | Bulk deletes messages (1-100) |
| `!kick @user [reason]` | Kicks a member |
| `!ban @user [reason]` | Bans a member |
| `!timeout @user <duration> [reason]` | Times out a member (e.g. `10m`, `1h`, `2d`) |
| `!untimeout @user` | Removes a timeout |
| `!setup-welcome #channel` | Sets the welcome message channel |
| `!setup-goodbye #channel` | Sets the goodbye message channel |
| `!setup-logs #channel` | Sets the moderation log channel |
| `!setup-autorole @role` | Sets the auto-assigned role for new members |
| `!antilink on/off` | Toggles the anti-link system |
| `!antiinvite on/off` | Toggles the anti-invite system |
| `!antispam on/off` | Toggles the anti-spam system |
| `!settings` | Shows current server configuration |
| `!help` | Shows all commands |
| `!ping` | Shows bot latency |

## 🛠️ Customization

- **Welcome/Goodbye messages**: edit the `welcomeMessage` / `goodbyeMessage` fields directly in `data/config.json` for a given guild ID. Supported placeholders: `{user}`, `{username}`, `{server}`, `{membercount}`.
- **Spam sensitivity**: adjust `spamThreshold` (messages) and `spamInterval` (ms) per guild in `data/config.json`.
- **Command prefix**: set `PREFIX` in `.env` for the default, or edit `prefix` per guild in `config.json`.

## ⚠️ Notes

- Discord timeouts cap at **28 days** maximum (Discord API limitation).
- Bulk message deletion (`!clear`) only works on messages younger than **14 days** (Discord API limitation).
- The bot's role must be positioned **above** any role it needs to manage (auto-role, timeouts, kicks, bans).

---

Built with [discord.js](https://discord.js.org) v14.
