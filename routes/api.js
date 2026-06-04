const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Infinite scroll API
router.get('/articles', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const perPage = parseInt(req.query.per_page) || 10;
  const offset = (page - 1) * perPage;
  const category = req.query.category || null;

  let query = `
    SELECT a.id, a.title, a.slug, a.excerpt, a.featured_image, a.reading_time,
           a.publish_date, a.created_at, a.views,
           c.name as category_name, c.slug as category_slug, c.color as category_color, c.icon as category_icon,
           u.display_name as author_name
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN users u ON a.author_id = u.id
    WHERE a.status = 'published' AND (a.publish_date IS NULL OR a.publish_date <= CURRENT_TIMESTAMP)
  `;
  const params = [];

  if (category) {
    query += ' AND c.slug = ?';
    params.push(category);
  }

  query += ' ORDER BY a.publish_date DESC, a.created_at DESC LIMIT ? OFFSET ?';
  params.push(perPage, offset);

  const articles = db.prepare(query).all(...params);

  const countQuery = category
    ? `SELECT COUNT(*) as cnt FROM articles a LEFT JOIN categories c ON a.category_id = c.id WHERE a.status = 'published' AND c.slug = ?`
    : `SELECT COUNT(*) as cnt FROM articles WHERE status = 'published'`;
  const total = category
    ? db.prepare(countQuery).get(category).cnt
    : db.prepare(countQuery).get().cnt;

  res.json({
    articles,
    page,
    perPage,
    total,
    hasMore: offset + articles.length < total,
  });
});

// Live search API
router.get('/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);

  const results = db.prepare(`
    SELECT a.id, a.title, a.slug, a.excerpt, a.featured_image,
           c.name as category_name, c.slug as category_slug, c.color as category_color
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published' AND (a.title LIKE ? OR a.excerpt LIKE ? OR a.seo_keywords LIKE ?)
    ORDER BY a.views DESC LIMIT 6
  `).all(`%${q}%`, `%${q}%`, `%${q}%`);

  res.json(results);
});

// Trending articles
router.get('/trending', (req, res) => {
  const articles = db.prepare(`
    SELECT a.id, a.title, a.slug, a.views, a.reading_time,
           c.name as category_name, c.color as category_color
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published'
    ORDER BY a.views DESC LIMIT 5
  `).all();
  res.json(articles);
});

module.exports = router;
