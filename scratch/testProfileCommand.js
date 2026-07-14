const db = require('../utils/database');
const container = require('../utils/container');
const { EconomyService } = require('../plugins/economy/services/EconomyService');
const profileCommand = require('../plugins/economy/commands/profile');

async function runTests() {
  console.log('--- Starting /profile Command Validation Tests ---');

  // Initialize DB
  await db.init();
  console.log('✅ SQLite database initialized.');

  // Register EconomyService in container
  container.register('economy', EconomyService);

  const guildId = 'test_guild_' + Math.random().toString(36).slice(2, 9);
  
  // Create 3 users for rank testing:
  // User A: 100 XP
  // User B: 500 XP
  // User C: 300 XP
  const userA = {
    id: 'user_a_' + Math.random().toString(36).slice(2, 9),
    tag: 'UserA#1111',
    username: 'user_a',
    displayAvatarURL: () => 'https://discord.com/assets/avatar.png'
  };
  const userB = {
    id: 'user_b_' + Math.random().toString(36).slice(2, 9),
    tag: 'UserB#2222',
    username: 'user_b',
    displayAvatarURL: () => 'https://discord.com/assets/avatar.png'
  };
  const userC = {
    id: 'user_c_' + Math.random().toString(36).slice(2, 9),
    tag: 'UserC#3333',
    username: 'user_c',
    displayAvatarURL: () => 'https://discord.com/assets/avatar.png'
  };

  const ecoService = container.resolve('economy');
  
  // Set up accounts
  ecoService.createAccount(guildId, userA.id);
  ecoService.createAccount(guildId, userB.id);
  ecoService.createAccount(guildId, userC.id);

  // Set XP
  db.levels.updateXp(guildId, userA.id, 100, 2);
  db.levels.updateXp(guildId, userB.id, 500, 3);
  db.levels.updateXp(guildId, userC.id, 300, 2);

  // -------------------------------------------------------------
  // Test 1: Rank Calculation
  // -------------------------------------------------------------
  console.log('Testing Rank Calculations...');
  const rankB = db.levels.getRank(guildId, userB.id); // 1
  const rankC = db.levels.getRank(guildId, userC.id); // 2
  const rankA = db.levels.getRank(guildId, userA.id); // 3

  if (rankB !== 1 || rankC !== 2 || rankA !== 3) {
    throw new Error(`Rank calculation incorrect: B=${rankB} (expected 1), C=${rankC} (expected 2), A=${rankA} (expected 3)`);
  }
  console.log('✅ Dynamic rank calculations verified successfully.');

  // -------------------------------------------------------------
  // Test 2: Own Profile (Existing Account) & PNG Generation
  // -------------------------------------------------------------
  console.log('Testing own profile card generation...');
  const interaction2 = new MockInteraction(guildId, userC);
  
  await profileCommand.execute(interaction2, null);

  if (!interaction2.replied || !interaction2.deferred) {
    throw new Error('Expected interaction to be deferred and replied.');
  }

  const files2 = interaction2.replyData.files;
  if (!files2 || files2.length === 0) {
    throw new Error('Expected files attached in reply.');
  }

  const attachment2 = files2[0];
  const buffer2 = attachment2.attachment;
  
  // Check PNG magic bytes: 89 50 4E 47
  if (buffer2[0] !== 0x89 || buffer2[1] !== 0x50 || buffer2[2] !== 0x4E || buffer2[3] !== 0x47) {
    throw new Error('Expected attachment to be a valid PNG image buffer.');
  }
  console.log('✅ Own profile card PNG generated successfully.');

  // -------------------------------------------------------------
  // Test 3: Another User Profile (Existing Account)
  // -------------------------------------------------------------
  console.log('Testing another user profile card generation...');
  const interaction3 = new MockInteraction(guildId, userC, userB);
  
  await profileCommand.execute(interaction3, null);

  const files3 = interaction3.replyData.files;
  const buffer3 = files3[0].attachment;
  if (buffer3[0] !== 0x89 || buffer3[1] !== 0x50) {
    throw new Error('Expected valid PNG attachment for another user\'s profile.');
  }
  console.log('✅ Another user profile card PNG generated successfully.');

  // -------------------------------------------------------------
  // Test 4: Missing Account (Auto Creation)
  // -------------------------------------------------------------
  console.log('Testing missing account auto-creation on profile view...');
  const missingUser = {
    id: 'missing_' + Math.random().toString(36).slice(2, 9),
    tag: 'MissingUser#0000',
    username: 'missing_user',
    displayAvatarURL: () => 'https://discord.com/assets/avatar.png'
  };

  const interaction4 = new MockInteraction(guildId, userC, missingUser);
  await profileCommand.execute(interaction4, null);

  const files4 = interaction4.replyData.files;
  const buffer4 = files4[0].attachment;
  if (buffer4[0] !== 0x89 || buffer4[1] !== 0x50) {
    throw new Error('Expected valid PNG attachment for missing user.');
  }

  // Verify account now exists
  if (!ecoService.accountExists(guildId, missingUser.id)) {
    throw new Error('Expected missing user account to be auto-created, but it was not.');
  }
  console.log('✅ Auto-creation of account verified on profile request.');

  console.log('🎉 ALL /profile slash command tests passed successfully! 🎉');
}

class MockInteraction {
  constructor(guildId, author, targetUser = null) {
    this.id = 'mock_interaction_' + Math.random().toString(36).slice(2, 9);
    this.guild = { id: guildId, name: 'Test Guild' };
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

  async deferReply() {
    this.deferred = true;
  }

  async editReply(data) {
    this.replied = true;
    this.replyData = data;
    return data;
  }

  async reply(data) {
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
