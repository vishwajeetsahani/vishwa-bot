const db = require('../utils/database');

async function run() {
  await db.init();
  const rows = db.sqlite.prepare('SELECT * FROM guild_configs').all();
  console.log('Real Guild Configs:');
  for (const row of rows) {
    if (!row.guild_id.startsWith('test_guild')) {
      console.log(JSON.stringify(row, null, 2));
    }
  }
}

run().catch(console.error);
