const db = require('../utils/database');
const container = require('../utils/container');
const cache = require('../utils/cache');
const eventBus = require('../utils/eventBus');
const { EconomyService } = require('../plugins/economy/services/EconomyService');
const messageCreateEvent = require('../plugins/economy/events/messageCreate');

async function runTests() {
  console.log('--- Starting Economy Leveling & Chat XP Validation Tests ---');

  // Initialize DB
  await db.init();
  console.log('✅ SQLite database initialized.');

  // Register EconomyService in container
  container.register('economy', EconomyService);

  const guildId = 'test_guild_' + Math.random().toString(36).slice(2, 9);
  const userId = 'chat_user_' + Math.random().toString(36).slice(2, 9);

  // Setup account
  const ecoService = container.resolve('economy');
  ecoService.createAccount(guildId, userId);
  db.levels.updateXp(guildId, userId, 0, 1);

  // -------------------------------------------------------------
  // Test 1: Ignored Bots
  // -------------------------------------------------------------
  console.log('Testing Test 1: Ignored Bots...');
  const botMessage = new MockMessage(guildId, userId, 'Hello!', { bot: true });
  await messageCreateEvent.execute(botMessage, null);

  const xpAfterBot = ecoService.getProgress(userId, guildId).xp;
  if (xpAfterBot !== 0) {
    throw new Error(`Expected 0 XP after bot message, got ${xpAfterBot}`);
  }
  console.log('✅ Bots correctly ignored.');

  // -------------------------------------------------------------
  // Test 2: Ignored Webhooks / System Messages
  // -------------------------------------------------------------
  console.log('Testing Test 2: Ignored Webhooks & System Messages...');
  const webhookMsg = new MockMessage(guildId, userId, 'Hello!', { webhookId: '12345' });
  await messageCreateEvent.execute(webhookMsg, null);
  const sysMsg = new MockMessage(guildId, userId, 'System Alert', { system: true });
  await messageCreateEvent.execute(sysMsg, null);

  const xpAfterSys = ecoService.getProgress(userId, guildId).xp;
  if (xpAfterSys !== 0) {
    throw new Error(`Expected 0 XP after system/webhook messages, got ${xpAfterSys}`);
  }
  console.log('✅ Webhooks & system messages correctly ignored.');

  // -------------------------------------------------------------
  // Test 3: Ignored Slash Commands (Interactions)
  // -------------------------------------------------------------
  console.log('Testing Test 3: Ignored Slash Commands...');
  const slashMsg = new MockMessage(guildId, userId, 'Slash command response', { interaction: { id: 'interaction_123' } });
  await messageCreateEvent.execute(slashMsg, null);

  const xpAfterSlash = ecoService.getProgress(userId, guildId).xp;
  if (xpAfterSlash !== 0) {
    throw new Error(`Expected 0 XP after slash command output message, got ${xpAfterSlash}`);
  }
  console.log('✅ Slash command messages correctly ignored.');

  // -------------------------------------------------------------
  // Test 4: XP Gain & Cooldown
  // -------------------------------------------------------------
  console.log('Testing Test 4: XP Gain & Cooldown...');
  cache.clear(); // Ensure no cooldown exists
  const userMessage = new MockMessage(guildId, userId, 'A normal chat message');
  await messageCreateEvent.execute(userMessage, null);

  const progressAfterFirstMsg = ecoService.getProgress(userId, guildId);
  const firstXp = progressAfterFirstMsg.xp;
  if (firstXp < 15 || firstXp > 25) {
    throw new Error(`Expected first message XP gain between 15 and 25, got ${firstXp}`);
  }
  console.log(`✅ Normal message awarded ${firstXp} XP successfully.`);

  // Send another message immediately (should be on cooldown)
  const spamMessage = new MockMessage(guildId, userId, 'Another fast message');
  await messageCreateEvent.execute(spamMessage, null);

  const secondXp = ecoService.getProgress(userId, guildId).xp;
  if (secondXp !== firstXp) {
    throw new Error(`XP changed during cooldown! First: ${firstXp}, Second: ${secondXp}`);
  }
  console.log('✅ Cooldown blocked XP gain successfully.');

  // -------------------------------------------------------------
  // Test 5: Level Up & EventBus Publication
  // -------------------------------------------------------------
  console.log('Testing Test 5: Level Up & EventBus Publish...');
  cache.clear(); // Clear cooldown
  // Manually pre-set user XP to 90 (Level 1)
  db.levels.updateXp(guildId, userId, 90, 1);

  let eventFired = false;
  let eventPayload = null;

  eventBus.subscribe('userLevelUp', (payload) => {
    eventFired = true;
    eventPayload = payload;
  });

  const levelUpMessage = new MockMessage(guildId, userId, 'Trigger level up');
  await messageCreateEvent.execute(levelUpMessage, null);

  const progressAfterLevelUp = ecoService.getProgress(userId, guildId);
  const finalXp = progressAfterLevelUp.xp;
  const finalLevel = progressAfterLevelUp.level;

  if (finalLevel !== 2) {
    throw new Error(`Expected user to level up to 2, got Level ${finalLevel} (XP: ${finalXp})`);
  }
  if (!eventFired) {
    throw new Error('Level up event did not publish through EventBus.');
  }
  if (eventPayload.userId !== userId || eventPayload.guildId !== guildId || eventPayload.oldLevel !== 1 || eventPayload.newLevel !== 2) {
    throw new Error(`Invalid EventBus payload: ${JSON.stringify(eventPayload)}`);
  }
  console.log('✅ Level up correctly detected and published to EventBus.');

  // -------------------------------------------------------------
  // Test 6: Role Rewards Backend Integrity
  // -------------------------------------------------------------
  console.log('Testing Test 6: Role Rewards Backend Repository...');
  db.roleRewards.add(guildId, 5, 'role_mod_5');
  db.roleRewards.add(guildId, 10, 'role_admin_10');

  const rewardLvl5 = db.roleRewards.get(guildId, 5);
  if (!rewardLvl5 || rewardLvl5.role_id !== 'role_mod_5') {
    throw new Error(`Expected role_mod_5 for Level 5 reward, got: ${JSON.stringify(rewardLvl5)}`);
  }

  const allRewards = db.roleRewards.getAll(guildId);
  if (allRewards.length !== 2 || allRewards[0].level !== 5 || allRewards[1].level !== 10) {
    throw new Error(`Expected 2 rewards ordered by level, got: ${JSON.stringify(allRewards)}`);
  }

  db.roleRewards.remove(guildId, 5);
  const deletedReward = db.roleRewards.get(guildId, 5);
  if (deletedReward) {
    throw new Error('Expected Level 5 reward to be deleted, but still found in DB');
  }
  console.log('✅ Role rewards backend storage functioning correctly.');

  console.log('🎉 ALL ECONOMY LEVELING & CHAT XP TESTS PASSED SUCCESSFULLY! 🎉');
}

class MockMessage {
  constructor(guildId, authorId, content, options = {}) {
    this.guild = { id: guildId };
    this.author = {
      id: authorId,
      bot: !!options.bot,
      tag: options.bot ? 'MockBot#0000' : 'MockUser#7777'
    };
    this.content = content;
    this.system = !!options.system;
    this.webhookId = options.webhookId || null;
    this.interaction = options.interaction || null;
  }
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
