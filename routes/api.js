const express = require('express');
const router = express.Router();
const { db } = require('../database/db');

// Infinite scroll API
router.get('/articles', async (req, res, next) => {
  try {
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

    const articles = await db.all(query, params);

    const countQuery = category
      ? `SELECT COUNT(*) as cnt FROM articles a LEFT JOIN categories c ON a.category_id = c.id WHERE a.status = 'published' AND c.slug = ?`
      : `SELECT COUNT(*) as cnt FROM articles WHERE status = 'published'`;
    
    const countParams = category ? [category] : [];
    const totalRow = await db.get(countQuery, countParams);
    const total = totalRow?.cnt || 0;

    res.json({
      articles,
      page,
      perPage,
      total,
      hasMore: offset + articles.length < total,
    });
  } catch (err) {
    next(err);
  }
});

// Live search API
router.get('/search', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json([]);

    const results = await db.all(`
      SELECT a.id, a.title, a.slug, a.excerpt, a.featured_image,
             c.name as category_name, c.slug as category_slug, c.color as category_color
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.status = 'published' AND (a.title LIKE ? OR a.excerpt LIKE ? OR a.seo_keywords LIKE ?)
      ORDER BY a.views DESC LIMIT 6
    `, [`%${q}%`, `%${q}%`, `%${q}%`]);

    res.json(results);
  } catch (err) {
    next(err);
  }
});

// Trending articles
router.get('/trending', async (req, res, next) => {
  try {
    const articles = await db.all(`
      SELECT a.id, a.title, a.slug, a.views, a.reading_time,
             c.name as category_name, c.color as category_color
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.status = 'published'
      ORDER BY a.views DESC LIMIT 5
    `);
    res.json(articles);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
