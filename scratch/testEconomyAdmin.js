const db = require('../utils/database');
const container = require('../utils/container');
const { EconomyService } = require('../plugins/economy/services/EconomyService');
const { enforceEconomyManager, enforceCommunityChannel } = require('../plugins/economy-admin/middleware');

async function runTests() {
  console.log('--- Starting Economy Admin & Security Validation Tests ---');

  // Initialize DB
  await db.init();
  console.log('✅ SQLite database initialized.');

  // Register services in container for testing
  container.register('db', db);
  container.register('economy', EconomyService);

  const guildId = 'test_guild_admin_' + Math.random().toString(36).slice(2, 9);
  const userId = 'test_user_admin_' + Math.random().toString(36).slice(2, 9);
  const modId = 'test_mod_admin_' + Math.random().toString(36).slice(2, 9);

  // Test 1: Configuration updates (Community, logs, role)
  console.log('Testing configurations update...');
  db.configs.update(guildId, {
    communityChannel: '1111222233334444',
    economyLogChannel: '5555666677778888',
    economyManagerRole: '9999000011112222'
  });

  const config = db.configs.get(guildId);
  if (config.communityChannel !== '1111222233334444') {
    throw new Error('Community channel config was not saved correctly.');
  }
  if (config.economyLogChannel !== '5555666677778888') {
    throw new Error('Economy log channel config was not saved correctly.');
  }
  if (config.economyManagerRole !== '9999000011112222') {
    throw new Error('Economy manager role config was not saved correctly.');
  }
  console.log('✅ Configuration updates verified.');

  // Test 2: Economy log creation & retrieval
  console.log('Testing economy log database table and repository...');
  const log = db.economyLogs.create(guildId, modId, userId, 100, 250, 'COINS_ADD', 'Test award coins');
  if (!log.logId || log.previousValue !== 100 || log.newValue !== 250 || log.action !== 'COINS_ADD' || log.reason !== 'Test award coins') {
    throw new Error(`Failed to create proper economy log: ${JSON.stringify(log)}`);
  }

  const logsList = db.economyLogs.list(guildId);
  if (logsList.length === 0 || logsList[0].log_id !== log.logId) {
    throw new Error('Failed to retrieve economy logs list or list is empty.');
  }
  console.log('✅ Economy logs database repository and list retrieval verified.');

  // Test 3: Middleware validation checks
  console.log('Testing permission and channel middleware...');

  // Mocking interactions
  const mockInteraction = {
    guild: { id: guildId, ownerId: '123' },
    member: {
      id: '123',
      permissions: {
        has: () => false
      },
      roles: {
        cache: {
          has: () => false
        }
      }
    },
    user: { id: '123' },
    channelId: '1111222233334444',
    replied: false,
    deferred: false,
    async reply(options) {
      this.replied = true;
      this.replyOptions = options;
    }
  };

  // Case 1: Member is guild owner (should allow)
  let allowed = await enforceEconomyManager(mockInteraction);
  if (!allowed) {
    throw new Error('Expected guild owner to bypass permission checks');
  }

  // Case 2: Member is not owner, has no role, no admin (should deny)
  mockInteraction.member.id = '456';
  mockInteraction.user.id = '456';
  mockInteraction.replied = false;
  allowed = await enforceEconomyManager(mockInteraction);
  if (allowed || !mockInteraction.replied) {
    throw new Error('Expected member with no privileges to be denied');
  }

  // Case 3: Member has configured manager role (should allow)
  mockInteraction.member.roles.cache.has = (roleId) => roleId === '9999000011112222';
  mockInteraction.replied = false;
  allowed = await enforceEconomyManager(mockInteraction);
  if (!allowed) {
    throw new Error('Expected configured economy manager role holder to be allowed');
  }

  // Case 4: Channel middleware - inside community channel (should allow)
  allowed = await enforceCommunityChannel(mockInteraction);
  if (!allowed) {
    throw new Error('Expected community command to work in community channel');
  }

  // Case 5: Channel middleware - outside community channel (should deny)
  mockInteraction.channelId = '999';
  mockInteraction.replied = false;
  allowed = await enforceCommunityChannel(mockInteraction);
  if (allowed || !mockInteraction.replied) {
    throw new Error('Expected community command to be blocked outside community channel');
  }

  console.log('✅ Middleware validation tests passed.');
  console.log('🎉 ALL ECONOMY ADMIN & SECURITY TESTS PASSED SUCCESSFULLY! 🎉');
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
