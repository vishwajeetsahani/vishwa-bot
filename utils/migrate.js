/**
 * migrate.js
 * -----------------------------------------------------------------------
 * Migration Script (JSON -> SQLite)
 *
 * Checks for existing JSON configurations and warnings, imports them into
 * the SQLite database safely, and renames the JSON files to prevent
 * duplicate migrations.
 * -----------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');
const { sqlite, configs, warnings } = require('./database');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const WARNINGS_PATH = path.join(DATA_DIR, 'warnings.json');

function migrate() {
  const hasConfigs = fs.existsSync(CONFIG_PATH);
  const hasWarnings = fs.existsSync(WARNINGS_PATH);

  if (!hasConfigs && !hasWarnings) {
    console.log('[Migration] No JSON database files found. Skipping migration.');
    return;
  }

  console.log('[Migration] Legacy JSON database files detected. Beginning migration to SQLite...');

  try {
    let jsonConfigs = {};
    let jsonWarnings = {};

    if (hasConfigs) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      if (raw && raw.trim()) {
        jsonConfigs = JSON.parse(raw);
      }
    }

    if (hasWarnings) {
      const raw = fs.readFileSync(WARNINGS_PATH, 'utf8');
      if (raw && raw.trim()) {
        jsonWarnings = JSON.parse(raw);
      }
    }

    // Run migration inside a single SQLite transaction for atomicity
    const migrationTx = sqlite.transaction(() => {
      // 1. Migrate Guild Configs
      for (const [guildId, configData] of Object.entries(jsonConfigs)) {
        console.log(`[Migration] Migrating config for Guild: ${guildId}`);
        configs.update(guildId, {
          prefix: configData.prefix,
          antiLink: configData.antiLink,
          antiInvite: configData.antiInvite,
          antiSpam: configData.antiSpam,
          welcomeChannel: configData.welcomeChannel,
          welcomeMessage: configData.welcomeMessage,
          goodbyeChannel: configData.goodbyeChannel,
          goodbyeMessage: configData.goodbyeMessage,
          logChannel: configData.logChannel,
          autoRole: configData.autoRole,
          spamThreshold: configData.spamThreshold,
          spamInterval: configData.spamInterval
        });
      }

      // 2. Migrate Warnings
      for (const [guildId, userMap] of Object.entries(jsonWarnings)) {
        for (const [userId, warningList] of Object.entries(userMap)) {
          if (!Array.isArray(warningList)) continue;
          
          console.log(`[Migration] Migrating ${warningList.length} warnings for User: ${userId} in Guild: ${guildId}`);
          for (const warn of warningList) {
            // Check if warning ID already exists to prevent duplicate key constraint failure
            const checkStmt = sqlite.prepare('SELECT 1 FROM warnings WHERE warning_id = ?');
            if (checkStmt.get(warn.id)) {
              continue; // Skip already migrated warning
            }

            // Insert warning directly
            const insertStmt = sqlite.prepare(`
              INSERT INTO warnings (warning_id, guild_id, user_id, moderator_id, reason, timestamp)
              VALUES (?, ?, ?, ?, ?, ?)
            `);
            insertStmt.run(
              warn.id,
              guildId,
              userId,
              warn.moderatorId,
              warn.reason || 'No reason provided',
              warn.timestamp || new Date().toISOString()
            );
          }
        }
      }
    });

    // Execute the transaction
    migrationTx();
    console.log('[Migration] Database transaction completed successfully.');

    // Rename legacy JSON files to backup files so we don't migrate them again on next restart
    if (hasConfigs) {
      fs.renameSync(CONFIG_PATH, `${CONFIG_PATH}.bak`);
      console.log(`[Migration] Renamed config.json to config.json.bak`);
    }
    if (hasWarnings) {
      fs.renameSync(WARNINGS_PATH, `${WARNINGS_PATH}.bak`);
      console.log(`[Migration] Renamed warnings.json to warnings.json.bak`);
    }

    console.log('[Migration] All legacy data successfully migrated to SQLite!');
  } catch (err) {
    console.error('[Migration] CRITICAL: Migration failed! Changes rolled back.', err);
    process.exit(1);
  }
}

module.exports = { migrate };
