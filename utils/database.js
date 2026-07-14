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
    `);
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
      spamInterval: row.spam_interval
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

const configs = new GuildConfigRepository(sqlite);
const warnings = new WarningRepository(sqlite, configs);
const plugins = new GuildPluginRepository(sqlite, configs);
const logs = new ModerationLogRepository(sqlite, configs);
const cards = new GuildCardRepository(sqlite, configs);

module.exports = {
  sqlite,
  configs,
  warnings,
  plugins,
  logs,
  cards,
  init: () => sqlite.init(),
  // Backward compatibility layers
  ensureDataFiles: () => {}, // Schema is generated on module instantiation
  getGuildConfig: (guildId) => configs.get(guildId),
  updateGuildConfig: (guildId, updates) => configs.update(guildId, updates),
  getUserWarnings: (guildId, userId) => warnings.get(guildId, userId),
  addWarning: (guildId, userId, moderatorId, reason) => warnings.add(guildId, userId, moderatorId, reason),
  clearWarnings: (guildId, userId) => warnings.clear(guildId, userId)
};
