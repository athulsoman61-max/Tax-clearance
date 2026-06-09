const { db } = require('./db-turso');
const bcrypt = require('bcryptjs');

async function initializeDatabase() {
  // Create tables one by one (Turso handles them individually)
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      bio TEXT,
      avatar TEXT,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#6366f1',
      icon TEXT DEFAULT '📋',
      article_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      content TEXT,
      excerpt TEXT,
      featured_image TEXT,
      featured_image_alt TEXT,
      author_id INTEGER NOT NULL,
      category_id INTEGER,
      status TEXT DEFAULT 'draft',
      publish_date DATETIME,
      views INTEGER DEFAULT 0,
      reading_time INTEGER DEFAULT 0,
      is_featured INTEGER DEFAULT 0,
      is_trending INTEGER DEFAULT 0,
      seo_title TEXT,
      seo_description TEXT,
      seo_keywords TEXT,
      og_image TEXT,
      schema_markup TEXT,
      canonical_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )`,
    `CREATE TABLE IF NOT EXISTS article_tags (
      article_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (article_id, tag_id),
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      author_name TEXT NOT NULL,
      author_email TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS newsletter (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'active'
    )`,
    `CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      service_type TEXT,
      message TEXT,
      preferred_date TEXT,
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      alt_text TEXT,
      uploaded_by INTEGER,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status)`,
    `CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id)`,
    `CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug)`,
    `CREATE INDEX IF NOT EXISTS idx_comments_article ON comments(article_id)`,
  ];

  for (const sql of tables) {
    await db.run(sql);
  }

  // Seed admin user
  const adminExists = await db.get('SELECT id FROM users WHERE username = ?', ['admin']);
  if (!adminExists) {
    const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'TaxClearance2024!', 12);
    await db.run(
      `INSERT INTO users (username, email, password_hash, display_name, role, bio) VALUES (?, ?, ?, ?, ?, ?)`,
      ['admin', 'admin@taxclearance.com', hash, 'Tax Clearance EA', 'admin',
       'Enrolled Agent with years of experience helping individuals and small businesses navigate the US tax system.']
    );
    console.log('✅ Default admin user created: admin / TaxClearance2024!');
  }

  // Seed categories
  const cats = [
    { name: 'Tax Deductions', slug: 'tax-deductions', color: '#6366f1', icon: '💰', desc: 'Maximize your deductions and reduce your tax burden.' },
    { name: 'Tax Credits', slug: 'tax-credits', color: '#10b981', icon: '✅', desc: 'Discover tax credits you may be missing out on.' },
    { name: 'IRS Updates', slug: 'irs-updates', color: '#ef4444', icon: '📢', desc: 'Stay current with the latest IRS announcements.' },
    { name: 'Tax Planning', slug: 'tax-planning', color: '#f59e0b', icon: '📊', desc: 'Strategic tax planning for individuals and families.' },
    { name: 'Small Business Taxes', slug: 'small-business-taxes', color: '#8b5cf6', icon: '🏢', desc: 'Tax guidance for small business owners.' },
    { name: 'Self-Employed Taxes', slug: 'self-employed-taxes', color: '#06b6d4', icon: '💼', desc: 'Everything freelancers and self-employed workers need to know.' },
    { name: 'Crypto Tax', slug: 'crypto-tax', color: '#f97316', icon: '₿', desc: 'Cryptocurrency tax rules and reporting requirements.' },
    { name: 'International Tax', slug: 'international-tax', color: '#84cc16', icon: '🌍', desc: 'Tax guidance for expats, foreign income, and FBAR.' },
    { name: 'Tax Filing Tips', slug: 'tax-filing-tips', color: '#ec4899', icon: '📝', desc: 'Step-by-step guidance for filing your taxes correctly.' },
    { name: 'Tax Deadlines', slug: 'tax-deadlines', color: '#14b8a6', icon: '📅', desc: 'Important tax dates and deadline reminders.' },
    { name: 'State Taxes', slug: 'state-taxes', color: '#a855f7', icon: '🗺️', desc: 'State-specific tax rules and guidance.' },
    { name: 'Tax Relief Programs', slug: 'tax-relief-programs', color: '#22c55e', icon: '🛡️', desc: 'IRS payment plans, OIC, and other relief options.' },
  ];
  for (const c of cats) {
    await db.run(
      `INSERT OR IGNORE INTO categories (name, slug, description, color, icon) VALUES (?, ?, ?, ?, ?)`,
      [c.name, c.slug, c.desc, c.color, c.icon]
    );
  }

  // Seed default settings
  const defaults = {
    site_name: 'Tax Clearance',
    site_tagline: 'Free US Tax Education by an Enrolled Agent',
    site_description: 'Expert tax guidance, IRS updates, and educational articles for individuals and small businesses — completely free.',
    ea_name: 'Your Name, EA',
    ea_credentials: 'Enrolled Agent (EA) | IRS Authorized',
    ea_bio: 'As an Enrolled Agent licensed by the IRS, I help individuals and small businesses navigate the complex US tax system.',
    ea_email: 'contact@taxclearance.com',
    ea_phone: '',
    ea_calendly: '',
    google_analytics_id: '',
    twitter_handle: '@taxclearance',
    facebook_url: '',
    linkedin_url: '',
    footer_text: '© 2024 Tax Clearance. Educational content only — not legal or financial advice.',
    articles_per_page: '10',
  };
  for (const [k, v] of Object.entries(defaults)) {
    await db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`, [k, v]);
  }

  // Seed sample articles
  const adminUser = await db.get('SELECT id FROM users WHERE username = ?', ['admin']);
  const sampleCount = await db.get('SELECT COUNT(*) as cnt FROM articles');
  if (sampleCount && sampleCount.cnt === 0 && adminUser) {
    const catRow = await db.get('SELECT id FROM categories WHERE slug = ?', ['tax-deductions']);
    const irsRow = await db.get('SELECT id FROM categories WHERE slug = ?', ['irs-updates']);
    const bizRow = await db.get('SELECT id FROM categories WHERE slug = ?', ['small-business-taxes']);

    const sampleArticles = [
      {
        title: '12 Often-Overlooked Tax Deductions Every American Should Know',
        slug: '12-overlooked-tax-deductions',
        excerpt: 'Millions of Americans leave money on the table every tax season. Discover these commonly missed deductions that could significantly reduce your tax bill.',
        content: '<h2>Are You Leaving Money on the Table?</h2><p>Every year, millions of Americans pay more in taxes than they legally need to. As an Enrolled Agent, I have seen this happen repeatedly. Here are 12 deductions that my clients most commonly overlook.</p><h2>1. Home Office Deduction</h2><p>If you use part of your home <strong>exclusively and regularly</strong> for business, you may qualify. This covers rent, utilities, insurance, and depreciation proportionally.</p><h2>2. Student Loan Interest</h2><p>Deduct up to <strong>$2,500</strong> per year — even without itemizing. This directly reduces your adjusted gross income.</p><h2>3. State and Local Taxes (SALT)</h2><p>Deduct up to <strong>$10,000</strong> of state income taxes and property taxes combined.</p><h2>4. Medical Expenses</h2><p>Expenses exceeding <strong>7.5% of your AGI</strong> are deductible — including insurance premiums and prescriptions.</p><h2>5. Charitable Contributions</h2><p>Cash and property donations to qualifying organizations are deductible. Even mileage at 14 cents per mile.</p><h2>Bottom Line</h2><p>Tax deductions exist to legally reduce what you owe. If you are unsure which apply to your situation, an Enrolled Agent can save you far more than the consultation costs.</p>',
        category_id: catRow?.id || 1,
        status: 'published',
        reading_time: 6,
        is_featured: 1,
        is_trending: 1,
        seo_title: '12 Often-Overlooked Tax Deductions | Tax Clearance',
        seo_description: 'Discover 12 commonly missed tax deductions that could significantly reduce your tax bill — free guide by an Enrolled Agent.',
        seo_keywords: 'tax deductions, overlooked deductions, home office deduction',
        views: 2847,
      },
      {
        title: 'IRS Announces 2024 Tax Bracket Updates: What You Need to Know',
        slug: 'irs-2024-tax-bracket-updates',
        excerpt: 'The IRS released updated tax brackets for 2024 with inflation adjustments. Here is a clear breakdown of what changes and how it affects your wallet.',
        content: '<h2>2024 Tax Brackets Explained</h2><p>Each year, the IRS adjusts tax brackets for inflation to prevent bracket creep. For 2024, brackets increased by approximately <strong>5.4%</strong>.</p><h2>2024 Federal Tax Brackets (Single Filers)</h2><ul><li>10% — up to $11,600</li><li>12% — $11,601 to $47,150</li><li>22% — $47,151 to $100,525</li><li>24% — $100,526 to $191,950</li><li>32% — $191,951 to $243,725</li><li>35% — $243,726 to $609,350</li><li>37% — over $609,350</li></ul><h2>Standard Deduction 2024</h2><ul><li><strong>Single:</strong> $14,600</li><li><strong>Married Filing Jointly:</strong> $29,200</li><li><strong>Head of Household:</strong> $21,900</li></ul><p>These adjustments mean you can earn more before being pushed into the next bracket.</p>',
        category_id: irsRow?.id || 3,
        status: 'published',
        reading_time: 4,
        is_featured: 0,
        is_trending: 1,
        seo_title: 'IRS 2024 Tax Bracket Updates | Tax Clearance',
        seo_description: 'Complete guide to 2024 IRS tax bracket updates with inflation adjustments and new standard deduction amounts.',
        seo_keywords: 'IRS 2024 tax brackets, tax bracket changes, 2024 standard deduction',
        views: 1923,
      },
      {
        title: 'Small Business Tax Deductions: The Complete 2024 Guide',
        slug: 'small-business-tax-deductions-2024',
        excerpt: 'Running a small business? This guide covers every major tax deduction available to minimize your tax liability legally.',
        content: '<h2>Why Small Business Tax Deductions Matter</h2><p>The average small business owner overpays taxes by thousands of dollars simply because they are unaware of all available deductions.</p><h2>1. Business Vehicle Expenses</h2><p>Use your vehicle for business? Choose between the standard mileage rate (67 cents/mile in 2024) or actual expense method.</p><h2>2. Home Office</h2><p>For self-employed individuals on Schedule C, the home office deduction can be claimed for space used exclusively for business.</p><h2>3. Business Insurance</h2><p>Premiums for general liability, professional liability, property, and business interruption insurance are fully deductible.</p><h2>4. Section 179 Deduction</h2><p>Instead of depreciating equipment over years, Section 179 lets you deduct the full cost in the year of purchase. The 2024 limit is <strong>$1,220,000</strong>.</p><h2>5. Marketing and Advertising</h2><p>All legitimate advertising costs are deductible — digital ads, website costs, social media promotion, and business cards.</p>',
        category_id: bizRow?.id || 5,
        status: 'published',
        reading_time: 8,
        is_featured: 1,
        is_trending: 0,
        seo_title: 'Small Business Tax Deductions 2024 | Tax Clearance',
        seo_description: 'Complete guide to small business tax deductions for 2024 — vehicles, home office, Section 179, and more from an Enrolled Agent.',
        seo_keywords: 'small business tax deductions, business expenses, Section 179',
        views: 3102,
      },
    ];

    for (const a of sampleArticles) {
      await db.run(
        `INSERT INTO articles (title, slug, content, excerpt, author_id, category_id, status, reading_time,
          is_featured, is_trending, seo_title, seo_description, seo_keywords, views, publish_date, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [a.title, a.slug, a.content, a.excerpt, adminUser.id,
         a.category_id, a.status, a.reading_time, a.is_featured, a.is_trending,
         a.seo_title, a.seo_description, a.seo_keywords, a.views]
      );
    }

    // Update category counts
    await db.run(`UPDATE categories SET article_count = (SELECT COUNT(*) FROM articles WHERE articles.category_id = categories.id AND articles.status = 'published')`);

    console.log('✅ Sample articles seeded');
  }

  console.log('✅ Database initialized successfully');
}

module.exports = { db, initializeDatabase };
