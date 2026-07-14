const db = require('../utils/database');

async function run() {
  await db.init();
  const info = db.sqlite.pragma('table_info(guild_configs)');
  console.log('Columns in guild_configs:');
  console.log(JSON.stringify(info, null, 2));
}

run().catch(console.error);
