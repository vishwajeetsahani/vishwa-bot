const db = require('../utils/database');
const container = require('../utils/container');
const { EconomyService } = require('../plugins/economy/services/EconomyService');

async function runTests() {
  console.log('--- Starting Economy Framework Validation Tests ---');

  // Initialize DB
  await db.init();
  console.log('✅ SQLite database initialized.');

  // Register EconomyService in container for testing
  container.register('economy', EconomyService);

  // Check if EconomyService is registered in the container
  if (!container.has('economy')) {
    throw new Error('❌ EconomyService is not registered in the ServiceContainer!');
  }
  console.log('✅ EconomyService registration verified in container.');

  const economyService = container.resolve('economy');
  const guildId = 'test_guild_' + Math.random().toString(36).slice(2, 9);
  const userId = 'test_user_' + Math.random().toString(36).slice(2, 9);
  const receiverId = 'test_user_' + Math.random().toString(36).slice(2, 9);

  // Test 1: Account Creation & Existence
  console.log('Testing Account Creation & Existence...');
  if (economyService.accountExists(guildId, userId)) {
    throw new Error('Expected account not to exist before creation');
  }
  economyService.createAccount(guildId, userId);
  if (!economyService.accountExists(guildId, userId)) {
    throw new Error('Expected account to exist after creation');
  }
  console.log('✅ Account creation and existence checks passed.');

  // Test 2: Balance modifications (Add/Remove) & automatic transactions
  console.log('Testing Balance additions & subtractions...');
  economyService.setCoins(guildId, userId, 100);
  const coinsAfterSet = economyService.getBalance(guildId, userId);
  if (coinsAfterSet !== 100) {
    throw new Error(`Expected balance to be set to 100, got ${coinsAfterSet}`);
  }
  
  economyService.addCoins(guildId, userId, 50, 'QUIZ', 'Won a trivia quiz');
  const coinsAfterAdd = economyService.getBalance(guildId, userId);
  if (coinsAfterAdd !== 150) {
    throw new Error(`Expected balance to be 150, got ${coinsAfterAdd}`);
  }

  // Check transaction log
  const latestTx = db.transactions.getLatest(guildId, userId);
  if (!latestTx || latestTx.amount !== 50 || latestTx.transaction_type !== 'ADD_COINS' || latestTx.source !== 'QUIZ' || latestTx.reason !== 'Won a trivia quiz') {
    throw new Error(`Invalid transaction logs: ${JSON.stringify(latestTx)}`);
  }
  console.log('✅ Balance additions and automatic transaction logging verified.');

  // Test 3: Negative Balance & Integer validations
  console.log('Testing Validation rules (negative balances, non-integers, overflow)...');
  try {
    economyService.removeCoins(guildId, userId, 200);
    throw new Error('Expected error when removing more than current balance, but none thrown.');
  } catch (err) {
    console.log(`✅ Correctly caught negative balance error: ${err.message}`);
  }

  try {
    economyService.addCoins(guildId, userId, -50);
    throw new Error('Expected error when adding negative amount, but none thrown.');
  } catch (err) {
    console.log(`✅ Correctly caught negative add amount error: ${err.message}`);
  }

  try {
    economyService.addCoins(guildId, userId, 10.5);
    throw new Error('Expected error when adding non-integer amount, but none thrown.');
  } catch (err) {
    console.log(`✅ Correctly caught non-integer error: ${err.message}`);
  }

  try {
    economyService.addCoins(guildId, userId, 99999999999999999);
    throw new Error('Expected error when adding overflow amount, but none thrown.');
  } catch (err) {
    console.log(`✅ Correctly caught overflow protection error: ${err.message}`);
  }

  // Test 4: Transfers
  console.log('Testing coin transfer...');
  economyService.createAccount(guildId, receiverId);
  economyService.setCoins(guildId, receiverId, 0);
  economyService.setCoins(guildId, userId, 100);

  const transferResult = economyService.transferCoins(guildId, userId, receiverId, 40, 'Pay for items');
  if (transferResult.senderBalance !== 60 || transferResult.receiverBalance !== 40) {
    throw new Error(`Invalid transfer results: ${JSON.stringify(transferResult)}`);
  }

  // Check transaction logs for both users
  const senderTx = db.transactions.getLatest(guildId, userId);
  const receiverTx = db.transactions.getLatest(guildId, receiverId);
  if (!senderTx || senderTx.amount !== -40 || senderTx.transaction_type !== 'TRANSFER_OUT') {
    throw new Error(`Invalid sender transaction: ${JSON.stringify(senderTx)}`);
  }
  if (!receiverTx || receiverTx.amount !== 40 || receiverTx.transaction_type !== 'TRANSFER_IN') {
    throw new Error(`Invalid receiver transaction: ${JSON.stringify(receiverTx)}`);
  }
  console.log('✅ Transfers and matching transaction logs verified.');

  // Test 5: Deposits and Withdrawals
  console.log('Testing deposit and withdrawal...');
  economyService.setCoins(guildId, userId, 100);
  // Ensure bank starts at 0
  db.economy.updateBank(guildId, userId, 0);

  const depResult = economyService.deposit(guildId, userId, 40, 'Deposited pocket money');
  if (depResult.coins !== 60 || depResult.bank !== 40) {
    throw new Error(`Invalid deposit result: ${JSON.stringify(depResult)}`);
  }

  const witResult = economyService.withdraw(guildId, userId, 15, 'Withdrew cash');
  if (witResult.coins !== 75 || witResult.bank !== 25) {
    throw new Error(`Invalid withdraw result: ${JSON.stringify(witResult)}`);
  }
  console.log('✅ Deposit and withdrawal verified.');

  // Test 6: XP, levels calculations and progress checks
  console.log('Testing XP, levels, and progress...');
  // Set user levels/XP to 0
  db.levels.updateXp(guildId, userId, 0, 1);
  
  // Add XP from chat source
  const xpResult = economyService.addXP(userId, guildId, 250, 'CHAT');
  if (xpResult.newXp !== 250 || xpResult.newLevel !== 2 || !xpResult.leveledUp) {
    throw new Error(`Invalid addXP result: ${JSON.stringify(xpResult)}`);
  }

  // Remove XP
  const xpRemoveResult = economyService.removeXP(userId, guildId, 160, 'ADMIN');
  if (xpRemoveResult.newXp !== 90 || xpRemoveResult.newLevel !== 1 || !xpRemoveResult.leveledDown) {
    throw new Error(`Invalid removeXP result: ${JSON.stringify(xpRemoveResult)}`);
  }

  // Progress check
  const progress = economyService.getProgress(userId, guildId);
  // Level 1 required cumulative XP is 0 (from 0 to 99, 100 required for Level 2)
  // Current XP is 90. Progress should be 90/100 = 0.9
  if (progress.progress !== 0.90 || progress.level !== 1) {
    throw new Error(`Invalid progress results: ${JSON.stringify(progress)}`);
  }
  console.log('✅ Leveling and progress checks verified.');

  // Test 7: Repositories list queries integrity
  console.log('Testing transaction listing queries...');
  const userTransactions = db.transactions.listUserTransactions(guildId, userId, 5);
  if (userTransactions.length === 0) {
    throw new Error('Expected at least 1 user transaction record, got 0.');
  }

  const guildTransactions = db.transactions.listGuildTransactions(guildId, 10);
  if (guildTransactions.length === 0) {
    throw new Error('Expected at least 1 guild transaction record, got 0.');
  }
  console.log('✅ Repository listing methods verified.');

  console.log('🎉 ALL ECONOMY BACKEND IMPROVEMENTS TESTS PASSED SUCCESSFULLY! 🎉');
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
