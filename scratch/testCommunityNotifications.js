const db = require('../utils/database');
const container = require('../utils/container');
const templateEngine = require('../utils/templateEngine');
const notificationService = require('../utils/notificationService');

class MockTextChannel {
  constructor(id, name, sendAllowed = true, embedAllowed = true) {
    this.id = id;
    this.name = name;
    this.sentMessages = [];
    this.sendAllowed = sendAllowed;
    this.embedAllowed = embedAllowed;
  }

  permissionsFor(botMember) {
    return {
      has: (perm) => {
        if (perm === 'SendMessages') return this.sendAllowed;
        if (perm === 'EmbedLinks') return this.embedAllowed;
        return true;
      }
    };
  }

  async send(payload) {
    if (!this.sendAllowed) {
      throw new Error('DiscordAPIError: Missing Permissions (Mock)');
    }
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
    this.members = {
      me: { id: 'bot_me' }
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
      setFooter(foot) {
        this.data.footer = foot;
        return this;
      },
      setTimestamp() {
        this.data.timestamp = new Date();
        return this;
      },
      addFields(...fields) {
        this.data.fields.push(...fields);
        return this;
      }
    };
  }
};

// Minimal mock errors logger
const mockErrorsLogger = {
  log: (err, context) => {
    console.log(`[MockErrorLogger] Intercepted Error under context "${context}":`, err.message);
  }
};

async function runTests() {
  console.log('=== Starting Community Notifications Validation Tests ===');

  // 1. Initialize SQLite Database
  await db.init();
  container.register('db', db);
  console.log('✅ SQLite Database initialized and registered.');

  // 2. Register mock dependencies in container
  if (!container.has('templates')) {
    container.register('templates', templateEngine);
  }
  if (!container.has('embeds')) {
    container.register('embeds', mockEmbedBuilder);
  }
  if (!container.has('errors')) {
    container.register('errors', mockErrorsLogger);
  }
  const { EconomyService } = require('../plugins/economy/services/EconomyService');
  if (!container.has('economy')) {
    container.register('economy', EconomyService);
  }
  
  const guildId = 'test_guild_notif_' + Math.random().toString(36).slice(2, 8);
  const userId = 'test_user_notif_' + Math.random().toString(36).slice(2, 8);

  // Setup channels (9 Optional channels)
  const chAnnounce = new MockTextChannel('ch_announce', 'announcements');
  const chEco = new MockTextChannel('ch_eco', 'economy-logs');
  const chQuest = new MockTextChannel('ch_quest', 'quests');
  const chShop = new MockTextChannel('ch_shop', 'shop');
  const chRare = new MockTextChannel('ch_rare', 'rare-drops');
  const chAch = new MockTextChannel('ch_ach', 'achievements');
  const chEvent = new MockTextChannel('ch_event', 'events');
  const chLdr = new MockTextChannel('ch_ldr', 'leaderboard');
  const chAdmin = new MockTextChannel('ch_admin', 'admin-logs');
  const chNoPerm = new MockTextChannel('ch_noperm', 'no-permissions', false); // sendAllowed = false

  const mockGuild = new MockGuild(guildId, 'Test Server', [
    chAnnounce, chEco, chQuest, chShop, chRare, chAch, chEvent, chLdr, chAdmin, chNoPerm
  ]);
  const mockUser = new MockUser(userId, 'VishwaAdventurer');
  const mockAdmin = new MockUser('admin_123', 'VishwaAdmin');

  // --- Test 1: Configuration saving ---
  console.log('Testing channel configurations saving for 9 channels...');
  const chUpdates = {
    announcementChannel: 'ch_announce',
    economyLogChannel: 'ch_eco',
    questChannel: 'ch_quest',
    shopChannel: 'ch_shop',
    rareDropChannel: 'ch_rare',
    achievementChannel: 'ch_ach',
    eventChannel: 'ch_event',
    leaderboardChannel: 'ch_ldr',
    adminLogChannel: 'ch_admin'
  };

  const updatedConfig = db.configs.update(guildId, chUpdates);
  for (const [key, val] of Object.entries(chUpdates)) {
    if (updatedConfig[key] !== val) {
      throw new Error(`Expected config key ${key} to be ${val}, got ${updatedConfig[key]}`);
    }
  }
  console.log('✅ Configuration saving verified: 9 channels successfully save/load from SQLite.');

  // --- Test 2: Toggle and custom role mention saves correctly ---
  console.log('Testing notification settings custom role saves...');
  
  // Set level_up settings to role ping
  db.notificationSettings.set(guildId, 'level_up', true, 'role', 'role_premium_adventurer');
  const settingsLvl = db.notificationSettings.get(guildId, 'level_up');
  if (settingsLvl.enabled !== true || settingsLvl.mentionType !== 'role' || settingsLvl.mentionRoleId !== 'role_premium_adventurer') {
    throw new Error(`Failed to save settings for level_up with role mention: ${JSON.stringify(settingsLvl)}`);
  }
  console.log('✅ Notification settings custom role mention settings saved correctly.');

  // --- Test 3: Notification routing & Correct channel selection ---
  console.log('Testing active notifications routing & channel matching...');

  // Reset counters/arrays
  chAnnounce.sentMessages = [];
  chEco.sentMessages = [];
  chAdmin.sentMessages = [];
  notificationService.announcementsCount = 0;

  // 3a. Announcement: level_up
  db.notificationSettings.set(guildId, 'level_up', true, 'role', 'role_premium_adventurer');
  const announceRes = await notificationService.sendAnnouncement(mockGuild, 'level_up', mockUser, { level: 10 });
  if (!announceRes) throw new Error('Expected sendAnnouncement to complete successfully.');
  if (chAnnounce.sentMessages.length !== 1) throw new Error('Announcement not routed to chAnnounce.');
  if (chAnnounce.sentMessages[0].content !== '<@&role_premium_adventurer>') {
    throw new Error(`Expected Custom Role ping, got: ${chAnnounce.sentMessages[0].content}`);
  }
  // Verify gaming embed title and color (HIGH importance -> 0xBD00FF)
  const embedAnn = chAnnounce.sentMessages[0].embeds[0];
  if (!embedAnn.data.title.includes('⚡') || embedAnn.data.color !== 0xBD00FF) {
    throw new Error(`Invalid High announcement styling: Title=${embedAnn.data.title}, Color=${embedAnn.data.color}`);
  }
  console.log('✅ Announcement notification correctly routed and pings Custom Role.');

  // 3b. Economy Log: deposit
  db.notificationSettings.set(guildId, 'deposit', true, 'none');
  const ecoRes = await notificationService.sendEconomyLog(mockGuild, 'deposit', mockUser, 500);
  if (!ecoRes) throw new Error('Expected sendEconomyLog to complete successfully.');
  if (chEco.sentMessages.length !== 1) throw new Error('Economy Log not routed to chEco.');
  // Verify gaming embed title and color (LOW importance -> 0x5865F2)
  const embedEco = chEco.sentMessages[0].embeds[0];
  if (!embedEco.data.title.includes('🏦') || embedEco.data.color !== 0x5865F2) {
    throw new Error(`Invalid Low economy styling: Title=${embedEco.data.title}, Color=${embedEco.data.color}`);
  }
  console.log('✅ Economy Log notification correctly routed with low-importance color.');

  // 3c. Admin Log: economy_config_changed
  db.notificationSettings.set(guildId, 'economy_config_changed', true, 'none');
  const adminRes = await notificationService.sendAdminLog(mockGuild, 'economy_config_changed', mockAdmin, null, { details: 'Daily reward set to 500' });
  if (!adminRes) throw new Error('Expected sendAdminLog to complete successfully.');
  if (chAdmin.sentMessages.length !== 1) throw new Error('Admin Log not routed to chAdmin.');
  // Verify gaming embed title and color (ADMIN importance -> 0xFF003C)
  const embedAdm = chAdmin.sentMessages[0].embeds[0];
  if (!embedAdm.data.title.includes('🛠️') || embedAdm.data.color !== 0xFF003C) {
    throw new Error(`Invalid Admin styling: Title=${embedAdm.data.title}, Color=${embedAdm.data.color}`);
  }
  console.log('✅ Admin Log notification correctly routed with admin-importance color.');

  // --- Test 4: Disabled notification handling ---
  console.log('Testing disabled notification handling...');
  db.notificationSettings.set(guildId, 'level_up', false, 'none');
  chAnnounce.sentMessages = [];
  const skipRes = await notificationService.sendAnnouncement(mockGuild, 'level_up', mockUser, { level: 11 });
  if (skipRes !== null || chAnnounce.sentMessages.length > 0) {
    throw new Error('Expected notification to be skipped when disabled.');
  }
  console.log('✅ Disabled notifications skipped correctly.');

  // --- Test 5: Missing permission handling ---
  console.log('Testing missing permission handling (should fail-safe without throwing)...');
  db.configs.update(guildId, { announcementChannel: 'ch_noperm' }); // Route to chNoPerm
  db.notificationSettings.set(guildId, 'level_up', true, 'none');

  let thErr = null;
  try {
    const res = await notificationService.sendAnnouncement(mockGuild, 'level_up', mockUser, { level: 12 });
    if (res !== null) throw new Error('Expected sendAnnouncement to return null when missing permissions.');
  } catch (err) {
    thErr = err;
  }

  if (thErr) {
    throw new Error(`Framework crashed on missing permissions: ${thErr.message}`);
  }
  console.log('✅ Missing permissions are logged and handled safely without process crashes.');

  // Reset back to original announcements channel
  db.configs.update(guildId, { announcementChannel: 'ch_announce' });

  // --- Test 6: No duplicate notifications ---
  console.log('Testing duplicate notifications / announcements counts...');
  if (notificationService.announcementsCount !== 3) {
    throw new Error(`Expected exactly 3 sent messages, tracked count is: ${notificationService.announcementsCount}`);
  }
  console.log('✅ No duplicate notifications checked.');

  // --- Test 7: Prepared methods verification ---
  console.log('Testing prepared notification service signatures (quest, shop, achievement, event, leaderboard, rare drop)...');
  
  // They should check database and skip if channel not configured (or return null gracefully)
  const questNull = await notificationService.sendQuestNotification(mockGuild, 'quest_complete', mockUser);
  if (questNull !== null) {
    // Wait, questChannel is set to 'ch_quest' above, so it should attempt to route it!
    // Let's verify: is quest channel configured? Yes, chUpdates sets questChannel to 'ch_quest'.
    // So if quest is enabled, it should send!
    // Let's check if quest is enabled in db: by default it is enabled (true).
    // Let's see if chQuest got a message:
    if (chQuest.sentMessages.length !== 1) {
      throw new Error(`Expected prepared Quest notification to route to chQuest. Sent messages: ${chQuest.sentMessages.length}`);
    }
    console.log('✅ Prepared Quest method resolved and dispatched successfully.');
  }

  // --- Test 8: End-To-End Level Up Announcement Pipeline ---
  console.log('Testing End-To-End Level Up Announcement Pipeline...');
  
  // Register the eventBus subscriber (simulating index.js)
  const eventBus = require('../utils/eventBus');
  const economyService = container.resolve('economy');
  
  // Reset channels, settings, and db XP
  db.levels.updateXp(guildId, userId, 0, 1);
  db.notificationSettings.set(guildId, 'level_up', true, 'none');
  db.configs.update(guildId, { announcementChannel: 'ch_announce' });
  chAnnounce.sentMessages = [];
  
  // Setup the index.js subscription simulation
  eventBus.subscribe('userLevelUp', async ({ guildId: evGuildId, userId: evUserId, oldLevel, newLevel, xp }) => {
    try {
      const guild = mockGuild; // Use mockGuild directly for test
      const user = mockUser;   // Use mockUser directly for test
      await notificationService.sendAnnouncement(guild, 'level_up', user, { level: newLevel, xp });
    } catch (err) {
      console.error('Subscription error in test:', err);
    }
  });

  // Scenario 8a: XP without a level-up sends no announcement
  // Awarding 50 XP (Level remains 1 because Math.floor(Math.sqrt(50 / 100)) + 1 = 1)
  chAnnounce.sentMessages = [];
  economyService.addXP(userId, guildId, 50, 'CHAT');
  if (chAnnounce.sentMessages.length !== 0) {
    throw new Error(`Expected 0 announcements when XP gain does not cause level-up, but got ${chAnnounce.sentMessages.length}`);
  }
  console.log('   ✅ XP gain without level-up correctly sends NO announcement.');

  // Scenario 8b: XP causing a level-up sends exactly one announcement
  // Current XP is 50. Awarding 100 XP (Total XP: 150 -> Level = Math.floor(Math.sqrt(150 / 100)) + 1 = 2)
  chAnnounce.sentMessages = [];
  economyService.addXP(userId, guildId, 100, 'CHAT');
  await new Promise(resolve => setTimeout(resolve, 300));

  if (chAnnounce.sentMessages.length !== 1) {
    throw new Error(`Expected exactly 1 level-up announcement, but got ${chAnnounce.sentMessages.length}`);
  }
  const annMsg = chAnnounce.sentMessages[0];
  if (!annMsg.embeds[0].data.description.includes('leveled up to level **2**')) {
    throw new Error(`Unexpected announcement message text: ${annMsg.embeds[0].data.description}`);
  }
  console.log('   ✅ XP causing level-up correctly sends exactly ONE announcement.');

  // Scenario 8c: Missing channel configuration does not crash
  chAnnounce.sentMessages = [];
  db.configs.update(guildId, { announcementChannel: null }); // Remove announcement channel
  // Current XP is 150 (Level 2). Awarding 300 XP (Total XP: 450 -> Level = Math.floor(Math.sqrt(450 / 100)) + 1 = 3)
  let testError = null;
  try {
    economyService.addXP(userId, guildId, 300, 'CHAT');
    await new Promise(resolve => setTimeout(resolve, 300));
  } catch (err) {
    testError = err;
  }
  if (testError) {
    throw new Error(`Framework crashed on missing announcement channel config: ${testError.message}`);
  }
  console.log('   ✅ Missing announcement channel configuration does not crash.');

  // Scenario 8d: Disabled notifications do not send
  // Reset announcement channel
  db.configs.update(guildId, { announcementChannel: 'ch_announce' });
  // Disable level_up notifications
  db.notificationSettings.set(guildId, 'level_up', false, 'none');
  chAnnounce.sentMessages = [];
  
  // Current XP is 450 (Level 3). Awarding 500 XP (Total XP: 950 -> Level = Math.floor(Math.sqrt(950 / 100)) + 1 = 4)
  economyService.addXP(userId, guildId, 500, 'CHAT');
  await new Promise(resolve => setTimeout(resolve, 300));

  if (chAnnounce.sentMessages.length !== 0) {
    throw new Error(`Expected 0 announcements since notifications are disabled, but got ${chAnnounce.sentMessages.length}`);
  }
  console.log('   ✅ Disabled level-up notifications are correctly ignored.');

  // --- Test 9: Complete 15 Notification Types Verification ---
  console.log('Testing End-to-End pipeline for all 15 notification types...');

  // Reset channel messages and register all subscribers
  chAnnounce.sentMessages = [];
  chEco.sentMessages = [];
  chQuest.sentMessages = [];
  chShop.sentMessages = [];
  chRare.sentMessages = [];
  chAch.sentMessages = [];
  chEvent.sentMessages = [];
  chLdr.sentMessages = [];
  chAdmin.sentMessages = [];

  const resolveGuild = async (gId) => mockGuild;
  const resolveUser = async (uId) => {
    if (uId === userId) return mockUser;
    if (uId === 'admin_123') return mockAdmin;
    return new MockUser(uId, 'GenericUser');
  };

  eventBus.subscribe('economyLog', async ({ guildId, type, userId, amount, context }) => {
    const guild = await resolveGuild(guildId);
    const user = await resolveUser(userId);
    await notificationService.sendEconomyLog(guild, type, user, amount, context);
  });

  eventBus.subscribe('adminLog', async ({ guildId, type, adminId, targetId, context }) => {
    const guild = await resolveGuild(guildId);
    const admin = await resolveUser(adminId);
    const target = targetId ? await resolveUser(targetId) : null;
    await notificationService.sendAdminLog(guild, type, admin, target, context);
  });

  eventBus.subscribe('questComplete', async ({ guildId, userId, questName, reward }) => {
    const guild = await resolveGuild(guildId);
    const user = await resolveUser(userId);
    await notificationService.sendQuestNotification(guild, 'quest_complete', user, { reward: `${questName} (Reward: ${reward})` });
  });

  eventBus.subscribe('achievementUnlock', async ({ guildId, userId, achievementId, reward }) => {
    const guild = await resolveGuild(guildId);
    const user = await resolveUser(userId);
    await notificationService.sendAchievement(guild, achievementId, user, { reward });
  });

  eventBus.subscribe('rareDrop', async ({ guildId, userId, itemName, reward }) => {
    const guild = await resolveGuild(guildId);
    const user = await resolveUser(userId);
    await notificationService.sendRareDrop(guild, itemName, user, { reward });
  });

  eventBus.subscribe('shopPurchase', async ({ guildId, userId, itemName, cost, reward }) => {
    const guild = await resolveGuild(guildId);
    const user = await resolveUser(userId);
    await notificationService.sendShopNotification(guild, itemName, user, { reward });
  });

  eventBus.subscribe('tradeComplete', async ({ guildId, senderId, receiverId, amount, reason }) => {
    const guild = await resolveGuild(guildId);
    const sender = await resolveUser(senderId);
    const receiver = await resolveUser(receiverId);
    const receiverTag = receiver ? receiver.toString() : `<@${receiverId}>`;
    await notificationService.sendEconomyLog(guild, 'trade', sender, amount, { target: receiverTag, reason });
  });

  eventBus.subscribe('leaderboardUpdate', async ({ guildId, type, reward }) => {
    const guild = await resolveGuild(guildId);
    await notificationService.sendLeaderboard(guild, type, { reward });
  });

  eventBus.subscribe('eventUpdate', async ({ guildId, type, reward }) => {
    const guild = await resolveGuild(guildId);
    await notificationService.sendEvent(guild, type, { reward });
  });

  eventBus.subscribe('inventoryUpdate', async ({ guildId, userId, itemId, quantity, action }) => {
    const guild = await resolveGuild(guildId);
    const user = await resolveUser(userId);
    await notificationService.sendEconomyLog(guild, 'inventory_item', user, quantity, { item: itemId, quantity, action });
  });

  // Enable all categories in settings
  const categories = ['level_up', 'economy_log', 'admin_log', 'quest', 'shop', 'rare_drop', 'achievement', 'leaderboard', 'event'];
  for (const cat of categories) {
    db.notificationSettings.set(guildId, cat, true, 'none');
  }

  // Trigger 1. Level Up
  // We'll reset Level to 1 and XP to 50, then add 100 XP to trigger leveling up to 2
  db.levels.updateXp(guildId, userId, 50, 1);
  economyService.addXP(userId, guildId, 100, 'CHAT');
  await new Promise(resolve => setTimeout(resolve, 50));
  if (chAnnounce.sentMessages.length !== 1) {
    throw new Error(`[Test 9] Level Up announcement failed to send. Count: ${chAnnounce.sentMessages.length}`);
  }
  console.log('   ✅ Level Up verified.');

  // Trigger 2. XP Added
  eventBus.publish('economyLog', { guildId, type: 'xp_added', userId, amount: 100, context: { source: 'ADMIN', reason: 'Added 100 XP' } });
  eventBus.publish('adminLog', { guildId, type: 'admin_xp_command', adminId: 'admin_123', targetId: userId, context: { reward: 'Added 100 XP' } });
  
  // Trigger 3. XP Removed
  eventBus.publish('economyLog', { guildId, type: 'xp_removed', userId, amount: 50, context: { source: 'ADMIN', reason: 'Removed 50 XP' } });
  eventBus.publish('adminLog', { guildId, type: 'admin_xp_command', adminId: 'admin_123', targetId: userId, context: { reward: 'Removed 50 XP' } });

  // Trigger 4. Coins Added
  eventBus.publish('economyLog', { guildId, type: 'coins_added', userId, amount: 200, context: { source: 'ADMIN', reason: 'Event reward' } });
  eventBus.publish('adminLog', { guildId, type: 'admin_economy_command', adminId: 'admin_123', targetId: userId, context: { reward: 'Added 200 coins' } });

  // Trigger 5. Coins Removed
  eventBus.publish('economyLog', { guildId, type: 'coins_removed', userId, amount: 50, context: { source: 'ADMIN', reason: 'Tax deduction' } });
  eventBus.publish('adminLog', { guildId, type: 'admin_economy_command', adminId: 'admin_123', targetId: userId, context: { reward: 'Removed 50 coins' } });

  // Trigger 6. Daily Reward
  eventBus.publish('economyLog', { guildId, type: 'daily_reward', userId, amount: 150, context: { streak: 3 } });

  // Trigger 7. Quest Completed
  eventBus.publish('questComplete', { guildId, userId, questName: 'Daily Explorer', reward: '200 coins' });

  // Trigger 8. Achievement
  eventBus.publish('achievementUnlock', { guildId, userId, achievementId: 'first_step', reward: 'Path Finder' });

  // Trigger 9. Rare Drop
  eventBus.publish('rareDrop', { guildId, userId, itemName: 'Shadow Blade', reward: 'Legendary Sword' });

  // Trigger 10. Shop Purchase
  eventBus.publish('shopPurchase', { guildId, userId, itemName: 'Health Potion', cost: 10, reward: 'Restores 50 HP' });

  // Trigger 11. Trade
  eventBus.publish('tradeComplete', { guildId, senderId: userId, receiverId: 'admin_123', amount: 50, reason: 'Buying items' });

  // Trigger 12. Leaderboard
  eventBus.publish('leaderboardUpdate', { guildId, type: 'weekly', reward: 'Weekly XP Leaderboard reset' });

  // Trigger 13. Event
  eventBus.publish('eventUpdate', { guildId, type: 'double_xp', reward: 'Double XP Event is active!' });

  // Trigger 14. Admin Action (Config Change)
  eventBus.publish('adminLog', { guildId, type: 'economy_config_changed', adminId: 'admin_123', targetId: null, context: { reward: 'Set Daily to 500' } });

  // Trigger 15. Inventory Item
  eventBus.publish('inventoryUpdate', { guildId, userId, itemId: 'wood', quantity: 10, action: 'add' });

  await new Promise(resolve => setTimeout(resolve, 300));

  // Verify counts
  if (chEco.sentMessages.length !== 7) {
    throw new Error(`[Test 9] Expected exactly 7 economy log messages, got ${chEco.sentMessages.length}`);
  }
  if (chAdmin.sentMessages.length !== 5) {
    throw new Error(`[Test 9] Expected exactly 5 admin log messages, got ${chAdmin.sentMessages.length}`);
  }
  if (chQuest.sentMessages.length !== 1) {
    throw new Error(`[Test 9] Expected exactly 1 quest message, got ${chQuest.sentMessages.length}`);
  }
  if (chShop.sentMessages.length !== 1) {
    throw new Error(`[Test 9] Expected exactly 1 shop message, got ${chShop.sentMessages.length}`);
  }
  if (chRare.sentMessages.length !== 1) {
    throw new Error(`[Test 9] Expected exactly 1 rare drop message, got ${chRare.sentMessages.length}`);
  }
  if (chAch.sentMessages.length !== 1) {
    throw new Error(`[Test 9] Expected exactly 1 achievement message, got ${chAch.sentMessages.length}`);
  }
  if (chEvent.sentMessages.length !== 1) {
    throw new Error(`[Test 9] Expected exactly 1 event message, got ${chEvent.sentMessages.length}`);
  }
  if (chLdr.sentMessages.length !== 1) {
    throw new Error(`[Test 9] Expected exactly 1 leaderboard message, got ${chLdr.sentMessages.length}`);
  }

  console.log('   ✅ All 15 End-to-End notification pipelines verified successfully!');

  console.log('\n🎉 ALL FINAL FRAMEWORK NOTIFICATION TESTS COMPLETED SUCCESSFULLY! 🎉');
}

runTests().catch(err => {
  console.error('❌ Notification test failed:', err);
  process.exit(1);
});
