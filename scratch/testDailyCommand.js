const db = require('../utils/database');
const container = require('../utils/container');
const { EconomyService } = require('../plugins/economy/services/EconomyService');
const dailyCommand = require('../plugins/economy/commands/daily');

async function runTests() {
  console.log('--- Starting /daily Command Validation Tests ---');

  // Initialize DB
  await db.init();
  console.log('✅ SQLite database initialized.');

  // Register EconomyService in container
  container.register('economy', EconomyService);

  const guildId = 'test_guild_' + Math.random().toString(36).slice(2, 9);
  const authorUser = {
    id: 'daily_user_' + Math.random().toString(36).slice(2, 9),
    tag: 'DailyUser#9999'
  };

  // Setup account
  const ecoService = container.resolve('economy');
  ecoService.createAccount(guildId, authorUser.id);
  ecoService.setCoins(guildId, authorUser.id, 0);

  // -------------------------------------------------------------
  // Test 1: First Claim
  // -------------------------------------------------------------
  console.log('Testing Test 1: First Claim...');
  const interaction1 = new MockInteraction(guildId, authorUser);
  await dailyCommand.execute(interaction1, null);

  if (!interaction1.replied) {
    throw new Error('Expected interaction to be replied.');
  }

  const embed1 = interaction1.replyData.embeds[0];
  const fields1 = embed1.data.fields;
  const rewardField1 = fields1.find(f => f.name === '🎁 Reward');
  const streakField1 = fields1.find(f => f.name === '🔥 Current Streak');
  const highestField1 = fields1.find(f => f.name === '🏆 Highest Streak');
  const balanceField1 = fields1.find(f => f.name === '💰 New Balance');

  if (streakField1.value !== '`1 days`' || highestField1.value !== '`1 days`') {
    throw new Error(`Invalid first-claim streaks: Current=${streakField1.value}, Highest=${highestField1.value}`);
  }

  // Parse reward value
  const rewardVal1 = parseInt(rewardField1.value.replace(/[^0-9]/g, ''));
  if (rewardVal1 < 100 || rewardVal1 > 250) {
    throw new Error(`Reward expected to be between 100 and 250, got ${rewardVal1}`);
  }

  // Verify new balance
  const balanceVal1 = parseInt(balanceField1.value.replace(/[^0-9]/g, ''));
  if (balanceVal1 !== rewardVal1) {
    throw new Error(`Expected balance to equal reward ${rewardVal1}, got ${balanceVal1}`);
  }

  // Verify transaction log
  const tx1 = db.transactions.getLatest(guildId, authorUser.id);
  if (!tx1 || tx1.transaction_type !== 'DAILY' || tx1.source !== 'DAILY' || tx1.amount !== rewardVal1) {
    throw new Error(`Invalid daily claim transaction logged: ${JSON.stringify(tx1)}`);
  }
  console.log('✅ First claim passed.');

  // -------------------------------------------------------------
  // Test 2: Cooldown
  // -------------------------------------------------------------
  console.log('Testing Test 2: Cooldown...');
  const interaction2 = new MockInteraction(guildId, authorUser);
  await dailyCommand.execute(interaction2, null);

  const embed2 = interaction2.replyData.embeds[0];
  if (!embed2.data.title.includes('Cooldown')) {
    throw new Error(`Expected cooldown error embed, got: ${embed2.data.title}`);
  }

  // Verify balance didn't change
  const currentBalance2 = ecoService.getBalance(guildId, authorUser.id);
  if (currentBalance2 !== balanceVal1) {
    throw new Error(`Expected balance to stay ${balanceVal1}, got ${currentBalance2}`);
  }
  console.log('✅ Cooldown checks passed.');

  // -------------------------------------------------------------
  // Test 3: Streak Increment (Claim after 25 hours)
  // -------------------------------------------------------------
  console.log('Testing Test 3: Streak Increment...');
  // Force modify last_daily to 25 hours ago
  const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
  db.economy.updateDaily(guildId, authorUser.id, twentyFiveHoursAgo.toISOString(), 1, 1);

  const interaction3 = new MockInteraction(guildId, authorUser);
  await dailyCommand.execute(interaction3, null);

  const embed3 = interaction3.replyData.embeds[0];
  const fields3 = embed3.data.fields;
  const streakField3 = fields3.find(f => f.name === '🔥 Current Streak');
  const highestField3 = fields3.find(f => f.name === '🏆 Highest Streak');

  if (streakField3.value !== '`2 days`' || highestField3.value !== '`2 days`') {
    throw new Error(`Expected streak to increment to 2, got: Current=${streakField3.value}, Highest=${highestField3.value}`);
  }
  console.log('✅ Streak increment passed.');

  // -------------------------------------------------------------
  // Test 4: Streak Reset (Claim after 50 hours)
  // -------------------------------------------------------------
  console.log('Testing Test 4: Streak Reset...');
  // Force modify last_daily to 50 hours ago (should reset streak)
  const fiftyHoursAgo = new Date(Date.now() - 50 * 60 * 60 * 1000);
  db.economy.updateDaily(guildId, authorUser.id, fiftyHoursAgo.toISOString(), 2, 2);

  const interaction4 = new MockInteraction(guildId, authorUser);
  await dailyCommand.execute(interaction4, null);

  const embed4 = interaction4.replyData.embeds[0];
  const fields4 = embed4.data.fields;
  const streakField4 = fields4.find(f => f.name === '🔥 Current Streak');
  const highestField4 = fields4.find(f => f.name === '🏆 Highest Streak');

  if (streakField4.value !== '`1 days`') {
    throw new Error(`Expected streak to reset to 1, got: ${streakField4.value}`);
  }
  if (highestField4.value !== '`2 days`') {
    throw new Error(`Expected highest streak to stay 2, got: ${highestField4.value}`);
  }
  console.log('✅ Streak reset passed.');

  // -------------------------------------------------------------
  // Test 5: Bonus Reward (7-day streak)
  // -------------------------------------------------------------
  console.log('Testing Test 5: Bonus Reward...');
  // Setup user with 6-day streak, last daily 25 hours ago
  db.economy.updateDaily(guildId, authorUser.id, twentyFiveHoursAgo.toISOString(), 6, 6);
  const balanceBeforeBonus = ecoService.getBalance(guildId, authorUser.id);

  const interaction5 = new MockInteraction(guildId, authorUser);
  await dailyCommand.execute(interaction5, null);

  const embed5 = interaction5.replyData.embeds[0];
  const fields5 = embed5.data.fields;
  const bonusField5 = fields5.find(f => f.name === '🎉 Bonus');
  const streakField5 = fields5.find(f => f.name === '🔥 Current Streak');

  if (!bonusField5 || !bonusField5.value.includes('+500 coins')) {
    throw new Error('Expected 7-day bonus reward of +500 coins, got: ' + (bonusField5 ? bonusField5.value : 'none'));
  }
  if (streakField5.value !== '`7 days`') {
    throw new Error(`Expected streak to be 7, got: ${streakField5.value}`);
  }

  // Parse reward value and confirm total increase matches reward + 500 bonus
  const rewardVal5 = parseInt(fields5.find(f => f.name === '🎁 Reward').value.replace(/[^0-9]/g, ''));
  const balanceAfterBonus = ecoService.getBalance(guildId, authorUser.id);
  const expectedIncrease = rewardVal5 + 500;
  if (balanceAfterBonus - balanceBeforeBonus !== expectedIncrease) {
    throw new Error(`Expected balance increase of ${expectedIncrease}, got ${balanceAfterBonus - balanceBeforeBonus}`);
  }
  console.log('✅ Bonus reward and streak progression verified.');

  console.log('🎉 ALL /daily COMMAND TESTS PASSED SUCCESSFULLY! 🎉');
}

class MockInteraction {
  constructor(guildId, author) {
    this.id = 'mock_interaction_' + Math.random().toString(36).slice(2, 9);
    this.guild = { id: guildId };
    this.user = author;
    this.replied = false;
    this.deferred = false;
    this.replyData = null;
  }

  async reply(data) {
    if (this.replied) throw new Error('Interaction already replied');
    this.replied = true;
    this.replyData = data;
    return data;
  }

  async followUp(data) {
    this.replyData = data;
    return data;
  }
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
