const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = Date.now() + '-' + Math.round(Math.random() * 1e6) + ext;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

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

// ─── Login ───────────────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.cookies?.admin_token) {
    try { jwt.verify(req.cookies.admin_token, process.env.JWT_SECRET); return res.redirect('/admin'); } catch {}
  }
  res.render('admin/login', { error: null, changed: req.query.changed, title: 'Admin Login | Tax Clearance' });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.render('admin/login', { error: 'Invalid username or password', title: 'Admin Login' });
  }
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('admin_token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.redirect('/admin');
});

router.get('/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.redirect('/admin/login');
});

// ─── Dashboard ───────────────────────────────────────────────────────────────
router.get('/', authMiddleware, (req, res) => {
  const settings = getAllSettings();
  const stats = {
    totalArticles: db.prepare(`SELECT COUNT(*) as cnt FROM articles`).get().cnt,
    published: db.prepare(`SELECT COUNT(*) as cnt FROM articles WHERE status='published'`).get().cnt,
    drafts: db.prepare(`SELECT COUNT(*) as cnt FROM articles WHERE status='draft'`).get().cnt,
    scheduled: db.prepare(`SELECT COUNT(*) as cnt FROM articles WHERE status='scheduled'`).get().cnt,
    totalViews: db.prepare(`SELECT SUM(views) as total FROM articles`).get().total || 0,
    leads: db.prepare(`SELECT COUNT(*) as cnt FROM leads`).get().cnt,
    newLeads: db.prepare(`SELECT COUNT(*) as cnt FROM leads WHERE status='new'`).get().cnt,
    subscribers: db.prepare(`SELECT COUNT(*) as cnt FROM newsletter WHERE status='active'`).get().cnt,
    comments: db.prepare(`SELECT COUNT(*) as cnt FROM comments WHERE status='pending'`).get().cnt,
  };
  const recentArticles = db.prepare(`
    SELECT a.*, c.name as category_name, c.color as category_color
    FROM articles a LEFT JOIN categories c ON a.category_id = c.id
    ORDER BY a.updated_at DESC LIMIT 8
  `).all();
  const recentLeads = db.prepare(`SELECT * FROM leads ORDER BY created_at DESC LIMIT 5`).all();
  const topArticles = db.prepare(`SELECT id, title, slug, views FROM articles WHERE status='published' ORDER BY views DESC LIMIT 5`).all();
  const categories = db.prepare('SELECT * FROM categories ORDER BY article_count DESC').all();

  res.render('admin/dashboard', {
    stats, recentArticles, recentLeads, topArticles, categories, settings,
    title: 'Dashboard | Tax Clearance Admin',
    admin: req.admin,
  });
});

// ─── Articles List ────────────────────────────────────────────────────────────
router.get('/articles', authMiddleware, (req, res) => {
  const settings = getAllSettings();
  const page = parseInt(req.query.page) || 1;
  const perPage = 20;
  const offset = (page - 1) * perPage;
  const status = req.query.status || '';
  const category = req.query.category || '';
  const search = req.query.search || '';

  let where = '1=1';
  const params = [];
  if (status) { where += ' AND a.status = ?'; params.push(status); }
  if (category) { where += ' AND c.slug = ?'; params.push(category); }
  if (search) { where += ' AND (a.title LIKE ? OR a.excerpt LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  const articles = db.prepare(`
    SELECT a.*, c.name as category_name, c.color as category_color
    FROM articles a LEFT JOIN categories c ON a.category_id = c.id
    WHERE ${where}
    ORDER BY a.updated_at DESC LIMIT ? OFFSET ?
  `).all(...params, perPage, offset);

  const total = db.prepare(`
    SELECT COUNT(*) as cnt FROM articles a LEFT JOIN categories c ON a.category_id = c.id WHERE ${where}
  `).get(...params).cnt;

  const categories = db.prepare('SELECT * FROM categories').all();

  res.render('admin/articles', {
    articles, categories, settings, total,
    currentPage: page, totalPages: Math.ceil(total / perPage),
    filters: { status, category, search },
    saved: req.query.saved,
    title: 'Articles | Tax Clearance Admin',
    admin: req.admin,
  });
});

// ─── Article Editor (new) ─────────────────────────────────────────────────────
router.get('/articles/new', authMiddleware, (req, res) => {
  const settings = getAllSettings();
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  const tags = db.prepare('SELECT * FROM tags ORDER BY name').all();
  const allArticles = db.prepare("SELECT id, title, slug FROM articles WHERE status='published' ORDER BY title").all();
  res.render('admin/editor', {
    article: null, categories, tags, allArticles, settings,
    title: 'New Article | Tax Clearance Admin',
    admin: req.admin,
  });
});

// ─── Article Editor (edit) ────────────────────────────────────────────────────
router.get('/articles/:id/edit', authMiddleware, (req, res) => {
  const settings = getAllSettings();
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!article) return res.redirect('/admin/articles');
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  const tags = db.prepare('SELECT * FROM tags ORDER BY name').all();
  const articleTags = db.prepare(`SELECT tag_id FROM article_tags WHERE article_id = ?`).all(article.id).map(r => r.tag_id);
  const allArticles = db.prepare("SELECT id, title, slug FROM articles WHERE status='published' AND id != ? ORDER BY title").all(article.id);
  res.render('admin/editor', {
    article: { ...article, selectedTags: articleTags }, categories, tags, allArticles, settings,
    title: `Edit: ${article.title} | Admin`,
    admin: req.admin,
  });
});

// ─── Save Article ─────────────────────────────────────────────────────────────
router.post('/articles/save', authMiddleware, upload.fields([
  { name: 'featured_image', maxCount: 1 },
  { name: 'og_image', maxCount: 1 }
]), (req, res) => {
  const {
    id, title, slug, content, excerpt, category_id, status, publish_date,
    is_featured, is_trending, seo_title, seo_description, seo_keywords,
    reading_time, tags, featured_image_alt
  } = req.body;

  const slugify = require('slugify');
  let finalSlug = slug ? slugify(slug, { lower: true, strict: true }) : slugify(title, { lower: true, strict: true });

  // Ensure unique slug
  if (!id) {
    let counter = 0;
    let testSlug = finalSlug;
    while (db.prepare('SELECT id FROM articles WHERE slug = ?').get(testSlug)) {
      counter++;
      testSlug = finalSlug + '-' + counter;
    }
    finalSlug = testSlug;
  }

  const featuredImage = req.files?.featured_image?.[0]?.filename
    ? '/uploads/' + req.files.featured_image[0].filename
    : (req.body.existing_featured_image || null);

  const ogImage = req.files?.og_image?.[0]?.filename
    ? '/uploads/' + req.files.og_image[0].filename
    : (req.body.existing_og_image || featuredImage);

  // Calculate reading time
  const wordCount = (content || '').replace(/<[^>]+>/g, '').split(/\s+/).length;
  const calcReadingTime = Math.max(1, Math.ceil(wordCount / 200));

  const data = {
    title, slug: finalSlug, content, excerpt,
    author_id: req.admin.id,
    category_id: category_id || null,
    status: status || 'draft',
    publish_date: publish_date || null,
    is_featured: is_featured ? 1 : 0,
    is_trending: is_trending ? 1 : 0,
    featured_image: featuredImage,
    featured_image_alt: featured_image_alt || '',
    og_image: ogImage,
    seo_title: seo_title || title,
    seo_description, seo_keywords,
    reading_time: calcReadingTime,
  };

  let articleId = id;
  if (id) {
    db.prepare(`
      UPDATE articles SET title=?, slug=?, content=?, excerpt=?, category_id=?, status=?, publish_date=?,
      is_featured=?, is_trending=?, featured_image=?, featured_image_alt=?, og_image=?, seo_title=?,
      seo_description=?, seo_keywords=?, reading_time=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      data.title, data.slug, data.content, data.excerpt, data.category_id, data.status, data.publish_date,
      data.is_featured, data.is_trending, data.featured_image, data.featured_image_alt, data.og_image,
      data.seo_title, data.seo_description, data.seo_keywords, data.reading_time, id
    );
  } else {
    const result = db.prepare(`
      INSERT INTO articles (title, slug, content, excerpt, author_id, category_id, status, publish_date,
      is_featured, is_trending, featured_image, featured_image_alt, og_image, seo_title, seo_description,
      seo_keywords, reading_time, publish_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      data.title, data.slug, data.content, data.excerpt, data.author_id, data.category_id, data.status,
      data.publish_date, data.is_featured, data.is_trending, data.featured_image, data.featured_image_alt,
      data.og_image, data.seo_title, data.seo_description, data.seo_keywords, data.reading_time
    );
    articleId = result.lastInsertRowid;
  }

  // Update tags
  db.prepare('DELETE FROM article_tags WHERE article_id = ?').run(articleId);
  if (tags) {
    const tagList = Array.isArray(tags) ? tags : [tags];
    tagList.forEach(tagId => {
      if (tagId) db.prepare('INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)').run(articleId, tagId);
    });
  }

  // Update category article counts
  db.exec(`UPDATE categories SET article_count = (SELECT COUNT(*) FROM articles WHERE articles.category_id = categories.id AND articles.status = 'published')`);

  res.redirect('/admin/articles?saved=1');
});

// ─── Delete Article ───────────────────────────────────────────────────────────
router.post('/articles/:id/delete', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
  db.exec(`UPDATE categories SET article_count = (SELECT COUNT(*) FROM articles WHERE articles.category_id = categories.id AND articles.status = 'published')`);
  res.redirect('/admin/articles');
});

// ─── Bulk Actions ─────────────────────────────────────────────────────────────
router.post('/articles/bulk', authMiddleware, (req, res) => {
  const { ids, action } = req.body;
  if (!ids || !action) return res.redirect('/admin/articles');
  const idList = Array.isArray(ids) ? ids : [ids];
  if (action === 'delete') {
    idList.forEach(id => db.prepare('DELETE FROM articles WHERE id = ?').run(id));
  } else if (action === 'publish') {
    idList.forEach(id => db.prepare("UPDATE articles SET status='published', publish_date=CURRENT_TIMESTAMP WHERE id=?").run(id));
  } else if (action === 'draft') {
    idList.forEach(id => db.prepare("UPDATE articles SET status='draft' WHERE id=?").run(id));
  }
  db.exec(`UPDATE categories SET article_count = (SELECT COUNT(*) FROM articles WHERE articles.category_id = categories.id AND articles.status = 'published')`);
  res.redirect('/admin/articles');
});

// ─── Categories ───────────────────────────────────────────────────────────────
router.get('/categories', authMiddleware, (req, res) => {
  const settings = getAllSettings();
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.render('admin/categories', {
    categories, settings,
    title: 'Categories | Tax Clearance Admin',
    admin: req.admin,
    success: req.query.saved,
  });
});

router.post('/categories/save', authMiddleware, (req, res) => {
  const { id, name, slug, description, color, icon } = req.body;
  const slugify = require('slugify');
  const finalSlug = slug || slugify(name, { lower: true, strict: true });
  if (id) {
    db.prepare('UPDATE categories SET name=?, slug=?, description=?, color=?, icon=? WHERE id=?').run(name, finalSlug, description, color, icon, id);
  } else {
    db.prepare('INSERT INTO categories (name, slug, description, color, icon) VALUES (?, ?, ?, ?, ?)').run(name, finalSlug, description || '', color || '#6366f1', icon || '📋');
  }
  res.redirect('/admin/categories?saved=1');
});

router.post('/categories/:id/delete', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.redirect('/admin/categories');
});

// ─── Media Library ────────────────────────────────────────────────────────────
router.get('/media', authMiddleware, (req, res) => {
  const settings = getAllSettings();
  const media = db.prepare('SELECT * FROM media ORDER BY uploaded_at DESC').all();
  res.render('admin/media', { media, settings, title: 'Media | Tax Clearance Admin', admin: req.admin });
});

router.post('/media/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.json({ success: false, message: 'No file uploaded' });
  db.prepare('INSERT INTO media (filename, original_name, file_size, mime_type, uploaded_by) VALUES (?, ?, ?, ?, ?)')
    .run(req.file.filename, req.file.originalname, req.file.size, req.file.mimetype, req.admin.id);
  res.json({ success: true, url: '/uploads/' + req.file.filename, filename: req.file.filename });
});

router.post('/media/:id/delete', authMiddleware, (req, res) => {
  const media = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
  if (media) {
    const filePath = path.join(__dirname, '../public/uploads', media.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM media WHERE id = ?').run(req.params.id);
  }
  res.json({ success: true });
});

// ─── Leads / Consultations ────────────────────────────────────────────────────
router.get('/leads', authMiddleware, (req, res) => {
  const settings = getAllSettings();
  const leads = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
  // Mark new leads as viewed
  db.prepare("UPDATE leads SET status='viewed' WHERE status='new'").run();
  res.render('admin/leads', { leads, settings, title: 'Leads | Tax Clearance Admin', admin: req.admin });
});

// ─── Comments ─────────────────────────────────────────────────────────────────
router.get('/comments', authMiddleware, (req, res) => {
  const settings = getAllSettings();
  const comments = db.prepare(`
    SELECT cm.*, a.title as article_title, a.slug as article_slug
    FROM comments cm JOIN articles a ON cm.article_id = a.id
    ORDER BY cm.created_at DESC
  `).all();
  res.render('admin/comments', { comments, settings, title: 'Comments | Tax Clearance Admin', admin: req.admin });
});

router.post('/comments/:id/approve', authMiddleware, (req, res) => {
  db.prepare("UPDATE comments SET status='approved' WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

router.post('/comments/:id/delete', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM comments WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ─── Settings ─────────────────────────────────────────────────────────────────
router.get('/settings', authMiddleware, (req, res) => {
  const settings = getAllSettings();
  res.render('admin/settings', { settings, title: 'Settings | Tax Clearance Admin', admin: req.admin, success: req.query.saved });
});

router.post('/settings/save', authMiddleware, (req, res) => {
  const allowed = [
    'site_name', 'site_tagline', 'site_description', 'ea_name', 'ea_credentials',
    'ea_bio', 'ea_email', 'ea_phone', 'ea_calendly', 'google_analytics_id',
    'twitter_handle', 'facebook_url', 'linkedin_url', 'footer_text', 'articles_per_page'
  ];
  const update = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
  allowed.forEach(key => {
    if (req.body[key] !== undefined) update.run(key, req.body[key]);
  });
  res.redirect('/admin/settings?saved=1');
});

// ─── Change Password ───────────────────────────────────────────────────────────
router.post('/change-password', authMiddleware, (req, res) => {
  const { current_password, new_password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.admin.id);
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.redirect('/admin/settings?error=wrong_password');
  }
  const hash = bcrypt.hashSync(new_password, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.admin.id);
  res.clearCookie('admin_token');
  res.redirect('/admin/login?changed=1');
});

// ─── Tags ─────────────────────────────────────────────────────────────────────
router.get('/tags', authMiddleware, (req, res) => {
  const settings = getAllSettings();
  const tags = db.prepare('SELECT * FROM tags ORDER BY name').all();
  res.render('admin/tags', { tags, settings, title: 'Tags | Tax Clearance Admin', admin: req.admin });
});

router.post('/tags/save', authMiddleware, (req, res) => {
  const { name } = req.body;
  const slugify = require('slugify');
  const slug = slugify(name, { lower: true, strict: true });
  db.prepare('INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)').run(name, slug);
  res.json({ success: true });
});

router.post('/tags/:id/delete', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Newsletter ───────────────────────────────────────────────────────────────
router.get('/newsletter', authMiddleware, (req, res) => {
  const settings = getAllSettings();
  const subscribers = db.prepare('SELECT * FROM newsletter ORDER BY subscribed_at DESC').all();
  res.render('admin/newsletter', { subscribers, settings, title: 'Newsletter | Tax Clearance Admin', admin: req.admin });
});

// ─── Article Preview ──────────────────────────────────────────────────────────
router.get('/articles/:id/preview', authMiddleware, (req, res) => {
  const settings = getAllSettings();
  const article = db.prepare(`
    SELECT a.*, c.name as category_name, c.slug as category_slug, c.color as category_color,
           u.display_name as author_name, u.bio as author_bio
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN users u ON a.author_id = u.id
    WHERE a.id = ?
  `).get(req.params.id);
  if (!article) return res.redirect('/admin/articles');
  const categories = db.prepare('SELECT * FROM categories ORDER BY article_count DESC').all();
  res.render('article', {
    article, related: [], comments: [], tags: [], categories, settings,
    page: 'article', title: article.title + ' [PREVIEW]', description: article.excerpt,
    isPreview: true,
  });
});

module.exports = router;
