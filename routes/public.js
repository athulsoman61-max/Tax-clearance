const express = require('express');
const router = express.Router();
const { db, getAllSettings, getSetting, getCategories, getTotalArticles } = require('../database/db');

// Temp route to add OBBBA article
router.get('/temp-add-obbba-article', async (req, res, next) => {
  try {
    const title = 'One Big Beautiful Bill Explained: 10 Tax Changes Every Taxpayer Should Understand in 2026';
    const slug = 'one-big-beautiful-bill-explained-2026';
    const excerpt = 'The One Big Beautiful Bill Act (OBBBA) is one of the most significant U.S. tax laws enacted since the 2017 Tax Cuts and Jobs Act (TCJA). Here is what you need to know.';
    const content = `
## Introduction

The **One Big Beautiful Bill Act (OBBBA)** is one of the most significant U.S. tax laws enacted since the 2017 Tax Cuts and Jobs Act (TCJA). Signed into law on **July 4, 2025**, it permanently extends many TCJA provisions while introducing several new deductions, modifying tax credits, changing business tax rules, and phasing out numerous clean energy incentives.

For taxpayers, business owners, and tax professionals, understanding these changes is essential for effective tax planning. Some provisions applied beginning with the **2025 tax year**, while others became effective in **2026 and later**.

This guide highlights the ten most important tax changes and explains what they could mean for you.

---

# 1. TCJA Individual Tax Rates Are Now Permanent

One of the law's biggest changes is the permanent extension of the individual income tax brackets created by the Tax Cuts and Jobs Act.

Without new legislation, those lower tax rates were scheduled to expire. Instead, Congress made them permanent, giving taxpayers greater certainty for long-term planning.

**Planning Tip:** Individuals considering Roth conversions, retirement withdrawals, or investment sales can now make decisions without the immediate concern of expiring tax brackets.

---

# 2. Higher Standard Deduction Continues

The law permanently preserves the increased standard deduction introduced under the TCJA and incorporates annual inflation adjustments.

Because of the larger deduction, many taxpayers will continue claiming the standard deduction rather than itemizing.

**Example**

A married couple with moderate mortgage interest and charitable contributions may still receive a larger deduction by using the standard deduction instead of itemizing.

---

# 3. SALT Deduction Increased

One of the most discussed provisions is the increase in the **State and Local Tax (SALT) deduction limitation**.

For many taxpayers, the deduction cap increased substantially compared with the previous $10,000 limitation, although income-based phaseouts and future adjustments may apply depending on the tax year.

This change primarily benefits taxpayers living in high-tax states.

---

# 4. New Deduction for Qualified Tips

The Act introduced a temporary deduction allowing eligible workers to deduct certain qualified tip income.

Industries likely to benefit include:

* Restaurants
* Hospitality
* Food service
* Personal services

The deduction is subject to statutory eligibility requirements, income limitations, and IRS guidance.

---

# 5. Deduction for Qualified Overtime Pay

Eligible taxpayers may also claim a deduction for qualified overtime compensation.

Unlike an exclusion from income, this generally operates as a deduction subject to the requirements established by Congress and subsequent IRS guidance.

Workers should retain:

* Payroll records
* Form W-2
* Employer documentation

---

# 6. Senior Deduction Expanded

Older taxpayers received an additional deduction under the legislation.

The new deduction is designed to provide tax relief for qualifying seniors while maintaining existing Social Security taxation rules.

Taxpayers should review applicable income limitations before assuming eligibility.

---

# 7. Trump Accounts Introduced

The Act created **Trump Accounts**, new tax-advantaged savings accounts intended to encourage long-term savings for eligible children.

Recent IRS guidance also established a safe harbor that reduces gift tax reporting requirements for many qualifying contributions.

Families considering these accounts should understand:

* Eligibility requirements
* Contribution limits
* Distribution rules
* Investment options
* Gift tax implications

---

# 8. Business Tax Incentives Expanded

Businesses received several favorable provisions, including permanent or expanded incentives related to:

* Bonus depreciation
* Domestic research and experimental expenditures
* Interest limitation rules
* Capital investment

Many of these provisions are intended to encourage long-term investment and economic growth.

Small businesses should consult their tax advisors before making significant purchasing decisions.

---

# 9. Estate and Gift Tax Exemption Increased

The legislation permanently increases the federal estate and gift tax exemption, indexed for inflation.

Although relatively few taxpayers owe federal estate tax, the higher exemption provides additional planning opportunities for high-net-worth families.

Estate plans, trusts, and gifting strategies should be reviewed periodically to reflect the updated exemption amounts.

---

# 10. Clean Energy Tax Credits Narrowed

Several clean energy incentives enacted under prior law were modified, phased out, or repealed.

Affected areas include certain:

* Electric vehicle credits
* Residential energy credits
* Commercial clean energy incentives

Taxpayers considering major energy-related purchases should verify whether a credit is still available before completing a transaction.

---

# What This Means for Taxpayers

The One Big Beautiful Bill provides both opportunities and responsibilities.

**Individuals may benefit from:**

* Lower permanent tax rates
* Higher deductions
* New deductions for qualified tips and overtime
* Additional relief for seniors
* Expanded family savings opportunities

**Businesses may benefit from:**

* Increased investment incentives
* Expanded depreciation opportunities
* Improved research expense treatment
* Greater certainty for long-term planning

At the same time, taxpayers should be aware that some provisions are temporary, while others require detailed IRS guidance before they can be fully applied.

---

# Planning Checklist

Before filing your next return, consider the following:

* Review whether itemizing or taking the standard deduction produces the best result.
* Determine whether you qualify for the new deductions for tips or overtime.
* Reevaluate estimated tax payments if your taxable income changes.
* Review estate planning documents if higher exemption amounts affect your strategy.
* Confirm eligibility before claiming clean energy credits.
* Stay current with IRS guidance implementing the new law.

---

# Frequently Asked Questions

### Does every provision begin in the same tax year?

No. Some provisions apply beginning with the 2025 tax year, while others became effective in 2026 or later.

### Are all provisions permanent?

No. The Act contains both permanent and temporary provisions. Taxpayers should verify the effective dates and expiration rules for each benefit.

### Will the IRS issue additional guidance?

Yes. The IRS continues to release regulations, notices, revenue procedures, FAQs, and tax tips explaining how taxpayers should apply various provisions.

---

# Final Thoughts

The One Big Beautiful Bill represents a comprehensive overhaul of numerous areas of the Internal Revenue Code. While many taxpayers will experience lower taxes or expanded deductions, the law also introduces new compliance requirements and planning considerations.

Because implementation continues through IRS guidance, taxpayers and practitioners should monitor future announcements rather than relying solely on the statutory language. Understanding how each provision applies to your individual circumstances is the best way to maximize available tax benefits while remaining compliant.

---

## Sources

**Primary Sources**

1. IRS – One Big Beautiful Bill Provisions.
2. IRS – One Big Beautiful Bill: Individuals and Workers.
3. IRS Tax Tips on OBBB implementation.
4. Public Law 119-21 (One Big Beautiful Bill Act).

**Additional References**

* Tax Foundation – Analysis of the One Big Beautiful Bill Act.
* Grant Thornton – OBBB U.S. Tax Legislative Overview.
* H&R Block – OBBB Tax Law Summary (for practical illustrations).
`;
    const featured_image = '/images/obbba_tax_bill.png';
    const status = 'published';
    const reading_time = 7;
    const publish_date = new Date().toISOString();
    const adminUser = await db.get("SELECT id FROM users LIMIT 1");
    const author_id = adminUser ? adminUser.id : null;

    const firstCat = await db.get("SELECT id FROM categories LIMIT 1");
    const category_id = firstCat ? firstCat.id : null;

    await db.run(
      "INSERT INTO articles (title, slug, excerpt, content, featured_image, status, reading_time, publish_date, category_id, author_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [title, slug, excerpt, content, featured_image, status, reading_time, publish_date, category_id, author_id]
    );
    res.send("Article added successfully");
  } catch (err) {
    next(err);
  }
});

// Homepage
router.get('/', async (req, res, next) => {
  try {
    const settings = await getAllSettings();
    const perPage = parseInt(settings.articles_per_page) || 10;

    const [articles, trending, irsUpdates, featured, categories, totalArticles, recentQuestions] = await Promise.all([
      db.all(`
        SELECT a.*, c.name as category_name, c.slug as category_slug, c.color as category_color, c.icon as category_icon,
               u.display_name as author_name
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.status = 'published' AND (a.publish_date IS NULL OR a.publish_date <= CURRENT_TIMESTAMP)
      ORDER BY a.publish_date DESC, a.created_at DESC
      LIMIT ?
    `, [perPage]),
      db.all(`
        SELECT a.id, a.title, a.slug, a.excerpt, a.featured_image, a.views, a.reading_time, a.publish_date,
               c.name as category_name, c.slug as category_slug, c.color as category_color
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.status = 'published'
      ORDER BY a.views DESC LIMIT 5
    `),
      db.all(`
        SELECT a.id, a.title, a.slug, a.excerpt, a.publish_date
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.status = 'published' AND c.slug = 'irs-updates'
      ORDER BY a.publish_date DESC LIMIT 4
    `),
      db.get(`
        SELECT a.*, c.name as category_name, c.slug as category_slug, c.color as category_color
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.status = 'published' AND a.is_featured = 1
      ORDER BY a.publish_date DESC LIMIT 1
    `),
      getCategories(),
      getTotalArticles(),
      db.all(`
        SELECT q.id, q.title, q.description, q.views, q.created_at, q.status,
               c.name as category_name, c.color as category_color,
               u.display_name as author_name, u.avatar,
               (SELECT COUNT(*) FROM answers WHERE question_id = q.id) as answer_count
        FROM questions q
        LEFT JOIN categories c ON q.category_id = c.id
        LEFT JOIN users u ON q.user_id = u.id
        ORDER BY q.created_at DESC
        LIMIT 5
      `)
    ]);

    res.render('home', {
      articles,
      trending,
      irsUpdates,
      featured,
      categories,
      totalArticles,
      recentQuestions,
      hasMore: totalArticles > perPage,
      settings,
      page: 'home',
      title: `${settings.site_name} — ${settings.site_tagline}`,
      description: settings.site_description,
    });
  } catch (err) {
    next(err);
  }
});

// Article page
router.get('/article/:slug', async (req, res, next) => {
  try {
    const settings = await getAllSettings();
    const article = await db.get(`
      SELECT a.*, c.name as category_name, c.slug as category_slug, c.color as category_color, c.icon as category_icon,
             u.display_name as author_name, u.bio as author_bio, u.avatar as author_avatar
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.slug = ? AND a.status = 'published'
    `, [req.params.slug]);

    if (!article) return res.status(404).render('404', { settings, title: 'Page Not Found', description: '' });

    // Increment views
    const viewUpdatePromise = db.run('UPDATE articles SET views = views + 1 WHERE id = ?', [article.id]);

    const [related, comments, tags, categories, relatedQuestions] = await Promise.all([
      db.all(`
        SELECT a.id, a.title, a.slug, a.excerpt, a.featured_image, a.reading_time, a.publish_date,
               c.name as category_name, c.slug as category_slug, c.color as category_color
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.status = 'published' AND a.category_id = ? AND a.id != ?
      ORDER BY a.views DESC LIMIT 3
    `, [article.category_id, article.id]),
      db.all(`
        SELECT * FROM comments WHERE article_id = ? AND status = 'approved' ORDER BY created_at DESC
    `, [article.id]),
      db.all(`
        SELECT t.name, t.slug FROM tags t
      JOIN article_tags at ON t.id = at.tag_id
      WHERE at.article_id = ?
    `, [article.id]),
      getCategories(),
      db.all(`
        SELECT q.id, q.title, q.description, q.views, q.created_at, q.status,
               c.name as category_name, c.color as category_color,
               u.display_name as author_name, u.avatar,
               (SELECT COUNT(*) FROM answers WHERE question_id = q.id) as answer_count
        FROM questions q
        LEFT JOIN categories c ON q.category_id = c.id
        LEFT JOIN users u ON q.user_id = u.id
        WHERE q.category_id = ?
        ORDER BY q.created_at DESC
        LIMIT 3
      `, [article.category_id]),
      viewUpdatePromise
    ]);

    res.render('article', {
      article,
      related,
      relatedQuestions,
      comments,
      tags,
      categories,
      settings,
      page: 'article',
      query: req.query,
      title: article.seo_title || `${article.title} | ${settings.site_name}`,
      description: article.seo_description || article.excerpt,
    });
  } catch (err) {
    next(err);
  }
});

// Category page
router.get('/category/:slug', async (req, res, next) => {
  try {
    const settings = await getAllSettings();
    const category = await db.get('SELECT * FROM categories WHERE slug = ?', [req.params.slug]);
    if (!category) return res.status(404).render('404', { settings, title: 'Category Not Found', description: '' });

    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(settings.articles_per_page) || 10;
    const offset = (page - 1) * perPage;

    const [articles, totalRow, categories] = await Promise.all([
      db.all(`
        SELECT a.*, c.name as category_name, c.slug as category_slug, c.color as category_color, c.icon as category_icon,
               u.display_name as author_name
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.status = 'published' AND a.category_id = ?
      ORDER BY a.publish_date DESC, a.created_at DESC
      LIMIT ? OFFSET ?
    `, [category.id, perPage, offset]),
      db.get('SELECT COUNT(*) as cnt FROM articles WHERE status = ? AND category_id = ?', ['published', category.id]),
      getCategories()
    ]);

    const total = totalRow?.cnt || 0;

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
  } catch (err) {
    next(err);
  }
});

// Search
router.get('/search', async (req, res, next) => {
  try {
    const settings = await getAllSettings();
    const q = (req.query.q || '').trim();
    const categories = await getCategories();

    let results = [];
    if (q.length >= 2) {
      results = await db.all(`
        SELECT a.*, c.name as category_name, c.slug as category_slug, c.color as category_color,
               u.display_name as author_name
        FROM articles a
        LEFT JOIN categories c ON a.category_id = c.id
        LEFT JOIN users u ON a.author_id = u.id
        WHERE a.status = 'published' AND (
          a.title LIKE ? OR a.content LIKE ? OR a.excerpt LIKE ? OR a.seo_keywords LIKE ?
        )
        ORDER BY a.views DESC LIMIT 30
      `, [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]);
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
  } catch (err) {
    next(err);
  }
});

// About page
router.get('/about', async (req, res, next) => {
  try {
    const [settings, categories, articlesCount, categoriesCount, readersCount] = await Promise.all([
      getAllSettings(),
      getCategories(),
      getTotalArticles(),
      db.get('SELECT COUNT(*) as cnt FROM categories'),
      db.get('SELECT SUM(views) as total FROM articles')
    ]);

    const stats = {
      articles: articlesCount,
      categories: categoriesCount?.cnt || 0,
      readers: readersCount?.total || 0,
    };

    res.render('about', {
      settings,
      categories,
      stats,
      page: 'about',
      title: `About ${settings.ea_name} | ${settings.site_name}`,
      description: settings.ea_bio,
    });
  } catch (err) {
    next(err);
  }
});

// Contact page
router.get('/contact', async (req, res, next) => {
  try {
    const [settings, categories] = await Promise.all([
      getAllSettings(),
      getCategories()
    ]);
    res.render('contact', {
      settings,
      categories,
      page: 'contact',
      title: `Contact & Consultation | ${settings.site_name}`,
      description: `Schedule a consultation with ${settings.ea_name}, an Enrolled Agent. Get professional tax help today.`,
      success: req.query.success,
    });
  } catch (err) {
    next(err);
  }
});

// Post comment
router.post('/article/:slug/comment', async (req, res, next) => {
  try {
    const { name, email, content } = req.body;
    const article = await db.get('SELECT id FROM articles WHERE slug = ? AND status = ?', [req.params.slug, 'published']);
    if (!article || !name || !email || !content) return res.redirect(`/article/${req.params.slug}#comments`);
    await db.run('INSERT INTO comments (article_id, author_name, author_email, content) VALUES (?, ?, ?, ?)', [article.id, name, email, content]);
    res.redirect(`/article/${req.params.slug}?commented=1#comments`);
  } catch (err) {
    next(err);
  }
});

// Newsletter signup
router.post('/newsletter', async (req, res, next) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.json({ success: false, message: 'Email required' });
    await db.run('INSERT OR IGNORE INTO newsletter (email, name) VALUES (?, ?)', [email, name || '']);
    return res.json({ success: true, message: 'Thank you for subscribing!' });
  } catch (e) {
    return res.json({ success: false, message: 'Already subscribed.' });
  }
});

// Contact form
router.post('/contact', async (req, res, next) => {
  try {
    const { name, email, phone, service_type, message, preferred_date } = req.body;
    if (!name || !email || !message) return res.redirect('/contact?error=1');
    await db.run('INSERT INTO leads (name, email, phone, service_type, message, preferred_date) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, phone || '', service_type || '', message, preferred_date || '']);
    res.redirect('/contact?success=1');
  } catch (err) {
    next(err);
  }
});

// Sitemap
router.get('/sitemap.xml', async (req, res, next) => {
  try {
    const [settings, articles, categories] = await Promise.all([
      getAllSettings(),
      db.all(`SELECT slug, updated_at FROM articles WHERE status = 'published' ORDER BY updated_at DESC`),
      getCategories()
    ]);
    const siteUrl = process.env.SITE_URL || (req.protocol + '://' + req.get('host'));

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
  } catch (err) {
    next(err);
  }
});

// Robots.txt
router.get('/robots.txt', (req, res) => {
  const siteUrl = process.env.SITE_URL || (req.protocol + '://' + req.get('host'));
  res.set('Content-Type', 'text/plain');
  res.send(`User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${siteUrl}/sitemap.xml\n`);
});


// All Articles Route
router.get('/articles', async (req, res, next) => {
  try {
    const settings = await getAllSettings();
    const categories = await getCategories();
    
    const pageNum = parseInt(req.query.page) || 1;
    const limit = 12;
    const offset = (pageNum - 1) * limit;

    const articles = await db.all(`
      SELECT a.id, a.title, a.slug, a.excerpt, a.featured_image, a.publish_date, a.created_at,
             c.name as category_name, c.slug as category_slug, c.color as category_color,
             u.display_name as author_name
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.status = 'published' AND (a.publish_date IS NULL OR a.publish_date <= CURRENT_TIMESTAMP)
      ORDER BY a.publish_date DESC, a.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    
    const countRow = await db.get(`SELECT COUNT(*) as count FROM articles WHERE status = 'published' AND (publish_date IS NULL OR publish_date <= CURRENT_TIMESTAMP)`);
    const totalArticles = countRow.count;
    const totalPages = Math.ceil(totalArticles / limit);

    res.render('category', {
      category: { name: 'All Articles', slug: 'articles', description: 'Browse all our latest tax and finance articles.', color: '#6366f1', icon: '📚' },
      articles,
      total: totalArticles,
      categories,
      settings,
      page: 'articles',
      title: `All Articles | ${settings.site_name}`,
      description: 'Browse all tax and finance articles on TaxClearance.',
      currentPage: pageNum,
      totalPages,
      hasMore: pageNum < totalPages
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
