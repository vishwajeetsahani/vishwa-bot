const db = require('../utils/database');

async function run() {
  await db.init();
  console.log('Before update:');
  console.log(db.configs.get('123'));
  
  console.log('Updating...');
  db.configs.update('123', { announcementChannel: 'announcement_chan_new_123' });
  
  console.log('After update:');
  console.log(db.configs.get('123'));
}

run().catch(console.error);
