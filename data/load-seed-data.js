const client = require('../lib/client');
const rules = require('./rules.js');
const { getEmoji } = require('../lib/emoji.js');

run();

async function run() {

  try {
    await client.connect();

    await Promise.all(
      rules.map(rule => {
        return client.query(`
                    INSERT INTO rules (name)
                    VALUES ($1);
                `,
        [rule.name]);
      })
    );
    

    console.log('seed data load complete', getEmoji(), getEmoji(), getEmoji());
  }
  catch(err) {
    console.log(err);
  }
  finally {
    client.end();
  }
    
}
