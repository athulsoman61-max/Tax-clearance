const express = require('express');
const router = express.Router();
const { db, getCategories } = require('../database/db');
const { userAuthMiddleware, optionalUserAuthMiddleware } = require('../middleware/auth');

// Community feed
router.get('/community', optionalUserAuthMiddleware, async (req, res) => {
  try {
    const questions = await db.all(`
      SELECT q.*, c.name as category_name, c.color as category_color, u.display_name as author_name, u.avatar,
             (SELECT COUNT(*) FROM answers WHERE question_id = q.id) as answer_count
      FROM questions q
      LEFT JOIN categories c ON q.category_id = c.id
      LEFT JOIN users u ON q.user_id = u.id
      ORDER BY q.created_at DESC
      LIMIT 20
    `);
    const categories = await getCategories();
    res.render('community/index', { questions, categories, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Show question
router.get('/question/:id', optionalUserAuthMiddleware, async (req, res) => {
  try {
    const qid = req.params.id;
    // increment views
    await db.run('UPDATE questions SET views = views + 1 WHERE id = ?', [qid]);
    
    const question = await db.get(`
      SELECT q.*, c.name as category_name, c.color as category_color, u.display_name as author_name, u.avatar
      FROM questions q
      LEFT JOIN categories c ON q.category_id = c.id
      LEFT JOIN users u ON q.user_id = u.id
      WHERE q.id = ?
    `, [qid]);

    if (!question) return res.status(404).render('404');

    const answers = await db.all(`
      SELECT a.*, u.display_name as author_name, u.avatar, u.is_verified_expert, e.verification_type
      FROM answers a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN expert_profiles e ON u.id = e.user_id
      WHERE a.question_id = ?
      ORDER BY a.is_verified_answer DESC, a.created_at ASC
    `, [qid]);

    res.render('community/show_question', { question, answers, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Create question page
router.get('/questions/new', optionalUserAuthMiddleware, async (req, res) => {
  try {
    const categories = await getCategories();
    res.render('community/new_question', { categories, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Handle question creation
router.post('/questions', optionalUserAuthMiddleware, async (req, res) => {
  try {
    const { title, description, category_id, is_anonymous } = req.body;
    let userId = req.user ? req.user.id : null;
    
    // If guest, fetch guest user ID
    if (!userId) {
      let guest = await db.get("SELECT id FROM users WHERE email = 'guest@taxclearance.com'");
      if (!guest) {
        const r = await db.run("INSERT INTO users (username, email, password_hash, display_name, role) VALUES ('guest_user', 'guest@taxclearance.com', 'none', 'Guest', 'user')");
        userId = r.lastInsertRowid;
      } else {
        userId = guest.id;
      }
    }

    const result = await db.run(
      'INSERT INTO questions (title, description, user_id, category_id, is_anonymous) VALUES (?, ?, ?, ?, ?)',
      [title, description, userId, category_id || null, is_anonymous ? 1 : (!req.user ? 1 : 0)]
    );
    res.redirect(`/question/${result.lastInsertRowid}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Handle answer creation
router.post('/answers', optionalUserAuthMiddleware, async (req, res) => {
  try {
    const { question_id, content } = req.body;
    let userId = req.user ? req.user.id : null;
    
    if (!userId) {
      let guest = await db.get("SELECT id FROM users WHERE email = 'guest@taxclearance.com'");
      userId = guest ? guest.id : 0; // Assuming guest is created when question is asked
    }

    await db.run(
      'INSERT INTO answers (question_id, user_id, content) VALUES (?, ?, ?)',
      [question_id, userId, content]
    );
    res.redirect(`/question/${question_id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Experts directory
router.get('/experts', optionalUserAuthMiddleware, async (req, res) => {
  try {
    const experts = await db.all(`
      SELECT e.*, u.display_name, u.avatar, u.bio
      FROM expert_profiles e
      LEFT JOIN users u ON e.user_id = u.id
      ORDER BY e.reputation_score DESC
    `);
    res.render('community/experts', { experts, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
