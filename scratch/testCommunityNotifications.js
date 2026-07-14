const db = require('../utils/database');
const container = require('../utils/container');
const templateEngine = require('../utils/templateEngine');
const notificationService = require('../utils/notificationService');

class MockTextChannel {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.sentMessages = [];
  }

  async send(payload) {
    this.sentMessages.push(payload);
    return { id: 'mock_msg_' + Math.random().toString(36).slice(2, 9), ...payload };
  }
}

class MockGuild {
  constructor(id, name, channels = []) {
    this.id = id;
    this.name = name;
    this.channels = {
      cache: new Map(channels.map(ch => [ch.id, ch])),
      fetch: async (channelId) => {
        const ch = this.channels.cache.get(channelId);
        if (!ch) throw new Error('Channel not found');
        return ch;
      }
    };
  }
}

class MockUser {
  constructor(id, username) {
    this.id = id;
    this.username = username;
  }
  
  toString() {
    return `<@${this.id}>`;
  }

  displayAvatarURL() {
    return `https://cdn.discordapp.com/avatars/${this.id}/avatar.png`;
  }
}

// Minimal mock embeds builder for container registration
const mockEmbedBuilder = {
  create: (type) => {
    return {
      type,
      data: { fields: [] },
      setTitle(title) {
        this.data.title = title;
        return this;
      },
      setDescription(desc) {
        this.data.description = desc;
        return this;
      },
      setColor(col) {
        this.data.color = col;
        return this;
      },
      setThumbnail(url) {
        this.data.thumbnail = url;
        return this;
      },
      addFields(...fields) {
        this.data.fields.push(...fields);
        return this;
      }
    };
  }
};

async function runTests() {
  console.log('=== Starting Community Notifications Validation Tests ===');

  // 1. Initialize SQLite Database
  await db.init();
  container.register('db', db);
  console.log('✅ SQLite Database initialized and registered.');

  // 2. Register mock dependencies in container
  // (index.js normally registers these, but we override or supplement for tests)
  if (!container.has('templates')) {
    container.register('templates', templateEngine);
  }
  if (!container.has('embeds')) {
    container.register('embeds', mockEmbedBuilder);
  }
  
  const guildId = 'test_guild_notif_' + Math.random().toString(36).slice(2, 8);
  const userId = 'test_user_notif_' + Math.random().toString(36).slice(2, 8);

  // Setup channels
  const communityCh = new MockTextChannel('ch_comm', 'community');
  const levelCh = new MockTextChannel('ch_lvl', 'levels');
  const ecoCh = new MockTextChannel('ch_eco', 'economy-logs');
  const questCh = new MockTextChannel('ch_qst', 'quests');
  const achCh = new MockTextChannel('ch_ach', 'achievements');
  const eventCh = new MockTextChannel('ch_evt', 'events');
  const rareCh = new MockTextChannel('ch_rare', 'rare-drops');
  const shopCh = new MockTextChannel('ch_shp', 'shop');

  const mockGuild = new MockGuild(guildId, 'Test Server', [
    communityCh, levelCh, ecoCh, questCh, achCh, eventCh, rareCh, shopCh
  ]);
  const mockUser = new MockUser(userId, 'VishwaAdventurer');

  // --- Test 1: Channel saves correctly ---
  console.log('Testing channel configurations saves...');
  const chUpdates = {
    communityChannel: 'ch_comm',
    levelChannel: 'ch_lvl',
    economyLogChannel: 'ch_eco',
    questChannel: 'ch_qst',
    achievementChannel: 'ch_ach',
    eventChannel: 'ch_evt',
    rareDropChannel: 'ch_rare',
    shopChannel: 'ch_shp'
  };

  const updatedConfig = db.configs.update(guildId, chUpdates);
  for (const [key, val] of Object.entries(chUpdates)) {
    if (updatedConfig[key] !== val) {
      throw new Error(`Expected config key ${key} to be ${val}, got ${updatedConfig[key]}`);
    }
  }
  console.log('✅ Channel settings saved and verified correctly in SQLite.');

  // --- Test 2: Notification Toggle & Mention settings save correctly ---
  console.log('Testing notification settings (toggles, pings) saves...');
  
  // Set levels: disabled, pings here
  db.notificationSettings.set(guildId, 'level_up', false, 'here');
  const settingsLvl = db.notificationSettings.get(guildId, 'level_up');
  if (settingsLvl.enabled !== false || settingsLvl.mentionType !== 'here') {
    throw new Error(`Failed to save settings for level_up: ${JSON.stringify(settingsLvl)}`);
  }

  // Set achievements: enabled, pings user
  db.notificationSettings.set(guildId, 'achievement', true, 'user');
  const settingsAch = db.notificationSettings.get(guildId, 'achievement');
  if (settingsAch.enabled !== true || settingsAch.mentionType !== 'user') {
    throw new Error(`Failed to save settings for achievement: ${JSON.stringify(settingsAch)}`);
  }

  // Set quests: enabled, no ping
  db.notificationSettings.set(guildId, 'quest', true, 'none');
  const settingsQuest = db.notificationSettings.get(guildId, 'quest');
  if (settingsQuest.enabled !== true || settingsQuest.mentionType !== 'none') {
    throw new Error(`Failed to save settings for quest: ${JSON.stringify(settingsQuest)}`);
  }

  console.log('✅ Notification settings (toggles, pings) successfully saved and retrieved.');

  // --- Test 3: Template placeholder replacement works ---
  console.log('Testing TemplateEngine placeholder replacement...');
  const template = 'Hello {user}! Welcome to **{server}**. You are level {level} (Rank #{rank}) with {coins} coins and {xp} XP. Item: {item}, Badge: {badge}, Title: {title}, Quest: {quest}, Reward: {reward}.';
  const context = {
    user: mockUser,
    server: 'VishwaWorld',
    level: 5,
    rank: 1,
    coins: 1500,
    xp: 250,
    item: 'Silver Sword',
    badge: 'Elite Knight',
    title: 'Vishwa Hero',
    quest: 'Save the Kingdom',
    reward: 'Gold Bag'
  };

  const parsed = templateEngine.parse(template, context);
  const expected = 'Hello <@' + userId + '>! Welcome to **VishwaWorld**. You are level 5 (Rank #1) with 1500 coins and 250 XP. Item: Silver Sword, Badge: Elite Knight, Title: Vishwa Hero, Quest: Save the Kingdom, Reward: Gold Bag.';
  if (parsed !== expected) {
    throw new Error(`TemplateEngine parse mismatch!\nExpected: "${expected}"\nGot: "${parsed}"`);
  }
  console.log('✅ TemplateEngine placeholder replacement verified successfully.');

  // --- Test 4: Disabled notifications do not send ---
  console.log('Testing disabled notification dispatcher...');
  // We disabled level_up notifications above
  levelCh.sentMessages = [];
  const levelUpRes = await notificationService.sendLevelUp(mockGuild, mockUser, 5, 250, 1);
  if (levelUpRes !== null || levelCh.sentMessages.length > 0) {
    throw new Error('Expected Level Up notification to be skipped since it is disabled.');
  }
  console.log('✅ Correctly skipped disabled Level Up notification.');

  // --- Test 5: Notification Service sends to correct channels & applies mentions ---
  console.log('Testing active notifications routing and pings...');

  // 5a. Achievements (enabled: true, ping: user, channel: achCh)
  achCh.sentMessages = [];
  const achRes = await notificationService.sendAchievement(mockGuild, mockUser, 'Elite Knight', 'Unlocked for reaching level 5');
  if (!achRes) {
    throw new Error('Expected Achievement notification to be sent successfully.');
  }
  if (achCh.sentMessages.length !== 1) {
    throw new Error('Achievement channel did not receive the message.');
  }
  const achMsg = achCh.sentMessages[0];
  if (achMsg.content !== `<@${userId}>`) {
    throw new Error(`Expected ping content "<@${userId}>", got "${achMsg.content}"`);
  }
  if (!achMsg.embeds[0].data.description.includes('Elite Knight')) {
    throw new Error('Embed description does not contain the badge name.');
  }
  console.log('✅ Achievement notifications routed with user ping and correct embed content.');

  // 5b. Quests (enabled: true, ping: none, channel: questCh)
  questCh.sentMessages = [];
  // Created
  await notificationService.sendQuestCreated(mockGuild, 'Save the Kingdom', 500, 100);
  // Completed
  await notificationService.sendQuestCompleted(mockGuild, mockUser, 'Save the Kingdom', '500 coins');
  if (questCh.sentMessages.length !== 2) {
    throw new Error('Quest channel did not receive 2 messages.');
  }
  if (questCh.sentMessages[0].content || questCh.sentMessages[1].content) {
    throw new Error('Expected no pings (content should be empty/undefined) for quest notifications.');
  }
  console.log('✅ Quest notifications routed correctly without pings.');

  // 5c. Fallback to General Community Channel
  console.log('Testing fallback to general community channel...');
  // Unconfigure shop channel in DB config
  db.configs.update(guildId, { shopChannel: null });
  // Shop setting: enabled, ping: user
  db.notificationSettings.set(guildId, 'shop', true, 'user');
  
  communityCh.sentMessages = [];
  const shopRes = await notificationService.sendShopPurchase(mockGuild, mockUser, 'Red Potion', 10);
  if (!shopRes) {
    throw new Error('Expected shop purchase notification to fall back and send.');
  }
  if (communityCh.sentMessages.length !== 1) {
    throw new Error('Community fallback channel did not receive the shop alert.');
  }
  console.log('✅ Shop purchase successfully fell back to general community channel.');

  // 5d. Other notification channels check
  console.log('Testing remaining notification categories (rare drop, event, economy log)...');
  
  // Rare Drop
  db.notificationSettings.set(guildId, 'rare_drop', true, 'none');
  rareCh.sentMessages = [];
  await notificationService.sendRareDrop(mockGuild, mockUser, 'Dragon Egg', 'Legendary');
  if (rareCh.sentMessages.length !== 1) {
    throw new Error('Rare drop not routed to rare drops channel.');
  }

  // Event
  db.notificationSettings.set(guildId, 'event', true, 'none');
  eventCh.sentMessages = [];
  await notificationService.sendEventAnnouncement(mockGuild, 'Double XP Weekend', '2x XP for all activities');
  if (eventCh.sentMessages.length !== 1) {
    throw new Error('Event announcement not routed to events channel.');
  }

  // Economy Log
  db.notificationSettings.set(guildId, 'economy', true, 'none');
  ecoCh.sentMessages = [];
  await notificationService.sendEconomyLog(mockGuild, 'VishwaAdventurer was awarded 100 coins');
  if (ecoCh.sentMessages.length !== 1) {
    throw new Error('Economy log not routed to economy log channel.');
  }

  console.log('✅ All other notification modules verified.');

  console.log('\n🎉 ALL PHASE 2.6 NOTIFICATION TESTS COMPLETED SUCCESSFULLY! 🎉');
}

runTests().catch(err => {
  console.error('❌ Notification test failed:', err);
  process.exit(1);
});
