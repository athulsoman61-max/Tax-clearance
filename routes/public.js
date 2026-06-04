const express = require('express');
const router = express.Router();
const db = require('../database/db');

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row?.value || '';
}

function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = {};
  rows.forEach(r => s[r.key] = r.value);
  return s;
}

// Homepage
router.get('/', (req, res) => {
  const settings = getAllSettings();
  const perPage = parseInt(settings.articles_per_page) || 10;

  const articles = db.prepare(`
    SELECT a.*, c.name as category_name, c.slug as category_slug, c.color as category_color, c.icon as category_icon,
           u.display_name as author_name
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN users u ON a.author_id = u.id
    WHERE a.status = 'published' AND (a.publish_date IS NULL OR a.publish_date <= CURRENT_TIMESTAMP)
    ORDER BY a.publish_date DESC, a.created_at DESC
    LIMIT ?
  `).all(perPage);

  const trending = db.prepare(`
    SELECT a.id, a.title, a.slug, a.excerpt, a.featured_image, a.views, a.reading_time, a.publish_date,
           c.name as category_name, c.slug as category_slug, c.color as category_color
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published'
    ORDER BY a.views DESC LIMIT 5
  `).all();

  const irsUpdates = db.prepare(`
    SELECT a.id, a.title, a.slug, a.excerpt, a.publish_date
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published' AND c.slug = 'irs-updates'
    ORDER BY a.publish_date DESC LIMIT 4
  `).all();

  const featured = db.prepare(`
    SELECT a.*, c.name as category_name, c.slug as category_slug, c.color as category_color
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published' AND a.is_featured = 1
    ORDER BY a.publish_date DESC LIMIT 1
  `).get();

  const categories = db.prepare(`SELECT * FROM categories ORDER BY article_count DESC`).all();
  const totalArticles = db.prepare(`SELECT COUNT(*) as cnt FROM articles WHERE status = 'published'`).get().cnt;

  res.render('home', {
    articles,
    trending,
    irsUpdates,
    featured,
    categories,
    totalArticles,
    hasMore: totalArticles > perPage,
    settings,
    page: 'home',
    title: `${settings.site_name} — ${settings.site_tagline}`,
    description: settings.site_description,
  });
});

// Article page
router.get('/article/:slug', (req, res) => {
  const settings = getAllSettings();
  const article = db.prepare(`
    SELECT a.*, c.name as category_name, c.slug as category_slug, c.color as category_color, c.icon as category_icon,
           u.display_name as author_name, u.bio as author_bio, u.avatar as author_avatar
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN users u ON a.author_id = u.id
    WHERE a.slug = ? AND a.status = 'published'
  `).get(req.params.slug);

  if (!article) return res.status(404).render('404', { settings, title: 'Page Not Found', description: '' });

  // Increment views
  db.prepare('UPDATE articles SET views = views + 1 WHERE id = ?').run(article.id);

  const related = db.prepare(`
    SELECT a.id, a.title, a.slug, a.excerpt, a.featured_image, a.reading_time, a.publish_date,
           c.name as category_name, c.slug as category_slug, c.color as category_color
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published' AND a.category_id = ? AND a.id != ?
    ORDER BY a.views DESC LIMIT 3
  `).all(article.category_id, article.id);

  const comments = db.prepare(`
    SELECT * FROM comments WHERE article_id = ? AND status = 'approved' ORDER BY created_at DESC
  `).all(article.id);

  const tags = db.prepare(`
    SELECT t.name, t.slug FROM tags t
    JOIN article_tags at ON t.id = at.tag_id
    WHERE at.article_id = ?
  `).all(article.id);

  const categories = db.prepare('SELECT * FROM categories ORDER BY article_count DESC').all();

  res.render('article', {
    article,
    related,
    comments,
    tags,
    categories,
    settings,
    page: 'article',
    query: req.query,
    title: article.seo_title || `${article.title} | ${settings.site_name}`,
    description: article.seo_description || article.excerpt,
  });
});

// Category page
router.get('/category/:slug', (req, res) => {
  const settings = getAllSettings();
  const category = db.prepare('SELECT * FROM categories WHERE slug = ?').get(req.params.slug);
  if (!category) return res.status(404).render('404', { settings, title: 'Category Not Found', description: '' });

  const page = parseInt(req.query.page) || 1;
  const perPage = parseInt(settings.articles_per_page) || 10;
  const offset = (page - 1) * perPage;

  const articles = db.prepare(`
    SELECT a.*, c.name as category_name, c.slug as category_slug, c.color as category_color, c.icon as category_icon,
           u.display_name as author_name
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN users u ON a.author_id = u.id
    WHERE a.status = 'published' AND a.category_id = ?
    ORDER BY a.publish_date DESC, a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(category.id, perPage, offset);

  const total = db.prepare('SELECT COUNT(*) as cnt FROM articles WHERE status = ? AND category_id = ?').get('published', category.id).cnt;
  const categories = db.prepare('SELECT * FROM categories ORDER BY article_count DESC').all();

  res.render('category', {
    category,
    articles,
    categories,
    settings,
    page: 'category',
    currentPage: page,
    totalPages: Math.ceil(total / perPage),
    total,
    title: `${category.name} | ${settings.site_name}`,
    description: category.description,
  });
});

// Search
router.get('/search', (req, res) => {
  const settings = getAllSettings();
  const q = (req.query.q || '').trim();
  const categories = db.prepare('SELECT * FROM categories ORDER BY article_count DESC').all();

  let results = [];
  if (q.length >= 2) {
    results = db.prepare(`
      SELECT a.*, c.name as category_name, c.slug as category_slug, c.color as category_color,
             u.display_name as author_name
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.status = 'published' AND (
        a.title LIKE ? OR a.content LIKE ? OR a.excerpt LIKE ? OR a.seo_keywords LIKE ?
      )
      ORDER BY a.views DESC LIMIT 30
    `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  res.render('search', {
    results,
    query: q,
    categories,
    settings,
    page: 'search',
    title: q ? `Search: "${q}" | ${settings.site_name}` : `Search | ${settings.site_name}`,
    description: `Search results for "${q}" on ${settings.site_name}`,
  });
});

// About page
router.get('/about', (req, res) => {
  const settings = getAllSettings();
  const categories = db.prepare('SELECT * FROM categories ORDER BY article_count DESC').all();
  const stats = {
    articles: db.prepare("SELECT COUNT(*) as cnt FROM articles WHERE status = 'published'").get().cnt,
    categories: db.prepare('SELECT COUNT(*) as cnt FROM categories').get().cnt,
    readers: db.prepare('SELECT SUM(views) as total FROM articles').get().total || 0,
  };
  res.render('about', {
    settings,
    categories,
    stats,
    page: 'about',
    title: `About ${settings.ea_name} | ${settings.site_name}`,
    description: settings.ea_bio,
  });
});

// Contact page
router.get('/contact', (req, res) => {
  const settings = getAllSettings();
  const categories = db.prepare('SELECT * FROM categories ORDER BY article_count DESC').all();
  res.render('contact', {
    settings,
    categories,
    page: 'contact',
    title: `Contact & Consultation | ${settings.site_name}`,
    description: `Schedule a consultation with ${settings.ea_name}, an Enrolled Agent. Get professional tax help today.`,
    success: req.query.success,
  });
});

// Post comment
router.post('/article/:slug/comment', (req, res) => {
  const { name, email, content } = req.body;
  const article = db.prepare('SELECT id FROM articles WHERE slug = ? AND status = ?').get(req.params.slug, 'published');
  if (!article || !name || !email || !content) return res.redirect(`/article/${req.params.slug}#comments`);
  db.prepare('INSERT INTO comments (article_id, author_name, author_email, content) VALUES (?, ?, ?, ?)').run(article.id, name, email, content);
  res.redirect(`/article/${req.params.slug}?commented=1#comments`);
});

// Newsletter signup
router.post('/newsletter', (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.json({ success: false, message: 'Email required' });
  try {
    db.prepare('INSERT OR IGNORE INTO newsletter (email, name) VALUES (?, ?)').run(email, name || '');
    return res.json({ success: true, message: 'Thank you for subscribing!' });
  } catch (e) {
    return res.json({ success: false, message: 'Already subscribed.' });
  }
});

// Contact form
router.post('/contact', (req, res) => {
  const { name, email, phone, service_type, message, preferred_date } = req.body;
  if (!name || !email || !message) return res.redirect('/contact?error=1');
  db.prepare('INSERT INTO leads (name, email, phone, service_type, message, preferred_date) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, email, phone || '', service_type || '', message, preferred_date || '');
  res.redirect('/contact?success=1');
});

// Sitemap
router.get('/sitemap.xml', (req, res) => {
  const settings = getAllSettings();
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  const articles = db.prepare(`SELECT slug, updated_at FROM articles WHERE status = 'published' ORDER BY updated_at DESC`).all();
  const categories = db.prepare('SELECT slug FROM categories').all();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${siteUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${siteUrl}/about</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>${siteUrl}/contact</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>${siteUrl}/search</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>`;

  categories.forEach(c => {
    xml += `\n  <url><loc>${siteUrl}/category/${c.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
  });
  articles.forEach(a => {
    const lastmod = a.updated_at ? a.updated_at.split('T')[0] : new Date().toISOString().split('T')[0];
    xml += `\n  <url><loc>${siteUrl}/article/${a.slug}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>`;
  });

  xml += '\n</urlset>';
  res.set('Content-Type', 'application/xml');
  res.send(xml);
});

// Robots.txt
router.get('/robots.txt', (req, res) => {
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  res.set('Content-Type', 'text/plain');
  res.send(`User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${siteUrl}/sitemap.xml\n`);
});

module.exports = router;
