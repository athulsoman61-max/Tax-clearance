const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./database/dev.db',
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function seed() {
  try {
    console.log('Seeding Guest User and Sample Questions...');
    
    // 1. Create Guest User if not exists
    const guestUser = await client.execute("SELECT id FROM users WHERE email = 'guest@taxclearance.com'");
    let guestId;
    
    if (guestUser.rows.length === 0) {
      const result = await client.execute({
        sql: `INSERT INTO users (email, password_hash, display_name, role) 
              VALUES (?, 'no_login_allowed', 'Guest', 'user')`,
        args: ['guest@taxclearance.com']
      });
      guestId = result.lastInsertRowid;
      console.log('Created Guest user with ID:', guestId);
    } else {
      guestId = guestUser.rows[0].id;
      console.log('Guest user exists with ID:', guestId);
    }

    // 2. Fetch some categories
    const cats = await client.execute("SELECT id FROM categories LIMIT 4");
    const catIds = cats.rows.map(r => r.id);
    
    // 3. Insert Questions
    const questions = [
      {
        title: "How do I report crypto staking rewards?",
        desc: "I staked some Ethereum this year and received rewards. Do I report this as income when received, or only when I sell it? Also, what form does it go on?",
        catId: catIds[0] || null
      },
      {
        title: "Can I deduct my home internet if I work from home 3 days a week?",
        desc: "I am a W-2 employee but my company lets me work from home 3 days a week. Can I deduct a portion of my internet and electricity bills?",
        catId: catIds[1] || null
      },
      {
        title: "Do I need to pay estimated taxes for my side hustle?",
        desc: "I just started driving for Uber on weekends. I expect to make about $5,000 this year from it. Do I need to file quarterly estimated taxes, or can I just pay it all at tax time?",
        catId: catIds[2] || null
      },
      {
        title: "Are 529 plan contributions tax deductible federally?",
        desc: "I want to start a 529 plan for my newborn. I know earnings grow tax-free, but do I get a federal deduction for my contributions? What about state?",
        catId: catIds[3] || null
      }
    ];

    for (const q of questions) {
      await client.execute({
        sql: `INSERT INTO questions (title, description, user_id, category_id, is_anonymous, views, status)
              VALUES (?, ?, ?, ?, 1, 15, 'open')`,
        args: [q.title, q.desc, guestId, q.catId]
      });
    }

    console.log('Inserted 4 sample questions.');
    console.log('Seed complete!');

  } catch (err) {
    console.error('Error seeding data:', err);
  }
}

seed();
