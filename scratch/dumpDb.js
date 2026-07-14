const db = require('../utils/database');

async function run() {
  await db.init();
  console.log('--- GUILD CONFIGS ---');
  const configs = db.sqlite.prepare('SELECT * FROM guild_configs').all();
  console.log(JSON.stringify(configs, null, 2));

  console.log('--- NOTIFICATION SETTINGS ---');
  const settings = db.sqlite.prepare('SELECT * FROM notification_settings').all();
  console.log(JSON.stringify(settings, null, 2));
}

run().catch(console.error);
