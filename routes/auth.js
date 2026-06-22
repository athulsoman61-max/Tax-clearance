const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database/db');

// Registration page
router.get('/register', (req, res) => {
  res.render('auth/register', { error: null });
});

// Handle registration
router.post('/register', async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;
  if (password !== confirmPassword) {
    return res.render('auth/register', { error: 'Passwords do not match.' });
  }

  try {
    const existing = await db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
      return res.render('auth/register', { error: 'Username or email already exists.' });
    }

    const hash = bcrypt.hashSync(password, 10);
    await db.run(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [username, email, hash, 'user']
    );

    res.redirect('/login?registered=1');
  } catch (err) {
    console.error(err);
    res.render('auth/register', { error: 'An error occurred during registration.' });
  }
});

// Login page
router.get('/login', (req, res) => {
  res.render('auth/login', { error: null, registered: req.query.registered });
});

// Handle login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.render('auth/login', { error: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, is_verified_expert: user.is_verified_expert },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.cookie('user_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    
    const returnTo = req.session?.returnTo || '/';
    if (req.session) delete req.session.returnTo;
    
    res.redirect(returnTo);
  } catch (err) {
    console.error(err);
    res.render('auth/login', { error: 'An error occurred during login.' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  res.clearCookie('user_token');
  res.redirect('/');
});

module.exports = router;
