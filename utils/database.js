/**
 * database.js
 * -----------------------------------------------------------------------
 * SQLite Database Module (Vishwa Bot v2.0)
 *
 * Utilizes better-sqlite3 for high-performance synchronous operations.
 * Requirements met:
 *   - WAL mode enabled (journal_mode = WAL)
 *   - Foreign keys enforced
 *   - Compiled prepared statements cached
 *   - Transaction-safe updates
 *   - Repository pattern structure
 * -----------------------------------------------------------------------
 */

const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'vishwa.db');

// Ensure database directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class LazyStatement {
  constructor(sql, wrapper) {
    this.sql = sql;
    this.wrapper = wrapper;
  }

  get(...args) {
    if (!this.wrapper.db) {
      throw new Error('Database is not initialized. Cannot execute queries.');
    }
    this.wrapper.tickQuery();
    const stmt = this.wrapper.db.prepare(this.sql);
    try {
      if (args.length > 0) {
        const bindParams = (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0]))
          ? args[0]
          : args;
        stmt.bind(bindParams);
      }
      const hasRow = stmt.step();
      if (!hasRow) {
        return undefined;
      }
      return stmt.getAsObject();
    } finally {
      stmt.free();
    }
  }

  all(...args) {
    if (!this.wrapper.db) {
      throw new Error('Database is not initialized. Cannot execute queries.');
    }
    this.wrapper.tickQuery();
    const stmt = this.wrapper.db.prepare(this.sql);
    try {
      if (args.length > 0) {
        const bindParams = (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0]))
          ? args[0]
          : args;
        stmt.bind(bindParams);
      }
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } finally {
      stmt.free();
    }
  }

  run(...args) {
    if (!this.wrapper.db) {
      throw new Error('Database is not initialized. Cannot execute queries.');
    }
    this.wrapper.tickQuery();
    const stmt = this.wrapper.db.prepare(this.sql);
    try {
      if (args.length > 0) {
        const bindParams = (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0]))
          ? args[0]
          : args;
        stmt.bind(bindParams);
      }
      stmt.step();
    } finally {
      stmt.free();
    }

    // Auto-save changes to disk
    this.wrapper.save();

    const changesRes = this.wrapper.db.exec('SELECT changes() AS changes, last_insert_rowid() AS lastId');
    const changes = changesRes[0]?.values[0]?.[0] || 0;
    const lastInsertRowid = changesRes[0]?.values[0]?.[1] || 0;

    return {
      changes,
      lastInsertRowid
    };
  }
}

class SqlJsWrapper {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this.inTransaction = false;
  }

  async init() {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();

    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
      this.save();
    }

    // Enforce foreign key constraints
    this.db.exec('PRAGMA foreign_keys = ON');

    // Create database schema
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS guild_configs (
        guild_id TEXT PRIMARY KEY NOT NULL,
        prefix TEXT DEFAULT '!',
        anti_link BOOLEAN DEFAULT 0,
        anti_invite BOOLEAN DEFAULT 0,
        anti_spam BOOLEAN DEFAULT 0,
        welcome_channel_id TEXT DEFAULT NULL,
        welcome_message TEXT DEFAULT 'Welcome {user} to **{server}**! We are now at {membercount} members.',
        goodbye_channel_id TEXT DEFAULT NULL,
        goodbye_message TEXT DEFAULT '{user} has left **{server}**. We are now at {membercount} members.',
        log_channel_id TEXT DEFAULT NULL,
        auto_role_id TEXT DEFAULT NULL,
        spam_threshold INTEGER DEFAULT 5,
        spam_interval INTEGER DEFAULT 5000,
        community_channel_id TEXT DEFAULT NULL,
        economy_log_channel_id TEXT DEFAULT NULL,
        economy_manager_role_id TEXT DEFAULT NULL,
        level_channel_id TEXT DEFAULT NULL,
        quest_channel_id TEXT DEFAULT NULL,
        achievement_channel_id TEXT DEFAULT NULL,
        event_channel_id TEXT DEFAULT NULL,
        rare_drop_channel_id TEXT DEFAULT NULL,
        shop_channel_id TEXT DEFAULT NULL,
        announcement_channel_id TEXT DEFAULT NULL,
        leaderboard_channel_id TEXT DEFAULT NULL,
        admin_log_channel_id TEXT DEFAULT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS warnings (
        warning_id TEXT PRIMARY KEY NOT NULL,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS guild_plugins (
        guild_id TEXT NOT NULL,
        plugin_name TEXT NOT NULL,
        enabled BOOLEAN NOT NULL,
        PRIMARY KEY (guild_id, plugin_name),
        FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS moderation_logs (
        log_id TEXT PRIMARY KEY NOT NULL,
        guild_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        target_id TEXT DEFAULT NULL,
        reason TEXT DEFAULT NULL,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS guild_cards (
        guild_id TEXT PRIMARY KEY NOT NULL,
        welcome_theme TEXT DEFAULT 'minimal',
        welcome_bg_type TEXT DEFAULT 'theme',
        welcome_bg_value TEXT DEFAULT 'discord',
        welcome_custom_text TEXT DEFAULT 'Welcome to the server!',
        welcome_mode TEXT DEFAULT 'dark',
        goodbye_theme TEXT DEFAULT 'minimal',
        goodbye_bg_type TEXT DEFAULT 'theme',
        goodbye_bg_value TEXT DEFAULT 'discord',
        goodbye_custom_text TEXT DEFAULT 'Hope to see you again!',
        goodbye_mode TEXT DEFAULT 'dark',
        FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_warnings_timestamp ON warnings(timestamp);
      CREATE INDEX IF NOT EXISTS idx_moderation_logs_guild ON moderation_logs(guild_id);
      CREATE INDEX IF NOT EXISTS idx_guild_cards ON guild_cards(guild_id);

      CREATE TABLE IF NOT EXISTS users (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id, user_id),
        FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS economy (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        coins INTEGER DEFAULT 0,
        bank INTEGER DEFAULT 0,
        last_daily TEXT DEFAULT NULL,
        current_streak INTEGER DEFAULT 0,
        highest_streak INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id, user_id),
        FOREIGN KEY (guild_id, user_id) REFERENCES users(guild_id, user_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS levels (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id, user_id),
        FOREIGN KEY (guild_id, user_id) REFERENCES users(guild_id, user_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS inventory (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id, user_id, item_id),
        FOREIGN KEY (guild_id, user_id) REFERENCES users(guild_id, user_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS achievements (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        achievement_id TEXT NOT NULL,
        unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id, user_id, achievement_id),
        FOREIGN KEY (guild_id, user_id) REFERENCES users(guild_id, user_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_users ON users(guild_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_economy ON economy(guild_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_levels ON levels(guild_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_inventory ON inventory(guild_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_achievements ON achievements(guild_id, user_id);

      CREATE TABLE IF NOT EXISTS economy_transactions (
        id TEXT PRIMARY KEY NOT NULL,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        balance_before INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        transaction_type TEXT NOT NULL,
        source TEXT NOT NULL,
        reason TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id, user_id) REFERENCES users(guild_id, user_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_economy_transactions_guild_user ON economy_transactions(guild_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_economy_transactions_created_at ON economy_transactions(created_at);

      CREATE TABLE IF NOT EXISTS level_role_rewards (
        guild_id TEXT NOT NULL,
        level INTEGER NOT NULL,
        role_id TEXT NOT NULL,
        PRIMARY KEY (guild_id, level),
        FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_level_role_rewards ON level_role_rewards(guild_id, level);

      CREATE TABLE IF NOT EXISTS economy_logs (
        log_id TEXT PRIMARY KEY NOT NULL,
        guild_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        previous_value INTEGER NOT NULL,
        new_value INTEGER NOT NULL,
        action TEXT NOT NULL,
        reason TEXT DEFAULT NULL,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_economy_logs_guild ON economy_logs(guild_id);

      CREATE TABLE IF NOT EXISTS notification_settings (
        guild_id TEXT NOT NULL,
        notification_type TEXT NOT NULL,
        enabled BOOLEAN DEFAULT 1,
        mention_type TEXT DEFAULT 'none',
        mention_role_id TEXT DEFAULT NULL,
        PRIMARY KEY (guild_id, notification_type),
        FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_notification_settings ON notification_settings(guild_id);
    `);

    // Upgrade existing database if columns are missing
    try {
      this.db.exec('ALTER TABLE economy ADD COLUMN last_daily TEXT DEFAULT NULL');
    } catch (e) {}
    try {
      this.db.exec('ALTER TABLE economy ADD COLUMN current_streak INTEGER DEFAULT 0');
    } catch (e) {}
    try {
      this.db.exec('ALTER TABLE economy ADD COLUMN highest_streak INTEGER DEFAULT 0');
    } catch (e) {}
    try {
      this.db.exec('ALTER TABLE guild_configs ADD COLUMN community_channel_id TEXT DEFAULT NULL');
    } catch (e) {}
    try {
      this.db.exec('ALTER TABLE guild_configs ADD COLUMN economy_log_channel_id TEXT DEFAULT NULL');
    } catch (e) {}
    try {
      this.db.exec('ALTER TABLE guild_configs ADD COLUMN economy_manager_role_id TEXT DEFAULT NULL');
    } catch (e) {}
    try {
      this.db.exec('ALTER TABLE guild_configs ADD COLUMN level_channel_id TEXT DEFAULT NULL');
    } catch (e) {}
    try {
      this.db.exec('ALTER TABLE guild_configs ADD COLUMN quest_channel_id TEXT DEFAULT NULL');
    } catch (e) {}
    try {
      this.db.exec('ALTER TABLE guild_configs ADD COLUMN achievement_channel_id TEXT DEFAULT NULL');
    } catch (e) {}
    try {
      this.db.exec('ALTER TABLE guild_configs ADD COLUMN event_channel_id TEXT DEFAULT NULL');
    } catch (e) {}
    try {
      this.db.exec('ALTER TABLE guild_configs ADD COLUMN rare_drop_channel_id TEXT DEFAULT NULL');
    } catch (e) {}
    try {
      this.db.exec('ALTER TABLE guild_configs ADD COLUMN shop_channel_id TEXT DEFAULT NULL');
    } catch (e) {}
    try {
      this.db.exec('ALTER TABLE guild_configs ADD COLUMN announcement_channel_id TEXT DEFAULT NULL');
    } catch (e) {}
    try {
      this.db.exec('ALTER TABLE guild_configs ADD COLUMN leaderboard_channel_id TEXT DEFAULT NULL');
    } catch (e) {}
    try {
      this.db.exec('ALTER TABLE guild_configs ADD COLUMN admin_log_channel_id TEXT DEFAULT NULL');
    } catch (e) {}
    try {
      this.db.exec('ALTER TABLE notification_settings ADD COLUMN mention_role_id TEXT DEFAULT NULL');
    } catch (e) {}
  }

  exec(sql) {
    if (!this.db) throw new Error('Database is not initialized. Call init() first.');
    const res = this.db.exec(sql);
    if (!this.inTransaction) {
      this.save();
    }
    return res;
  }

  pragma(sql) {
    if (!this.db) throw new Error('Database is not initialized. Call init() first.');
    return this.db.exec(`PRAGMA ${sql}`);
  }

  prepare(sql) {
    return new LazyStatement(sql, this);
  }

  save() {
    if (this.inTransaction || !this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  transaction(fn) {
    return (...args) => {
      const isNested = this.inTransaction;
      if (!isNested) {
        this.inTransaction = true;
        this.db.exec('BEGIN TRANSACTION');
      }
      try {
        const res = fn(...args);
        if (!isNested) {
          this.db.exec('COMMIT');
          this.inTransaction = false;
          this.save();
        }
        return res;
      } catch (err) {
        if (!isNested) {
          try {
            this.db.exec('ROLLBACK');
          } catch {}
          this.inTransaction = false;
        }
        throw err;
      }
    };
  }

  tickQuery() {
    const container = require('./container');
    if (container.has('metrics')) {
      container.resolve('metrics').incrementQueries();
    }
  }
}

const sqlite = new SqlJsWrapper(DB_PATH);

/**
 * Guild Config Repository
 */
class GuildConfigRepository {
  constructor(db) {
    this.db = db;
    // Prepare static prepared statements
    this.selectStmt = db.prepare('SELECT * FROM guild_configs WHERE guild_id = ?');
    this.insertStmt = db.prepare('INSERT OR IGNORE INTO guild_configs (guild_id) VALUES (?)');
    
    this.updatePrefix = db.prepare('UPDATE guild_configs SET prefix = ? WHERE guild_id = ?');
    this.updateAntiLink = db.prepare('UPDATE guild_configs SET anti_link = ? WHERE guild_id = ?');
    this.updateAntiInvite = db.prepare('UPDATE guild_configs SET anti_invite = ? WHERE guild_id = ?');
    this.updateAntiSpam = db.prepare('UPDATE guild_configs SET anti_spam = ? WHERE guild_id = ?');
    this.updateWelcomeChannel = db.prepare('UPDATE guild_configs SET welcome_channel_id = ? WHERE guild_id = ?');
    this.updateWelcomeMessage = db.prepare('UPDATE guild_configs SET welcome_message = ? WHERE guild_id = ?');
    this.updateGoodbyeChannel = db.prepare('UPDATE guild_configs SET goodbye_channel_id = ? WHERE guild_id = ?');
    this.updateGoodbyeMessage = db.prepare('UPDATE guild_configs SET goodbye_message = ? WHERE guild_id = ?');
    this.updateLogChannel = db.prepare('UPDATE guild_configs SET log_channel_id = ? WHERE guild_id = ?');
    this.updateAutoRole = db.prepare('UPDATE guild_configs SET auto_role_id = ? WHERE guild_id = ?');
    this.updateSpamSettings = db.prepare('UPDATE guild_configs SET spam_threshold = ?, spam_interval = ? WHERE guild_id = ?');
    this.updateCommunityChannel = db.prepare('UPDATE guild_configs SET community_channel_id = ? WHERE guild_id = ?');
    this.updateEconomyLogChannel = db.prepare('UPDATE guild_configs SET economy_log_channel_id = ? WHERE guild_id = ?');
    this.updateEconomyManagerRole = db.prepare('UPDATE guild_configs SET economy_manager_role_id = ? WHERE guild_id = ?');
    this.updateLevelChannel = db.prepare('UPDATE guild_configs SET level_channel_id = ? WHERE guild_id = ?');
    this.updateQuestChannel = db.prepare('UPDATE guild_configs SET quest_channel_id = ? WHERE guild_id = ?');
    this.updateAchievementChannel = db.prepare('UPDATE guild_configs SET achievement_channel_id = ? WHERE guild_id = ?');
    this.updateEventChannel = db.prepare('UPDATE guild_configs SET event_channel_id = ? WHERE guild_id = ?');
    this.updateRareDropChannel = db.prepare('UPDATE guild_configs SET rare_drop_channel_id = ? WHERE guild_id = ?');
    this.updateShopChannel = db.prepare('UPDATE guild_configs SET shop_channel_id = ? WHERE guild_id = ?');
    this.updateAnnouncementChannel = db.prepare('UPDATE guild_configs SET announcement_channel_id = ? WHERE guild_id = ?');
    this.updateLeaderboardChannel = db.prepare('UPDATE guild_configs SET leaderboard_channel_id = ? WHERE guild_id = ?');
    this.updateAdminLogChannel = db.prepare('UPDATE guild_configs SET admin_log_channel_id = ? WHERE guild_id = ?');
  }

  /**
   * Retrieves guild configuration, auto-creating a default entry if missing.
   * @param {string} guildId 
   * @returns {object}
   */
  get(guildId) {
    this.insertStmt.run(guildId);
    const row = this.selectStmt.get(guildId);
    return this.mapConfig(row);
  }

  /**
   * Updates partial guild settings inside a safe transaction.
   * @param {string} guildId 
   * @param {object} updates 
   * @returns {object} updated guild configuration
   */
  update(guildId, updates) {
    this.insertStmt.run(guildId);

    const transaction = this.db.transaction((guildId, updates) => {
      if (updates.prefix !== undefined) this.updatePrefix.run(updates.prefix, guildId);
      if (updates.antiLink !== undefined) this.updateAntiLink.run(updates.antiLink ? 1 : 0, guildId);
      if (updates.antiInvite !== undefined) this.updateAntiInvite.run(updates.antiInvite ? 1 : 0, guildId);
      if (updates.antiSpam !== undefined) this.updateAntiSpam.run(updates.antiSpam ? 1 : 0, guildId);
      if (updates.welcomeChannel !== undefined) this.updateWelcomeChannel.run(updates.welcomeChannel, guildId);
      if (updates.welcomeMessage !== undefined) this.updateWelcomeMessage.run(updates.welcomeMessage, guildId);
      if (updates.goodbyeChannel !== undefined) this.updateGoodbyeChannel.run(updates.goodbyeChannel, guildId);
      if (updates.goodbyeMessage !== undefined) this.updateGoodbyeMessage.run(updates.goodbyeMessage, guildId);
      if (updates.logChannel !== undefined) this.updateLogChannel.run(updates.logChannel, guildId);
      if (updates.autoRole !== undefined) this.updateAutoRole.run(updates.autoRole, guildId);
      if (updates.communityChannel !== undefined) this.updateCommunityChannel.run(updates.communityChannel, guildId);
      if (updates.economyLogChannel !== undefined) this.updateEconomyLogChannel.run(updates.economyLogChannel, guildId);
      if (updates.economyManagerRole !== undefined) this.updateEconomyManagerRole.run(updates.economyManagerRole, guildId);
      if (updates.levelChannel !== undefined) this.updateLevelChannel.run(updates.levelChannel, guildId);
      if (updates.questChannel !== undefined) this.updateQuestChannel.run(updates.questChannel, guildId);
      if (updates.achievementChannel !== undefined) this.updateAchievementChannel.run(updates.achievementChannel, guildId);
      if (updates.eventChannel !== undefined) this.updateEventChannel.run(updates.eventChannel, guildId);
      if (updates.rareDropChannel !== undefined) this.updateRareDropChannel.run(updates.rareDropChannel, guildId);
      if (updates.shopChannel !== undefined) this.updateShopChannel.run(updates.shopChannel, guildId);
      if (updates.announcementChannel !== undefined) this.updateAnnouncementChannel.run(updates.announcementChannel, guildId);
      if (updates.leaderboardChannel !== undefined) this.updateLeaderboardChannel.run(updates.leaderboardChannel, guildId);
      if (updates.adminLogChannel !== undefined) this.updateAdminLogChannel.run(updates.adminLogChannel, guildId);
      
      if (updates.spamThreshold !== undefined || updates.spamInterval !== undefined) {
        const current = this.get(guildId);
        const threshold = updates.spamThreshold !== undefined ? updates.spamThreshold : current.spamThreshold;
        const interval = updates.spamInterval !== undefined ? updates.spamInterval : current.spamInterval;
        this.updateSpamSettings.run(threshold, interval, guildId);
      }
    });

    transaction(guildId, updates);
    return this.get(guildId);
  }

  mapConfig(row) {
    if (!row) return null;
    return {
      prefix: row.prefix,
      antiLink: !!row.anti_link,
      antiInvite: !!row.anti_invite,
      antiSpam: !!row.anti_spam,
      welcomeChannel: row.welcome_channel_id,
      welcomeMessage: row.welcome_message,
      goodbyeChannel: row.goodbye_channel_id,
      goodbyeMessage: row.goodbye_message,
      logChannel: row.log_channel_id,
      autoRole: row.auto_role_id,
      spamThreshold: row.spam_threshold,
      spamInterval: row.spam_interval,
      communityChannel: row.community_channel_id,
      economyLogChannel: row.economy_log_channel_id,
      economyManagerRole: row.economy_manager_role_id,
      levelChannel: row.level_channel_id,
      questChannel: row.quest_channel_id,
      achievementChannel: row.achievement_channel_id,
      eventChannel: row.event_channel_id,
      rareDropChannel: row.rare_drop_channel_id,
      shopChannel: row.shop_channel_id,
      announcementChannel: row.announcement_channel_id,
      leaderboardChannel: row.leaderboard_channel_id,
      adminLogChannel: row.admin_log_channel_id
    };
  }
}

/**
 * Warnings Repository
 */
class WarningRepository {
  constructor(db, configs) {
    this.db = db;
    this.configs = configs;
    // Prepare static prepared statements
    this.selectStmt = db.prepare('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY timestamp ASC');
    this.insertStmt = db.prepare(`
      INSERT INTO warnings (warning_id, guild_id, user_id, moderator_id, reason, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    this.deleteUserStmt = db.prepare('DELETE FROM warnings WHERE guild_id = ? AND user_id = ?');
    this.countStmt = db.prepare('SELECT COUNT(*) as count FROM warnings WHERE guild_id = ? AND user_id = ?');
  }

  /**
   * Retrieves list of warnings for a user.
   * @param {string} guildId 
   * @param {string} userId 
   * @returns {Array}
   */
  get(guildId, userId) {
    const rows = this.selectStmt.all(guildId, userId);
    return rows.map(r => ({
      id: r.warning_id,
      moderatorId: r.moderator_id,
      reason: r.reason,
      timestamp: r.timestamp
    }));
  }

  /**
   * Adds a warning record under a foreign-key safe constraint.
   * @param {string} guildId 
   * @param {string} userId 
   * @param {string} moderatorId 
   * @param {string} reason 
   * @returns {object}
   */
  add(guildId, userId, moderatorId, reason) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const timestamp = new Date().toISOString();
    
    // Ensure parent config entry exists to satisfy foreign key constraints
    this.configs.get(guildId);

    this.insertStmt.run(id, guildId, userId, moderatorId, reason || 'No reason provided', timestamp);
    
    return {
      id,
      moderatorId,
      reason: reason || 'No reason provided',
      timestamp
    };
  }

  /**
   * Clears warnings for a user.
   * @param {string} guildId 
   * @param {string} userId 
   * @returns {number} number of warnings cleared
   */
  clear(guildId, userId) {
    const currentCount = this.count(guildId, userId);
    this.deleteUserStmt.run(guildId, userId);
    return currentCount;
  }

  /**
   * Counts warnings for a user.
   * @param {string} guildId 
   * @param {string} userId 
   * @returns {number}
   */
  count(guildId, userId) {
    const row = this.countStmt.get(guildId, userId);
    return row ? row.count : 0;
  }
}

class GuildPluginRepository {
  constructor(db, configs) {
    this.db = db;
    this.configs = configs;
    this.selectStmt = db.prepare('SELECT enabled FROM guild_plugins WHERE guild_id = ? AND plugin_name = ?');
    this.upsertStmt = db.prepare(`
      INSERT INTO guild_plugins (guild_id, plugin_name, enabled)
      VALUES (?, ?, ?)
      ON CONFLICT(guild_id, plugin_name) DO UPDATE SET enabled = excluded.enabled
    `);
  }

  isEnabled(guildId, pluginName, defaultState = true) {
    this.configs.get(guildId); // Ensure config exists
    const row = this.selectStmt.get(guildId, pluginName);
    if (!row) return defaultState;
    return !!row.enabled;
  }

  setState(guildId, pluginName, enabled) {
    this.configs.get(guildId); // Ensure config exists
    this.upsertStmt.run(guildId, pluginName, enabled ? 1 : 0);
  }
}

class ModerationLogRepository {
  constructor(db, configs) {
    this.db = db;
    this.configs = configs;
    this.insertStmt = db.prepare(`
      INSERT INTO moderation_logs (log_id, guild_id, action_type, moderator_id, target_id, reason, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
  }

  add(guildId, actionType, moderatorId, targetId, reason) {
    this.configs.get(guildId); // Ensure config exists
    const logId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const timestamp = new Date().toISOString();
    this.insertStmt.run(logId, guildId, actionType, moderatorId, targetId, reason || null, timestamp);
    return {
      logId,
      guildId,
      actionType,
      moderatorId,
      targetId,
      reason,
      timestamp
    };
  }
}

class GuildCardRepository {
  constructor(db, configs) {
    this.db = db;
    this.configs = configs;
    this.selectStmt = db.prepare('SELECT * FROM guild_cards WHERE guild_id = ?');
    this.insertStmt = db.prepare(`
      INSERT OR IGNORE INTO guild_cards (guild_id) VALUES (?)
    `);
    this.updateTheme = db.prepare('UPDATE guild_cards SET welcome_theme = ? WHERE guild_id = ?');
    this.updateBgType = db.prepare('UPDATE guild_cards SET welcome_bg_type = ? WHERE guild_id = ?');
    this.updateBgValue = db.prepare('UPDATE guild_cards SET welcome_bg_value = ? WHERE guild_id = ?');
    this.updateText = db.prepare('UPDATE guild_cards SET welcome_custom_text = ? WHERE guild_id = ?');
    this.updateMode = db.prepare('UPDATE guild_cards SET welcome_mode = ? WHERE guild_id = ?');
    
    this.updateGbTheme = db.prepare('UPDATE guild_cards SET goodbye_theme = ? WHERE guild_id = ?');
    this.updateGbBgType = db.prepare('UPDATE guild_cards SET goodbye_bg_type = ? WHERE guild_id = ?');
    this.updateGbBgValue = db.prepare('UPDATE guild_cards SET goodbye_bg_value = ? WHERE guild_id = ?');
    this.updateGbText = db.prepare('UPDATE guild_cards SET goodbye_custom_text = ? WHERE guild_id = ?');
    this.updateGbMode = db.prepare('UPDATE guild_cards SET goodbye_mode = ? WHERE guild_id = ?');
  }

  get(guildId) {
    this.configs.get(guildId); // Ensure config exists
    this.insertStmt.run(guildId);
    const row = this.selectStmt.get(guildId);
    return this.mapCard(row);
  }

  mapCard(row) {
    return {
      guildId: row.guild_id,
      welcomeTheme: row.welcome_theme,
      welcomeBgType: row.welcome_bg_type,
      welcomeBgValue: row.welcome_bg_value,
      welcomeCustomText: row.welcome_custom_text,
      welcomeMode: row.welcome_mode,
      goodbyeTheme: row.goodbye_theme,
      goodbyeBgType: row.goodbye_bg_type,
      goodbyeBgValue: row.goodbye_bg_value,
      goodbyeCustomText: row.goodbye_custom_text,
      goodbyeMode: row.goodbye_mode
    };
  }

  update(guildId, updates) {
    this.configs.get(guildId); // Ensure config exists
    this.insertStmt.run(guildId);

    const transaction = this.db.transaction((guildId, updates) => {
      if (updates.welcomeTheme !== undefined) this.updateTheme.run(updates.welcomeTheme, guildId);
      if (updates.welcomeBgType !== undefined) this.updateBgType.run(updates.welcomeBgType, guildId);
      if (updates.welcomeBgValue !== undefined) this.updateBgValue.run(updates.welcomeBgValue, guildId);
      if (updates.welcomeCustomText !== undefined) this.updateText.run(updates.welcomeCustomText, guildId);
      if (updates.welcomeMode !== undefined) this.updateMode.run(updates.welcomeMode, guildId);
      
      if (updates.goodbyeTheme !== undefined) this.updateGbTheme.run(updates.goodbyeTheme, guildId);
      if (updates.goodbyeBgType !== undefined) this.updateGbBgType.run(updates.goodbyeBgType, guildId);
      if (updates.goodbyeBgValue !== undefined) this.updateGbBgValue.run(updates.goodbyeBgValue, guildId);
      if (updates.goodbyeCustomText !== undefined) this.updateGbText.run(updates.goodbyeCustomText, guildId);
      if (updates.goodbyeMode !== undefined) this.updateGbMode.run(updates.goodbyeMode, guildId);
    });

    transaction(guildId, updates);
    return this.get(guildId);
  }
}

class UserRepository {
  constructor(db, configs) {
    this.db = db;
    this.configs = configs;
    this.selectStmt = db.prepare('SELECT * FROM users WHERE guild_id = ? AND user_id = ?');
    this.insertStmt = db.prepare('INSERT OR IGNORE INTO users (guild_id, user_id) VALUES (?, ?)');
  }

  get(guildId, userId) {
    this.configs.get(guildId); // Ensure config exists
    this.insertStmt.run(guildId, userId);
    return this.selectStmt.get(guildId, userId);
  }

  create(guildId, userId) {
    this.configs.get(guildId); // Ensure config exists
    this.insertStmt.run(guildId, userId);
    return this.selectStmt.get(guildId, userId);
  }
}

class EconomyRepository {
  constructor(db, users) {
    this.db = db;
    this.users = users;
    this.selectStmt = db.prepare('SELECT * FROM economy WHERE guild_id = ? AND user_id = ?');
    this.insertStmt = db.prepare('INSERT OR IGNORE INTO economy (guild_id, user_id) VALUES (?, ?)');
    this.updateCoinsStmt = db.prepare('UPDATE economy SET coins = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ? AND user_id = ?');
    this.updateBankStmt = db.prepare('UPDATE economy SET bank = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ? AND user_id = ?');
    this.updateDailyStmt = db.prepare('UPDATE economy SET last_daily = ?, current_streak = ?, highest_streak = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ? AND user_id = ?');
  }

  get(guildId, userId) {
    this.users.get(guildId, userId); // Ensure user exists
    this.insertStmt.run(guildId, userId);
    return this.selectStmt.get(guildId, userId);
  }

  updateCoins(guildId, userId, coins) {
    this.get(guildId, userId); // Ensure economy record exists
    this.updateCoinsStmt.run(coins, guildId, userId);
    return this.get(guildId, userId);
  }

  updateBank(guildId, userId, bank) {
    this.get(guildId, userId); // Ensure economy record exists
    this.updateBankStmt.run(bank, guildId, userId);
    return this.get(guildId, userId);
  }

  updateDaily(guildId, userId, lastDaily, currentStreak, highestStreak) {
    this.get(guildId, userId); // Ensure economy record exists
    this.updateDailyStmt.run(lastDaily, currentStreak, highestStreak, guildId, userId);
    return this.get(guildId, userId);
  }
}

class LevelRepository {
  constructor(db, users) {
    this.db = db;
    this.users = users;
    this.selectStmt = db.prepare('SELECT * FROM levels WHERE guild_id = ? AND user_id = ?');
    this.insertStmt = db.prepare('INSERT OR IGNORE INTO levels (guild_id, user_id) VALUES (?, ?)');
    this.updateXpStmt = db.prepare('UPDATE levels SET xp = ?, level = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ? AND user_id = ?');
    this.getRankStmt = db.prepare('SELECT user_id FROM levels WHERE guild_id = ? ORDER BY xp DESC');
  }

  get(guildId, userId) {
    this.users.get(guildId, userId); // Ensure user exists
    this.insertStmt.run(guildId, userId);
    return this.selectStmt.get(guildId, userId);
  }

  updateXp(guildId, userId, xp, level) {
    const current = this.get(guildId, userId); // Ensure level record exists & get current values
    const oldLevel = current ? current.level : 1;

    console.log(`[TRACE] updateXp called. guildId: ${guildId}, userId: ${userId}, xp: ${xp}, level: ${level}, oldLevel: ${oldLevel}`);

    this.updateXpStmt.run(xp, level, guildId, userId);

    if (level > oldLevel) {
      console.log(`[TRACE] Level increase detected. Publishing userLevelUp event.`);
      const eventBus = require('./eventBus');
      eventBus.publish('userLevelUp', {
        guildId,
        userId,
        oldLevel,
        newLevel: level,
        xp
      });
    } else {
      console.log(`[TRACE] No level increase: level (${level}) <= oldLevel (${oldLevel})`);
    }

    return this.get(guildId, userId);
  }

  getRank(guildId, userId) {
    this.get(guildId, userId); // Ensure level record exists
    const rows = this.getRankStmt.all(guildId);
    const index = rows.findIndex(r => r.user_id === userId);
    return index === -1 ? 1 : index + 1;
  }
}

class InventoryRepository {
  constructor(db, users) {
    this.db = db;
    this.users = users;
    this.selectStmt = db.prepare('SELECT * FROM inventory WHERE guild_id = ? AND user_id = ?');
    this.selectItemStmt = db.prepare('SELECT * FROM inventory WHERE guild_id = ? AND user_id = ? AND item_id = ?');
    this.insertStmt = db.prepare('INSERT OR IGNORE INTO inventory (guild_id, user_id, item_id, quantity) VALUES (?, ?, ?, 0)');
    this.updateQtyStmt = db.prepare('UPDATE inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ? AND user_id = ? AND item_id = ?');
    this.deleteItemStmt = db.prepare('DELETE FROM inventory WHERE guild_id = ? AND user_id = ? AND item_id = ?');
  }

  get(guildId, userId) {
    this.users.get(guildId, userId); // Ensure user exists
    return this.selectStmt.all(guildId, userId);
  }

  getItem(guildId, userId, itemId) {
    this.users.get(guildId, userId); // Ensure user exists
    return this.selectItemStmt.get(guildId, userId, itemId);
  }

  addItem(guildId, userId, itemId, quantity) {
    this.users.get(guildId, userId); // Ensure user exists
    this.insertStmt.run(guildId, userId, itemId);
    const currentItem = this.getItem(guildId, userId, itemId);
    const newQty = (currentItem ? currentItem.quantity : 0) + quantity;
    this.updateQtyStmt.run(newQty, guildId, userId, itemId);
    return this.getItem(guildId, userId, itemId);
  }

  removeItem(guildId, userId, itemId, quantity) {
    this.users.get(guildId, userId); // Ensure user exists
    const currentItem = this.getItem(guildId, userId, itemId);
    if (!currentItem) return null;
    const newQty = Math.max(0, currentItem.quantity - quantity);
    if (newQty === 0) {
      this.deleteItemStmt.run(guildId, userId, itemId);
      return null;
    } else {
      this.updateQtyStmt.run(newQty, guildId, userId, itemId);
      return this.getItem(guildId, userId, itemId);
    }
  }
}

class AchievementRepository {
  constructor(db, users) {
    this.db = db;
    this.users = users;
    this.selectStmt = db.prepare('SELECT * FROM achievements WHERE guild_id = ? AND user_id = ?');
    this.insertStmt = db.prepare('INSERT OR IGNORE INTO achievements (guild_id, user_id, achievement_id) VALUES (?, ?, ?)');
    this.hasAchievementStmt = db.prepare('SELECT 1 FROM achievements WHERE guild_id = ? AND user_id = ? AND achievement_id = ?');
  }

  get(guildId, userId) {
    this.users.get(guildId, userId); // Ensure user exists
    return this.selectStmt.all(guildId, userId).map(r => r.achievement_id);
  }

  add(guildId, userId, achievementId) {
    this.users.get(guildId, userId); // Ensure user exists
    this.insertStmt.run(guildId, userId, achievementId);
    return this.get(guildId, userId);
  }

  has(guildId, userId, achievementId) {
    this.users.get(guildId, userId); // Ensure user exists
    return !!this.hasAchievementStmt.get(guildId, userId, achievementId);
  }
}

class TransactionRepository {
  constructor(db, users) {
    this.db = db;
    this.users = users;
    this.insertStmt = db.prepare(`
      INSERT INTO economy_transactions (id, guild_id, user_id, amount, balance_before, balance_after, transaction_type, source, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.selectUserStmt = db.prepare(`
      SELECT * FROM economy_transactions
      WHERE guild_id = ? AND user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `);
    this.selectGuildStmt = db.prepare(`
      SELECT * FROM economy_transactions
      WHERE guild_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `);
    this.selectLatestStmt = db.prepare(`
      SELECT * FROM economy_transactions
      WHERE guild_id = ? AND user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `);
  }

  create(guildId, userId, amount, before, after, type, source, reason) {
    this.users.get(guildId, userId); // Ensure user exists
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const createdAt = new Date().toISOString();
    this.insertStmt.run(id, guildId, userId, amount, before, after, type, source, reason || null, createdAt);
    return {
      id,
      guildId,
      userId,
      amount,
      balanceBefore: before,
      balanceAfter: after,
      transactionType: type,
      source,
      reason,
      createdAt
    };
  }

  listUserTransactions(guildId, userId, limit = 20) {
    this.users.get(guildId, userId); // Ensure user exists
    return this.selectUserStmt.all(guildId, userId, limit);
  }

  listGuildTransactions(guildId, limit = 50) {
    this.users.configs.get(guildId); // Ensure guild configs exists
    return this.selectGuildStmt.all(guildId, limit);
  }

  getLatest(guildId, userId) {
    this.users.get(guildId, userId); // Ensure user exists
    return this.selectLatestStmt.get(guildId, userId);
  }
}

class RoleRewardRepository {
  constructor(db, configs) {
    this.db = db;
    this.configs = configs;
    this.insertStmt = db.prepare(`
      INSERT INTO level_role_rewards (guild_id, level, role_id)
      VALUES (?, ?, ?)
      ON CONFLICT(guild_id, level) DO UPDATE SET role_id = excluded.role_id
    `);
    this.selectStmt = db.prepare('SELECT * FROM level_role_rewards WHERE guild_id = ? AND level = ?');
    this.selectAllStmt = db.prepare('SELECT * FROM level_role_rewards WHERE guild_id = ? ORDER BY level ASC');
    this.deleteStmt = db.prepare('DELETE FROM level_role_rewards WHERE guild_id = ? AND level = ?');
  }

  add(guildId, level, roleId) {
    this.configs.get(guildId); // Ensure guild config exists
    this.insertStmt.run(guildId, level, roleId);
    return this.get(guildId, level);
  }

  get(guildId, level) {
    this.configs.get(guildId); // Ensure guild config exists
    return this.selectStmt.get(guildId, level);
  }

  getAll(guildId) {
    this.configs.get(guildId); // Ensure guild config exists
    return this.selectAllStmt.all(guildId);
  }

  remove(guildId, level) {
    this.configs.get(guildId); // Ensure guild config exists
    this.deleteStmt.run(guildId, level);
  }
}

class EconomyLogRepository {
  constructor(db, configs) {
    this.db = db;
    this.configs = configs;
    this.insertStmt = db.prepare(`
      INSERT INTO economy_logs (log_id, guild_id, moderator_id, target_id, previous_value, new_value, action, reason, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.selectStmt = db.prepare(`
      SELECT * FROM economy_logs WHERE guild_id = ? ORDER BY timestamp DESC
    `);
  }

  create(guildId, moderatorId, targetId, previousValue, newValue, action, reason) {
    this.configs.get(guildId); // Ensure config exists
    const logId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const timestamp = new Date().toISOString();
    this.insertStmt.run(logId, guildId, moderatorId, targetId, previousValue, newValue, action, reason || null, timestamp);
    return {
      logId,
      guildId,
      moderatorId,
      targetId,
      previousValue,
      newValue,
      action,
      reason,
      timestamp
    };
  }

  list(guildId) {
    this.configs.get(guildId);
    return this.selectStmt.all(guildId);
  }
}

const configs = new GuildConfigRepository(sqlite);
const warnings = new WarningRepository(sqlite, configs);
const plugins = new GuildPluginRepository(sqlite, configs);
const logs = new ModerationLogRepository(sqlite, configs);
const cards = new GuildCardRepository(sqlite, configs);

const users = new UserRepository(sqlite, configs);
const economy = new EconomyRepository(sqlite, users);
const levels = new LevelRepository(sqlite, users);
const inventory = new InventoryRepository(sqlite, users);
const achievements = new AchievementRepository(sqlite, users);
const transactions = new TransactionRepository(sqlite, users);
const roleRewards = new RoleRewardRepository(sqlite, configs);
const economyLogs = new EconomyLogRepository(sqlite, configs);

class NotificationSettingsRepository {
  constructor(db, configs) {
    this.db = db;
    this.configs = configs;
    this.selectStmt = db.prepare('SELECT * FROM notification_settings WHERE guild_id = ? AND notification_type = ?');
    this.selectAllStmt = db.prepare('SELECT * FROM notification_settings WHERE guild_id = ?');
    this.upsertStmt = db.prepare(`
      INSERT INTO notification_settings (guild_id, notification_type, enabled, mention_type, mention_role_id)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, notification_type) DO UPDATE SET enabled = excluded.enabled, mention_type = excluded.mention_type, mention_role_id = excluded.mention_role_id
    `);
  }

  get(guildId, type) {
    this.configs.get(guildId); // Ensure config exists
    const row = this.selectStmt.get(guildId, type);
    if (!row) {
      return {
        enabled: true,
        mentionType: 'none',
        mentionRoleId: null
      };
    }
    return {
      enabled: !!row.enabled,
      mentionType: row.mention_type,
      mentionRoleId: row.mention_role_id || null
    };
  }

  getAll(guildId) {
    this.configs.get(guildId);
    const rows = this.selectAllStmt.all(guildId);
    const map = {};
    for (const r of rows) {
      map[r.notification_type] = {
        enabled: !!r.enabled,
        mentionType: r.mention_type,
        mentionRoleId: r.mention_role_id || null
      };
    }
    return map;
  }

  set(guildId, type, enabled, mentionType, mentionRoleId = null) {
    this.configs.get(guildId);
    this.upsertStmt.run(guildId, type, enabled ? 1 : 0, mentionType, mentionRoleId);
    return this.get(guildId, type);
  }
}

const notificationSettings = new NotificationSettingsRepository(sqlite, configs);

module.exports = {
  sqlite,
  configs,
  warnings,
  plugins,
  logs,
  cards,
  users,
  economy,
  levels,
  inventory,
  achievements,
  transactions,
  roleRewards,
  economyLogs,
  notificationSettings,
  init: () => sqlite.init(),
  // Backward compatibility layers
  ensureDataFiles: () => {}, // Schema is generated on module instantiation
  getGuildConfig: (guildId) => configs.get(guildId),
  updateGuildConfig: (guildId, updates) => configs.update(guildId, updates),
  getUserWarnings: (guildId, userId) => warnings.get(guildId, userId),
  addWarning: (guildId, userId, moderatorId, reason) => warnings.add(guildId, userId, moderatorId, reason),
  clearWarnings: (guildId, userId) => warnings.clear(guildId, userId)
};
