const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  db,
  getAllSettings,
  getSetting,
  clearSettingsCache,
  getCategories,
  clearCategoriesCache,
  getTotalArticles,
  clearArticlesCache
} = require('../database/db');
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

// ─── Login ───────────────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.cookies?.admin_token) {
    try { jwt.verify(req.cookies.admin_token, process.env.JWT_SECRET); return res.redirect('/admin'); } catch {}
  }
  res.render('admin/login', { error: null, changed: req.query.changed, title: 'Admin Login | Tax Clearance' });
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.render('admin/login', { error: 'Invalid username or password', title: 'Admin Login' });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('admin_token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.redirect('/admin');
  } catch (err) {
    next(err);
  }
});

router.get('/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.redirect('/admin/login');
});

// ─── Dashboard ───────────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const settings = await getAllSettings();
    const totalArticlesRow = await db.get(`SELECT COUNT(*) as cnt FROM articles`);
    const publishedRow = await db.get(`SELECT COUNT(*) as cnt FROM articles WHERE status='published'`);
    const draftsRow = await db.get(`SELECT COUNT(*) as cnt FROM articles WHERE status='draft'`);
    const scheduledRow = await db.get(`SELECT COUNT(*) as cnt FROM articles WHERE status='scheduled'`);
    const totalViewsRow = await db.get(`SELECT SUM(views) as total FROM articles`);
    const leadsRow = await db.get(`SELECT COUNT(*) as cnt FROM leads`);
    const newLeadsRow = await db.get(`SELECT COUNT(*) as cnt FROM leads WHERE status='new'`);
    const subscribersRow = await db.get(`SELECT COUNT(*) as cnt FROM newsletter WHERE status='active'`);
    const commentsRow = await db.get(`SELECT COUNT(*) as cnt FROM comments WHERE status='pending'`);

    const stats = {
      totalArticles: totalArticlesRow?.cnt || 0,
      published: publishedRow?.cnt || 0,
      drafts: draftsRow?.cnt || 0,
      scheduled: scheduledRow?.cnt || 0,
      totalViews: totalViewsRow?.total || 0,
      leads: leadsRow?.cnt || 0,
      newLeads: newLeadsRow?.cnt || 0,
      subscribers: subscribersRow?.cnt || 0,
      comments: commentsRow?.cnt || 0,
    };

    const recentArticles = await db.all(`
      SELECT a.*, c.name as category_name, c.color as category_color
      FROM articles a LEFT JOIN categories c ON a.category_id = c.id
      ORDER BY a.updated_at DESC LIMIT 8
    `);
    const recentLeads = await db.all(`SELECT * FROM leads ORDER BY created_at DESC LIMIT 5`);
    const topArticles = await db.all(`SELECT id, title, slug, views FROM articles WHERE status='published' ORDER BY views DESC LIMIT 5`);
    const categories = await getCategories();

    res.render('admin/dashboard', {
      stats, recentArticles, recentLeads, topArticles, categories, settings,
      title: 'Dashboard | Tax Clearance Admin',
      admin: req.admin,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Articles List ────────────────────────────────────────────────────────────
router.get('/articles', authMiddleware, async (req, res, next) => {
  try {
    const settings = await getAllSettings();
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

    const articles = await db.all(`
      SELECT a.*, c.name as category_name, c.color as category_color
      FROM articles a LEFT JOIN categories c ON a.category_id = c.id
      WHERE ${where}
      ORDER BY a.updated_at DESC LIMIT ? OFFSET ?
    `, [...params, perPage, offset]);

    const totalRow = await db.get(`
      SELECT COUNT(*) as cnt FROM articles a LEFT JOIN categories c ON a.category_id = c.id WHERE ${where}
    `, params);
    const total = totalRow?.cnt || 0;

    const categories = await getCategories();

    res.render('admin/articles', {
      articles, categories, settings, total,
      currentPage: page, totalPages: Math.ceil(total / perPage),
      filters: { status, category, search },
      saved: req.query.saved,
      title: 'Articles | Tax Clearance Admin',
      admin: req.admin,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Article Editor (new) ─────────────────────────────────────────────────────
router.get('/articles/new', authMiddleware, async (req, res, next) => {
  try {
    const settings = await getAllSettings();
    const rawCategories = await getCategories();
    const categories = [...rawCategories].sort((a, b) => a.name.localeCompare(b.name));
    const tags = await db.all('SELECT * FROM tags ORDER BY name');
    const allArticles = await db.all("SELECT id, title, slug FROM articles WHERE status='published' ORDER BY title");
    res.render('admin/editor', {
      article: null, categories, tags, allArticles, settings,
      title: 'New Article | Tax Clearance Admin',
      admin: req.admin,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Article Editor (edit) ────────────────────────────────────────────────────
router.get('/articles/:id/edit', authMiddleware, async (req, res, next) => {
  try {
    const settings = await getAllSettings();
    const article = await db.get('SELECT * FROM articles WHERE id = ?', [req.params.id]);
    if (!article) return res.redirect('/admin/articles');
    const rawCategories = await getCategories();
    const categories = [...rawCategories].sort((a, b) => a.name.localeCompare(b.name));
    const tags = await db.all('SELECT * FROM tags ORDER BY name');
    const articleTagsRows = await db.all(`SELECT tag_id FROM article_tags WHERE article_id = ?`, [article.id]);
    const articleTags = articleTagsRows.map(r => r.tag_id);
    const allArticles = await db.all("SELECT id, title, slug FROM articles WHERE status='published' AND id != ? ORDER BY title", [article.id]);
    res.render('admin/editor', {
      article: { ...article, selectedTags: articleTags }, categories, tags, allArticles, settings,
      title: `Edit: ${article.title} | Admin`,
      admin: req.admin,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Save Article ─────────────────────────────────────────────────────────────
router.post('/articles/save', authMiddleware, upload.fields([
  { name: 'featured_image', maxCount: 1 },
  { name: 'og_image', maxCount: 1 }
]), async (req, res, next) => {
  try {
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
      while (await db.get('SELECT id FROM articles WHERE slug = ?', [testSlug])) {
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
      await db.run(`
        UPDATE articles SET title=?, slug=?, content=?, excerpt=?, category_id=?, status=?, publish_date=?,
        is_featured=?, is_trending=?, featured_image=?, featured_image_alt=?, og_image=?, seo_title=?,
        seo_description=?, seo_keywords=?, reading_time=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `, [
        data.title, data.slug, data.content, data.excerpt, data.category_id, data.status, data.publish_date,
        data.is_featured, data.is_trending, data.featured_image, data.featured_image_alt, data.og_image,
        data.seo_title, data.seo_description, data.seo_keywords, data.reading_time, id
      ]);
    } else {
      const result = await db.run(`
        INSERT INTO articles (title, slug, content, excerpt, author_id, category_id, status, publish_date,
        is_featured, is_trending, featured_image, featured_image_alt, og_image, seo_title, seo_description,
        seo_keywords, reading_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        data.title, data.slug, data.content, data.excerpt, data.author_id, data.category_id, data.status,
        data.publish_date, data.is_featured, data.is_trending, data.featured_image, data.featured_image_alt,
        data.og_image, data.seo_title, data.seo_description, data.seo_keywords, data.reading_time
      ]);
      articleId = result.lastInsertRowid;
    }

    // Update tags
    await db.run('DELETE FROM article_tags WHERE article_id = ?', [articleId]);
    if (tags) {
      const tagList = Array.isArray(tags) ? tags : [tags];
      for (const tagId of tagList) {
        if (tagId) {
          await db.run('INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)', [articleId, tagId]);
        }
      }
    }

    // Update category article counts
    await db.exec(`UPDATE categories SET article_count = (SELECT COUNT(*) FROM articles WHERE articles.category_id = categories.id AND articles.status = 'published')`);
    
    // Invalidate caches
    clearArticlesCache();
    clearCategoriesCache();

    res.redirect('/admin/articles?saved=1');
  } catch (err) {
    next(err);
  }
});

// ─── Delete Article ───────────────────────────────────────────────────────────
router.post('/articles/:id/delete', authMiddleware, async (req, res, next) => {
  try {
    await db.run('DELETE FROM articles WHERE id = ?', [req.params.id]);
    await db.exec(`UPDATE categories SET article_count = (SELECT COUNT(*) FROM articles WHERE articles.category_id = categories.id AND articles.status = 'published')`);
    
    // Invalidate caches
    clearArticlesCache();
    clearCategoriesCache();

    res.redirect('/admin/articles');
  } catch (err) {
    next(err);
  }
});

// ─── Bulk Actions ─────────────────────────────────────────────────────────────
router.post('/articles/bulk', authMiddleware, async (req, res, next) => {
  try {
    const { ids, action } = req.body;
    if (!ids || !action) return res.redirect('/admin/articles');
    const idList = Array.isArray(ids) ? ids : [ids];
    if (action === 'delete') {
      for (const id of idList) {
        await db.run('DELETE FROM articles WHERE id = ?', [id]);
      }
    } else if (action === 'publish') {
      for (const id of idList) {
        await db.run("UPDATE articles SET status='published', publish_date=CURRENT_TIMESTAMP WHERE id=?", [id]);
      }
    } else if (action === 'draft') {
      for (const id of idList) {
        await db.run("UPDATE articles SET status='draft' WHERE id=?", [id]);
      }
    }
    await db.exec(`UPDATE categories SET article_count = (SELECT COUNT(*) FROM articles WHERE articles.category_id = categories.id AND articles.status = 'published')`);
    
    // Invalidate caches
    clearArticlesCache();
    clearCategoriesCache();

    res.redirect('/admin/articles');
  } catch (err) {
    next(err);
  }
});

// ─── Categories ───────────────────────────────────────────────────────────────
router.get('/categories', authMiddleware, async (req, res, next) => {
  try {
    const settings = await getAllSettings();
    const rawCategories = await getCategories();
    const categories = [...rawCategories].sort((a, b) => a.name.localeCompare(b.name));
    res.render('admin/categories', {
      categories, settings,
      title: 'Categories | Tax Clearance Admin',
      admin: req.admin,
      success: req.query.saved,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/categories/save', authMiddleware, async (req, res, next) => {
  try {
    const { id, name, slug, description, color, icon } = req.body;
    const slugify = require('slugify');
    let finalSlug = slug || slugify(name, { lower: true, strict: true });
    if (!id) {
      let counter = 0;
      let testSlug = finalSlug;
      while (await db.get('SELECT id FROM categories WHERE slug = ?', [testSlug])) {
        counter++;
        testSlug = finalSlug + '-' + counter;
      }
      finalSlug = testSlug;
    }
    if (id) {
      await db.run('UPDATE categories SET name=?, slug=?, description=?, color=?, icon=? WHERE id=?', [name, finalSlug, description, color, icon, id]);
    } else {
      await db.run('INSERT INTO categories (name, slug, description, color, icon) VALUES (?, ?, ?, ?, ?)', [name, finalSlug, description || '', color || '#6366f1', icon || '📋']);
    }
    
    // Invalidate categories cache
    clearCategoriesCache();

    res.redirect('/admin/categories?saved=1');
  } catch (err) {
    next(err);
  }
});

router.post('/categories/:id/delete', authMiddleware, async (req, res, next) => {
  try {
    await db.run('DELETE FROM categories WHERE id = ?', [req.params.id]);
    
    // Invalidate categories cache
    clearCategoriesCache();

    res.redirect('/admin/categories');
  } catch (err) {
    next(err);
  }
});

// ─── Media Library ────────────────────────────────────────────────────────────
router.get('/media', authMiddleware, async (req, res, next) => {
  try {
    const settings = await getAllSettings();
    const media = await db.all('SELECT * FROM media ORDER BY uploaded_at DESC');
    res.render('admin/media', { media, settings, title: 'Media | Tax Clearance Admin', admin: req.admin });
  } catch (err) {
    next(err);
  }
});

router.post('/media/upload', authMiddleware, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.json({ success: false, message: 'No file uploaded' });
    await db.run('INSERT INTO media (filename, original_name, file_size, mime_type, uploaded_by) VALUES (?, ?, ?, ?, ?)',
      [req.file.filename, req.file.originalname, req.file.size, req.file.mimetype, req.admin.id]);
    res.json({ success: true, url: '/uploads/' + req.file.filename, filename: req.file.filename });
  } catch (err) {
    next(err);
  }
});

router.post('/media/:id/delete', authMiddleware, async (req, res, next) => {
  try {
    const media = await db.get('SELECT * FROM media WHERE id = ?', [req.params.id]);
    if (media) {
      const filePath = path.join(__dirname, '../public/uploads', media.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await db.run('DELETE FROM media WHERE id = ?', [req.params.id]);
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Leads / Consultations ────────────────────────────────────────────────────
router.get('/leads', authMiddleware, async (req, res, next) => {
  try {
    const settings = await getAllSettings();
    const leads = await db.all('SELECT * FROM leads ORDER BY created_at DESC');
    // Mark new leads as viewed
    await db.run("UPDATE leads SET status='viewed' WHERE status='new'");
    res.render('admin/leads', { leads, settings, title: 'Leads | Tax Clearance Admin', admin: req.admin });
  } catch (err) {
    next(err);
  }
});

// ─── Comments ─────────────────────────────────────────────────────────────────
router.get('/comments', authMiddleware, async (req, res, next) => {
  try {
    const settings = await getAllSettings();
    const comments = await db.all(`
      SELECT cm.*, a.title as article_title, a.slug as article_slug
      FROM comments cm JOIN articles a ON cm.article_id = a.id
      ORDER BY cm.created_at DESC
    `);
    res.render('admin/comments', { comments, settings, title: 'Comments | Tax Clearance Admin', admin: req.admin });
  } catch (err) {
    next(err);
  }
});

router.post('/comments/:id/approve', authMiddleware, async (req, res, next) => {
  try {
    await db.run("UPDATE comments SET status='approved' WHERE id=?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/comments/:id/delete', authMiddleware, async (req, res, next) => {
  try {
    await db.run('DELETE FROM comments WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Settings ─────────────────────────────────────────────────────────────────
router.get('/settings', authMiddleware, async (req, res, next) => {
  try {
    const settings = await getAllSettings();
    res.render('admin/settings', { settings, title: 'Settings | Tax Clearance Admin', admin: req.admin, success: req.query.saved });
  } catch (err) {
    next(err);
  }
});

router.post('/settings/save', authMiddleware, async (req, res, next) => {
  try {
    const allowed = [
      'site_name', 'site_tagline', 'site_description', 'ea_name', 'ea_credentials',
      'ea_bio', 'ea_email', 'ea_phone', 'ea_calendly', 'google_analytics_id',
      'twitter_handle', 'facebook_url', 'linkedin_url', 'footer_text', 'articles_per_page'
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        await db.run('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)', [key, req.body[key]]);
      }
    }
    
    // Invalidate settings cache
    clearSettingsCache();

    res.redirect('/admin/settings?saved=1');
  } catch (err) {
    next(err);
  }
});

// ─── Change Password ───────────────────────────────────────────────────────────
router.post('/change-password', authMiddleware, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.admin.id]);
    if (!bcrypt.compareSync(current_password, user.password_hash)) {
      return res.redirect('/admin/settings?error=wrong_password');
    }
    const hash = bcrypt.hashSync(new_password, 12);
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.admin.id]);
    res.clearCookie('admin_token');
    res.redirect('/admin/login?changed=1');
  } catch (err) {
    next(err);
  }
});

// ─── Tags ─────────────────────────────────────────────────────────────────────
router.get('/tags', authMiddleware, async (req, res, next) => {
  try {
    const settings = await getAllSettings();
    const tags = await db.all('SELECT * FROM tags ORDER BY name');
    res.render('admin/tags', { tags, settings, title: 'Tags | Tax Clearance Admin', admin: req.admin });
  } catch (err) {
    next(err);
  }
});

router.post('/tags/save', authMiddleware, async (req, res, next) => {
  try {
    const { name } = req.body;
    const slugify = require('slugify');
    const slug = slugify(name, { lower: true, strict: true });
    await db.run('INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)', [name, slug]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/tags/:id/delete', authMiddleware, async (req, res, next) => {
  try {
    await db.run('DELETE FROM tags WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Newsletter ───────────────────────────────────────────────────────────────
router.get('/newsletter', authMiddleware, async (req, res, next) => {
  try {
    const settings = await getAllSettings();
    const subscribers = await db.all('SELECT * FROM newsletter ORDER BY subscribed_at DESC');
    res.render('admin/newsletter', { subscribers, settings, title: 'Newsletter | Tax Clearance Admin', admin: req.admin });
  } catch (err) {
    next(err);
  }
});

// ─── Article Preview ──────────────────────────────────────────────────────────
router.get('/articles/:id/preview', authMiddleware, async (req, res, next) => {
  try {
    const settings = await getAllSettings();
    const article = await db.get(`
      SELECT a.*, c.name as category_name, c.slug as category_slug, c.color as category_color,
             u.display_name as author_name, u.bio as author_bio
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.id = ?
    `, [req.params.id]);
    if (!article) return res.redirect('/admin/articles');
    const categories = await getCategories();
    res.render('article', {
      article, related: [], comments: [], tags: [], categories, settings,
      page: 'article', title: article.title + ' [PREVIEW]', description: article.excerpt,
      isPreview: true,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/fix-images', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const dataPath = path.join(__dirname, '../articles_data.json');
    if (!fs.existsSync(dataPath)) return res.send('No data file');
    const articlesData = JSON.parse(fs.readFileSync(dataPath));
    for (const art of articlesData) {
      if (art.img) {
        const imgPath = '/img/articles/' + art.img;
        await db.run("UPDATE articles SET featured_image = ?, og_image = ? WHERE slug = ?", [imgPath, imgPath, art.slug]);
      }
    }
    const { clearArticlesCache } = require('../database/db');
    clearArticlesCache();
    res.send('Fixed images successfully!');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
