const { db } = require('./database/db-turso');

async function migrate() {
  try {
    console.log("Adding new tables...");
    const tables = [
      `CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        category_id INTEGER,
        is_anonymous INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        status TEXT DEFAULT 'open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )`,
      `CREATE TABLE IF NOT EXISTS answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        is_verified_answer INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS discussions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        category_id INTEGER,
        views INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )`,
      `CREATE TABLE IF NOT EXISTS expert_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        verification_type TEXT NOT NULL,
        credentials TEXT,
        experience TEXT,
        specialization TEXT,
        reputation_score INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category_id)`,
      `CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id)`
    ];

    for (const sql of tables) {
      await db.run(sql);
    }
    console.log("New tables added.");

    // Check if is_verified_expert column exists
    const cols = await db.all("PRAGMA table_info(users)");
    const hasExpertCol = cols.some(c => c.name === 'is_verified_expert');
    if (!hasExpertCol) {
      await db.run("ALTER TABLE users ADD COLUMN is_verified_expert INTEGER DEFAULT 0");
      console.log("Added is_verified_expert to users table.");
    }
    
    console.log("Migration complete!");
  } catch (e) {
    console.error("Migration error:", e);
  }
}

migrate();
