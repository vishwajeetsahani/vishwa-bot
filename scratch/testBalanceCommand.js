const db = require('../utils/database');
const container = require('../utils/container');
const { EconomyService } = require('../plugins/economy/services/EconomyService');
const balanceCommand = require('../plugins/economy/commands/balance');

async function runTests() {
  console.log('--- Starting /balance Command Validation Tests ---');

  // Initialize DB
  await db.init();
  console.log('✅ SQLite database initialized.');

  // Register EconomyService in container
  container.register('economy', EconomyService);

  // Setup test environment mock entities
  const guildId = 'test_guild_' + Math.random().toString(36).slice(2, 9);
  
  const authorUser = {
    id: 'author_' + Math.random().toString(36).slice(2, 9),
    tag: 'AuthorUser#1234',
    displayAvatarURL: () => 'https://discord.com/assets/avatar.png'
  };

  const otherUser = {
    id: 'other_' + Math.random().toString(36).slice(2, 9),
    tag: 'OtherUser#5678',
    displayAvatarURL: () => 'https://discord.com/assets/avatar.png'
  };

  // -------------------------------------------------------------
  // Test 1: Empty Database — Own Balance
  // -------------------------------------------------------------
  console.log('Testing own balance with empty database...');
  
  const interaction1 = new MockInteraction(guildId, authorUser);
  await balanceCommand.execute(interaction1, null);

  if (!interaction1.replied) {
    throw new Error('Expected interaction to be replied');
  }

  const embed1 = interaction1.replyData.embeds[0];
  if (!embed1) {
    throw new Error('Expected embed in reply');
  }

  // Verify fields
  const fields1 = embed1.data.fields;
  const walletField1 = fields1.find(f => f.name === '💰 Wallet');
  const bankField1 = fields1.find(f => f.name === '🏦 Bank');
  const levelField1 = fields1.find(f => f.name === '⭐ Level');
  const xpField1 = fields1.find(f => f.name === '✨ XP');

  if (walletField1.value !== '`0 coins`' || bankField1.value !== '`0 coins`') {
    throw new Error(`Expected wallet/bank to be 0 for new user, got: Wallet=${walletField1.value}, Bank=${bankField1.value}`);
  }
  if (levelField1.value !== '`Level 1`' || xpField1.value !== '`0 XP`') {
    throw new Error(`Expected level 1 / 0 XP for new user, got: Level=${levelField1.value}, XP=${xpField1.value}`);
  }

  console.log('✅ Empty database / own balance checks passed (account auto-created).');

  // -------------------------------------------------------------
  // Test 2: Existing Database — Own Balance (Prepopulated)
  // -------------------------------------------------------------
  console.log('Testing own balance with existing database...');

  // Setup prepopulated values in database
  const ecoService = container.resolve('economy');
  ecoService.setCoins(guildId, authorUser.id, 500);
  db.economy.updateBank(guildId, authorUser.id, 1500);
  ecoService.addXP(authorUser.id, guildId, 150, 'CHAT'); // Level 2 needs 100 XP, 150 XP total means Level 2 with 50 XP into level

  const interaction2 = new MockInteraction(guildId, authorUser);
  await balanceCommand.execute(interaction2, null);

  const embed2 = interaction2.replyData.embeds[0];
  const fields2 = embed2.data.fields;

  const walletField2 = fields2.find(f => f.name === '💰 Wallet');
  const bankField2 = fields2.find(f => f.name === '🏦 Bank');
  const levelField2 = fields2.find(f => f.name === '⭐ Level');
  const xpField2 = fields2.find(f => f.name === '✨ XP');
  const progressField2 = fields2.find(f => f.name === '📈 Progress %');

  if (walletField2.value !== '`500 coins`' || bankField2.value !== '`1,500 coins`') {
    throw new Error(`Wallet/Bank values incorrect. Wallet=${walletField2.value}, Bank=${bankField2.value}`);
  }
  if (levelField2.value !== '`Level 2`' || xpField2.value !== '`150 XP`') {
    throw new Error(`Level/XP incorrect. Level=${levelField2.value}, XP=${xpField2.value}`);
  }
  // Progress to Level 3 (XP required: 400 total. Current Level XP is 150 - 100 = 50. Progress = 50 / 300 = 17%)
  if (!progressField2.value.includes('17%')) {
    throw new Error(`Expected progress percentage of 17%, got: ${progressField2.value}`);
  }

  console.log('✅ Existing database / own balance checks passed.');

  // -------------------------------------------------------------
  // Test 3: Existing Database — Another User's Balance
  // -------------------------------------------------------------
  console.log('Testing another user\'s balance...');

  ecoService.setCoins(guildId, otherUser.id, 999);
  db.economy.updateBank(guildId, otherUser.id, 9999);
  ecoService.addXP(otherUser.id, guildId, 450, 'CHAT'); // Level 3 starts at 400 XP, so Level 3

  const interaction3 = new MockInteraction(guildId, authorUser, otherUser);
  await balanceCommand.execute(interaction3, null);

  const embed3 = interaction3.replyData.embeds[0];
  const fields3 = embed3.data.fields;

  const walletField3 = fields3.find(f => f.name === '💰 Wallet');
  const bankField3 = fields3.find(f => f.name === '🏦 Bank');
  const levelField3 = fields3.find(f => f.name === '⭐ Level');
  const xpField3 = fields3.find(f => f.name === '✨ XP');

  if (walletField3.value !== '`999 coins`' || bankField3.value !== '`9,999 coins`') {
    throw new Error(`Wallet/Bank incorrect for other user. Wallet=${walletField3.value}, Bank=${bankField3.value}`);
  }
  if (levelField3.value !== '`Level 3`' || xpField3.value !== '`450 XP`') {
    throw new Error(`Level/XP incorrect for other user. Level=${levelField3.value}, XP=${xpField3.value}`);
  }

  console.log('✅ Another user\'s balance checks passed.');

  console.log('🎉 ALL /balance COMMAND TESTS PASSED SUCCESSFULLY! 🎉');
}

class MockInteraction {
  constructor(guildId, author, targetUser = null) {
    this.id = 'mock_interaction_' + Math.random().toString(36).slice(2, 9);
    this.guild = { id: guildId };
    this.user = author;
    this.replied = false;
    this.deferred = false;
    this.replyData = null;
    this.targetUser = targetUser;
    
    this.options = {
      getUser: (name) => {
        if (name === 'user') return this.targetUser;
        return null;
      }
    };
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
