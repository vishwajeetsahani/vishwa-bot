const db = require('../../../utils/database');

const MAX_COINS = 999999999999999; // 999 trillion overflow limit

class EconomyService {
  // Helper validation functions
  _validateAmount(amount) {
    if (typeof amount !== 'number' || !Number.isInteger(amount)) {
      throw new Error('Amount must be an integer.');
    }
    if (amount < 0) {
      throw new Error('Amount cannot be negative.');
    }
    if (amount > MAX_COINS) {
      throw new Error('Amount exceeds maximum safe coin limit (overflow protection).');
    }
  }

  _validateNewBalance(newBalance) {
    if (newBalance < 0) {
      throw new Error('Resulting balance cannot be negative.');
    }
    if (newBalance > MAX_COINS) {
      throw new Error('Resulting balance exceeds maximum safe coin limit (overflow protection).');
    }
  }

  /**
   * Helper to ensure both user and default economy/level records exist in the database.
   * @param {string} guildId
   * @param {string} userId
   */
  createUser(guildId, userId) {
    return this.createAccount(guildId, userId);
  }

  /**
   * Creates an economy account if it does not exist.
   * @param {string} guildId
   * @param {string} userId
   */
  createAccount(guildId, userId) {
    if (!guildId || !userId) {
      throw new Error('guildId and userId are required');
    }
    db.users.create(guildId, userId);
    db.economy.get(guildId, userId);
    db.levels.get(guildId, userId);
  }

  /**
   * Checks if an economy account exists in the database.
   * @param {string} guildId
   * @param {string} userId
   * @returns {boolean}
   */
  accountExists(guildId, userId) {
    if (!guildId || !userId) return false;
    const user = db.users.selectStmt.get(guildId, userId);
    return !!user;
  }

  /**
   * Retrieves the coin balance of a user in a guild.
   * @param {string} guildId
   * @param {string} userId
   * @returns {number}
   */
  getBalance(guildId, userId) {
    this.createAccount(guildId, userId);
    const eco = db.economy.get(guildId, userId);
    return eco ? eco.coins : 0;
  }

  /**
   * Adds coins to a user's balance in a guild.
   * @param {string} guildId
   * @param {string} userId
   * @param {number} amount
   * @param {string} [source='ADMIN']
   * @param {string} [reason='Added coins']
   * @returns {number} new coin balance
   */
  addCoins(guildId, userId, amount, source = 'ADMIN', reason = 'Added coins') {
    this._validateAmount(amount);
    this.createAccount(guildId, userId);

    const current = this.getBalance(guildId, userId);
    const newBalance = current + amount;
    this._validateNewBalance(newBalance);

    db.economy.updateCoins(guildId, userId, newBalance);
    db.transactions.create(guildId, userId, amount, current, newBalance, 'ADD_COINS', source, reason);

    return newBalance;
  }

  /**
   * Removes coins from a user's balance in a guild.
   * @param {string} guildId
   * @param {string} userId
   * @param {number} amount
   * @param {string} [source='ADMIN']
   * @param {string} [reason='Removed coins']
   * @returns {number} new coin balance
   */
  removeCoins(guildId, userId, amount, source = 'ADMIN', reason = 'Removed coins') {
    this._validateAmount(amount);
    this.createAccount(guildId, userId);

    const current = this.getBalance(guildId, userId);
    const newBalance = current - amount;
    this._validateNewBalance(newBalance);

    db.economy.updateCoins(guildId, userId, newBalance);
    db.transactions.create(guildId, userId, -amount, current, newBalance, 'REMOVE_COINS', source, reason);

    return newBalance;
  }

  /**
   * Sets a user's coin balance to a specific amount in a guild.
   * @param {string} guildId
   * @param {string} userId
   * @param {number} amount
   * @param {string} [source='ADMIN']
   * @param {string} [reason='Set coins']
   * @returns {number} the set amount
   */
  setCoins(guildId, userId, amount, source = 'ADMIN', reason = 'Set coins') {
    this._validateAmount(amount);
    this.createAccount(guildId, userId);

    const current = this.getBalance(guildId, userId);
    this._validateNewBalance(amount);

    db.economy.updateCoins(guildId, userId, amount);
    db.transactions.create(guildId, userId, amount - current, current, amount, 'SET_COINS', source, reason);

    return amount;
  }

  /**
   * Transfers coins from a sender to a receiver.
   * @param {string} guildId
   * @param {string} senderId
   * @param {string} receiverId
   * @param {number} amount
   * @param {string} [reason='Transfer']
   * @returns {object} { senderBalance, receiverBalance }
   */
  transferCoins(guildId, senderId, receiverId, amount, reason = 'Transfer') {
    if (senderId === receiverId) {
      throw new Error('Cannot transfer to yourself.');
    }
    this._validateAmount(amount);
    this.createAccount(guildId, senderId);
    this.createAccount(guildId, receiverId);

    const senderCurrent = this.getBalance(guildId, senderId);
    const senderNew = senderCurrent - amount;
    this._validateNewBalance(senderNew);

    const receiverCurrent = this.getBalance(guildId, receiverId);
    const receiverNew = receiverCurrent + amount;
    this._validateNewBalance(receiverNew);

    // Perform transaction using DB transaction for safety
    const transferTx = db.sqlite.transaction(() => {
      db.economy.updateCoins(guildId, senderId, senderNew);
      db.economy.updateCoins(guildId, receiverId, receiverNew);

      db.transactions.create(guildId, senderId, -amount, senderCurrent, senderNew, 'TRANSFER_OUT', 'SHOP', reason);
      db.transactions.create(guildId, receiverId, amount, receiverCurrent, receiverNew, 'TRANSFER_IN', 'SHOP', reason);
    });

    transferTx();

    return {
      senderBalance: senderNew,
      receiverBalance: receiverNew
    };
  }

  /**
   * Deposits coins from cash to the bank.
   * @param {string} guildId
   * @param {string} userId
   * @param {number} amount
   * @param {string} [reason='Deposit to bank']
   * @returns {object} { coins, bank }
   */
  deposit(guildId, userId, amount, reason = 'Deposit to bank') {
    this._validateAmount(amount);
    this.createAccount(guildId, userId);

    const eco = db.economy.get(guildId, userId);
    const currentCoins = eco.coins;
    const currentBank = eco.bank;

    const newCoins = currentCoins - amount;
    this._validateNewBalance(newCoins);

    const newBank = currentBank + amount;
    this._validateNewBalance(newBank);

    const depositTx = db.sqlite.transaction(() => {
      db.economy.updateCoins(guildId, userId, newCoins);
      db.economy.updateBank(guildId, userId, newBank);
      db.transactions.create(guildId, userId, amount, currentCoins, newCoins, 'DEPOSIT', 'ADMIN', reason);
    });

    depositTx();

    return {
      coins: newCoins,
      bank: newBank
    };
  }

  /**
   * Withdraws coins from the bank to cash.
   * @param {string} guildId
   * @param {string} userId
   * @param {number} amount
   * @param {string} [reason='Withdrawal from bank']
   * @returns {object} { coins, bank }
   */
  withdraw(guildId, userId, amount, reason = 'Withdrawal from bank') {
    this._validateAmount(amount);
    this.createAccount(guildId, userId);

    const eco = db.economy.get(guildId, userId);
    const currentCoins = eco.coins;
    const currentBank = eco.bank;

    const newBank = currentBank - amount;
    this._validateNewBalance(newBank);

    const newCoins = currentCoins + amount;
    this._validateNewBalance(newCoins);

    const withdrawTx = db.sqlite.transaction(() => {
      db.economy.updateCoins(guildId, userId, newCoins);
      db.economy.updateBank(guildId, userId, newBank);
      db.transactions.create(guildId, userId, amount, currentCoins, newCoins, 'WITHDRAW', 'ADMIN', reason);
    });

    withdrawTx();

    return {
      coins: newCoins,
      bank: newBank
    };
  }

  /**
   * Gives a reward to a user.
   * @param {string} guildId
   * @param {string} userId
   * @param {number} amount
   * @param {string} source
   * @param {string} [reason='Reward']
   * @returns {number} new coin balance
   */
  giveReward(guildId, userId, amount, source, reason = 'Reward') {
    this._validateAmount(amount);
    if (!source) {
      throw new Error('Source is required for giveReward.');
    }
    return this.addCoins(guildId, userId, amount, source, reason);
  }

  /**
   * RPG leveling formula: Level = Math.floor(Math.sqrt(xp / 100)) + 1
   * @param {number} xp
   * @returns {number} level
   */
  calculateLevel(xp) {
    if (typeof xp !== 'number' || !Number.isInteger(xp) || xp < 0) return 1;
    return Math.floor(Math.sqrt(xp / 100)) + 1;
  }

  /**
   * Returns the minimum XP required for a given level.
   * Formula: XP = 100 * (Level - 1)^2
   * @param {number} level
   * @returns {number} xp
   */
  calculateRequiredXP(level) {
    if (typeof level !== 'number' || !Number.isInteger(level) || level <= 1) return 0;
    return 100 * Math.pow(level - 1, 2);
  }

  /**
   * Retrieves user level progress.
   * @param {string} userId
   * @param {string} guildId
   * @returns {object} { xp, level, currentLevelXp, nextLevelXp, progress }
   */
  getProgress(userId, guildId) {
    if (!userId || !guildId) {
      throw new Error('userId and guildId are required');
    }
    this.createAccount(guildId, userId);
    const lvlRecord = db.levels.get(guildId, userId);
    const xp = lvlRecord ? lvlRecord.xp : 0;
    const level = lvlRecord ? lvlRecord.level : 1;

    const currentLevelMinXp = this.calculateRequiredXP(level);
    const nextLevelMinXp = this.calculateRequiredXP(level + 1);

    const levelXpEarned = xp - currentLevelMinXp;
    const levelXpRequired = nextLevelMinXp - currentLevelMinXp;

    const progress = levelXpRequired > 0 ? Number((levelXpEarned / levelXpRequired).toFixed(2)) : 0.0;

    return {
      xp,
      level,
      currentLevelXp: levelXpEarned,
      nextLevelXp: levelXpRequired,
      progress
    };
  }

  /**
   * Adds XP to a user. Supports source parameter.
   * @param {string} userId
   * @param {string} guildId
   * @param {number} amount
   * @param {string} [source='CHAT']
   * @returns {object} { oldXp, newXp, oldLevel, newLevel, leveledUp }
   */
  addXP(userId, guildId, amount, source = 'CHAT') {
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0) {
      throw new Error('Amount must be a non-negative integer.');
    }
    this.createAccount(guildId, userId);

    const lvlRecord = db.levels.get(guildId, userId);
    const oldXp = lvlRecord ? lvlRecord.xp : 0;
    const oldLevel = lvlRecord ? lvlRecord.level : 1;

    const newXp = oldXp + amount;
    const newLevel = this.calculateLevel(newXp);
    const leveledUp = newLevel > oldLevel;

    db.levels.updateXp(guildId, userId, newXp, newLevel);

    return {
      oldXp,
      newXp,
      oldLevel,
      newLevel,
      leveledUp
    };
  }

  /**
   * Compatibility layer for step 6.1 method addXp.
   * Keep existing method signature intact.
   */
  addXp(guildId, userId, amount) {
    return this.addXP(userId, guildId, amount, 'ADMIN');
  }

  /**
   * Removes XP from a user.
   * @param {string} userId
   * @param {string} guildId
   * @param {number} amount
   * @param {string} [source='ADMIN']
   * @returns {object} { oldXp, newXp, oldLevel, newLevel, leveledDown }
   */
  removeXP(userId, guildId, amount, source = 'ADMIN') {
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0) {
      throw new Error('Amount must be a non-negative integer.');
    }
    this.createAccount(guildId, userId);

    const lvlRecord = db.levels.get(guildId, userId);
    const oldXp = lvlRecord ? lvlRecord.xp : 0;
    const oldLevel = lvlRecord ? lvlRecord.level : 1;

    const newXp = Math.max(0, oldXp - amount);
    const newLevel = this.calculateLevel(newXp);
    const leveledDown = newLevel < oldLevel;

    db.levels.updateXp(guildId, userId, newXp, newLevel);

    return {
      oldXp,
      newXp,
      oldLevel,
      newLevel,
      leveledDown
    };
  }
}

module.exports = { EconomyService: new EconomyService() };
