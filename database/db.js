const { db } = require('./db-turso');
const bcrypt = require('bcryptjs');


function initializeDatabase() {
  db.exec(`
    -- Users (admins)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      bio TEXT,
      avatar TEXT,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Categories
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#6366f1',
      icon TEXT DEFAULT '📋',
      article_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tags
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Articles
    CREATE TABLE IF NOT EXISTS articles (
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
    );

    -- Article Tags Junction
    CREATE TABLE IF NOT EXISTS article_tags (
      article_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (article_id, tag_id),
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    -- Comments
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      author_name TEXT NOT NULL,
      author_email TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
    );

    -- Newsletter subscribers
    CREATE TABLE IF NOT EXISTS newsletter (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'active'
    );

    -- Leads (consultation requests)
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      service_type TEXT,
      message TEXT,
      preferred_date TEXT,
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Media library
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      alt_text TEXT,
      uploaded_by INTEGER,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    -- Site settings
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
    CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id);
    CREATE INDEX IF NOT EXISTS idx_articles_publish_date ON articles(publish_date DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_views ON articles(views DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
    CREATE INDEX IF NOT EXISTS idx_comments_article ON comments(article_id);
  `);

  // Seed default admin user
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'TaxClearance2024!', 12);
    db.prepare(`INSERT INTO users (username, email, password_hash, display_name, role, bio)
      VALUES (?, ?, ?, ?, ?, ?)`).run(
      'admin',
      'admin@taxclearance.com',
      hash,
      'Tax Clearance EA',
      'admin',
      'Enrolled Agent with years of experience helping individuals and small businesses navigate the US tax system.'
    );
    console.log('✅ Default admin user created: admin / TaxClearance2024!');
  }

  // Seed default categories
  const cats = [
    { name: 'Tax Deductions', slug: 'tax-deductions', color: '#6366f1', icon: '💰', desc: 'Maximize your deductions and reduce your tax burden.' },
    { name: 'Tax Credits', slug: 'tax-credits', color: '#10b981', icon: '✅', desc: 'Discover tax credits you may be missing out on.' },
    { name: 'IRS Updates', slug: 'irs-updates', color: '#ef4444', icon: '📢', desc: 'Stay current with the latest IRS announcements and changes.' },
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
  const insertCat = db.prepare(`INSERT OR IGNORE INTO categories (name, slug, description, color, icon) VALUES (?, ?, ?, ?, ?)`);
  cats.forEach(c => insertCat.run(c.name, c.slug, c.desc, c.color, c.icon));

  // Seed default settings
  const defaults = {
    site_name: 'Tax Clearance',
    site_tagline: 'Free US Tax Education by an Enrolled Agent',
    site_description: 'Expert tax guidance, IRS updates, and educational articles for individuals and small businesses — completely free.',
    ea_name: 'Your Name, EA',
    ea_credentials: 'Enrolled Agent (EA) | IRS Authorized',
    ea_bio: 'As an Enrolled Agent licensed by the IRS, I help individuals and small businesses navigate the complex US tax system. My mission is to make tax education accessible and free for everyone.',
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
  const insertSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
  Object.entries(defaults).forEach(([k, v]) => insertSetting.run(k, v));

  // Seed sample articles
  const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  const sampleCount = db.prepare('SELECT COUNT(*) as cnt FROM articles').get();
  if (sampleCount.cnt === 0 && adminUser) {
    const catRow = db.prepare('SELECT id FROM categories WHERE slug = ?').get('tax-deductions');
    const irsRow = db.prepare('SELECT id FROM categories WHERE slug = ?').get('irs-updates');
    const bizRow = db.prepare('SELECT id FROM categories WHERE slug = ?').get('small-business-taxes');

    const sampleArticles = [
      {
        title: '12 Often-Overlooked Tax Deductions Every American Should Know',
        slug: '12-overlooked-tax-deductions-every-american-should-know',
        excerpt: 'Millions of Americans leave money on the table every tax season. Discover these commonly missed deductions that could significantly reduce your tax bill.',
        content: `<h2>Are You Leaving Money on the Table?</h2><p>Every year, millions of Americans pay more in taxes than they legally need to. The reason? They simply don't know about all the deductions available to them. As an Enrolled Agent, I've seen this happen repeatedly — and it's completely avoidable.</p><p>Here are 12 deductions that my clients most commonly overlook.</p><h2>1. Home Office Deduction</h2><p>If you use part of your home <strong>exclusively and regularly</strong> for business, you may qualify for the home office deduction. This applies to both homeowners and renters, and covers a proportionate share of rent, utilities, insurance, and depreciation.</p><blockquote>The IRS offers two methods: the simplified method ($5 per square foot, up to 300 sq ft) and the regular method (actual expenses × business-use percentage).</blockquote><h2>2. Student Loan Interest</h2><p>You can deduct up to <strong>$2,500</strong> in student loan interest per year — even if you don't itemize deductions. This is an "above-the-line" deduction, meaning it reduces your adjusted gross income directly.</p><h2>3. State and Local Taxes (SALT)</h2><p>You can deduct up to <strong>$10,000</strong> ($5,000 if married filing separately) of state and local taxes, including income taxes or sales taxes, and property taxes.</p><h2>4. Medical and Dental Expenses</h2><p>Medical expenses that exceed <strong>7.5% of your adjusted gross income</strong> are deductible. This includes insurance premiums, prescriptions, and out-of-pocket costs.</p><h2>5. Charitable Contributions</h2><p>Donations to qualifying organizations are deductible. This includes cash, property, and even mileage driven for charitable purposes (14 cents per mile in 2024).</p><h2>6. Educator Expenses</h2><p>Teachers and eligible educators can deduct up to <strong>$300</strong> ($600 for joint filers who are both educators) for classroom supplies — directly from income, no itemizing needed.</p><h2>7. Self-Employment Taxes</h2><p>Self-employed individuals pay both the employee and employer portions of Social Security and Medicare taxes. The good news: <strong>you can deduct half of that</strong> as a business expense.</p><h2>8. Health Insurance Premiums (Self-Employed)</h2><p>If you're self-employed, you can deduct 100% of health insurance premiums for yourself, your spouse, and your dependents — another above-the-line deduction.</p><h2>9. Retirement Contributions</h2><p>Contributions to a traditional IRA (up to $7,000 in 2024, $8,000 if 50+), 401(k), SEP-IRA, or SIMPLE IRA reduce your taxable income significantly.</p><h2>10. Energy-Efficient Home Improvements</h2><p>The Inflation Reduction Act expanded energy tax credits. You may qualify for credits on solar panels, heat pumps, energy-efficient windows, and more through the <strong>Energy Efficient Home Improvement Credit</strong>.</p><h2>11. Investment Losses (Tax-Loss Harvesting)</h2><p>Capital losses can offset capital gains dollar-for-dollar. If losses exceed gains, you can deduct up to <strong>$3,000</strong> against ordinary income — and carry forward any remaining losses.</p><h2>12. Professional Development and Education</h2><p>Work-related education expenses that maintain or improve your current job skills may be deductible as a business expense, even if they lead to a degree.</p><h2>Bottom Line</h2><p>Tax deductions exist to legally reduce what you owe. The key is knowing they exist. If you're unsure which deductions apply to your situation, consulting with an Enrolled Agent can save you far more than the consultation costs.</p>`,
        category_id: catRow?.id || 1,
        status: 'published',
        reading_time: 6,
        is_featured: 1,
        is_trending: 1,
        seo_title: '12 Often-Overlooked Tax Deductions Every American Should Know | Tax Clearance',
        seo_description: 'Discover 12 commonly missed tax deductions that could significantly reduce your tax bill. From home office to student loan interest — free guide by an Enrolled Agent.',
        seo_keywords: 'tax deductions, overlooked deductions, home office deduction, student loan interest deduction',
        views: 2847,
      },
      {
        title: 'IRS Announces 2024 Tax Bracket Updates: What You Need to Know',
        slug: 'irs-2024-tax-bracket-updates',
        excerpt: 'The IRS has released updated tax brackets for 2024 with inflation adjustments. Here\'s a clear breakdown of what changes and how it affects your wallet.',
        content: `<h2>2024 Tax Brackets: The Complete Picture</h2><p>Each year, the IRS adjusts tax brackets for inflation to prevent "bracket creep" — when inflation pushes income into higher brackets without actual purchasing power gains. For 2024, brackets increased by approximately <strong>5.4%</strong>.</p><h2>2024 Federal Income Tax Brackets (Single Filers)</h2><table><thead><tr><th>Tax Rate</th><th>Income Range</th></tr></thead><tbody><tr><td>10%</td><td>$0 – $11,600</td></tr><tr><td>12%</td><td>$11,601 – $47,150</td></tr><tr><td>22%</td><td>$47,151 – $100,525</td></tr><tr><td>24%</td><td>$100,526 – $191,950</td></tr><tr><td>32%</td><td>$191,951 – $243,725</td></tr><tr><td>35%</td><td>$243,726 – $609,350</td></tr><tr><td>37%</td><td>Over $609,350</td></tr></tbody></table><h2>Standard Deduction Increases</h2><p>The standard deduction also increased for 2024:</p><ul><li><strong>Single:</strong> $14,600 (up $750 from 2023)</li><li><strong>Married Filing Jointly:</strong> $29,200 (up $1,500)</li><li><strong>Head of Household:</strong> $21,900 (up $1,100)</li></ul><h2>What This Means for You</h2><p>These adjustments mean you can earn more in 2024 before being pushed into the next bracket. For most middle-income earners, this translates to a modest reduction in overall tax burden compared to 2023.</p>`,
        category_id: irsRow?.id || 3,
        status: 'published',
        reading_time: 4,
        is_featured: 0,
        is_trending: 1,
        seo_title: 'IRS 2024 Tax Bracket Updates Explained | Tax Clearance',
        seo_description: 'Complete guide to the 2024 IRS tax bracket updates with inflation adjustments. Learn how the new brackets affect your taxes with clear tables and examples.',
        seo_keywords: 'IRS 2024 tax brackets, tax bracket changes, 2024 standard deduction',
        views: 1923,
      },
      {
        title: 'Small Business Tax Deductions: The Complete 2024 Guide',
        slug: 'small-business-tax-deductions-complete-guide-2024',
        excerpt: 'Running a small business? This comprehensive guide covers every major tax deduction available to small business owners to minimize your tax liability legally.',
        content: `<h2>Why Small Business Tax Deductions Matter</h2><p>The average small business owner overpays taxes by thousands of dollars every year simply because they're unaware of all available deductions. The US tax code is intentionally designed to incentivize business activity — you just need to know how to use it.</p><h2>1. Business Vehicle Expenses</h2><p>If you use your vehicle for business, you have two options:</p><ul><li><strong>Standard mileage rate:</strong> 67 cents per mile for 2024</li><li><strong>Actual expense method:</strong> Track gas, insurance, repairs, and depreciation</li></ul><p>Keep a detailed mileage log — the IRS requires documentation.</p><h2>2. Home Office Deduction (Businesses)</h2><p>For self-employed individuals, the home office deduction can be claimed on Schedule C. The space must be used <em>exclusively and regularly</em> for business.</p><h2>3. Business Insurance</h2><p>Premiums for business insurance are fully deductible, including general liability, professional liability (E&O), property insurance, and business interruption insurance.</p><h2>4. Employee Wages and Benefits</h2><p>Wages, salaries, bonuses, and benefits paid to employees (not yourself as a sole proprietor) are deductible business expenses.</p><h2>5. Marketing and Advertising</h2><p>All legitimate advertising costs are deductible — digital ads, print materials, website costs, social media promotion, and business cards.</p><h2>6. Professional Services</h2><p>Fees paid to accountants, lawyers, consultants, and other professionals for business-related services are fully deductible.</p><h2>Section 179 Deduction</h2><p>Instead of depreciating business equipment over several years, Section 179 lets you deduct the full cost in the year of purchase. The 2024 limit is <strong>$1,220,000</strong>.</p><blockquote>Bonus Depreciation: In addition to Section 179, you may also qualify for 60% bonus depreciation on qualifying property in 2024.</blockquote>`,
        category_id: bizRow?.id || 5,
        status: 'published',
        reading_time: 8,
        is_featured: 1,
        is_trending: 0,
        seo_title: 'Small Business Tax Deductions: Complete 2024 Guide | Tax Clearance',
        seo_description: 'Complete guide to small business tax deductions for 2024. Learn about vehicle expenses, home office, Section 179, and more from an Enrolled Agent.',
        seo_keywords: 'small business tax deductions, business expenses, Section 179, Schedule C deductions',
        views: 3102,
      },
    ];

    const insertArticle = db.prepare(`
      INSERT INTO articles (title, slug, content, excerpt, author_id, category_id, status, reading_time,
        is_featured, is_trending, seo_title, seo_description, seo_keywords, views, publish_date, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    sampleArticles.forEach(a => {
      insertArticle.run(
        a.title, a.slug, a.content, a.excerpt, adminUser.id,
        a.category_id, a.status, a.reading_time, a.is_featured, a.is_trending,
        a.seo_title, a.seo_description, a.seo_keywords, a.views
      );
    });

    // Update category counts
    db.exec(`
      UPDATE categories SET article_count = (
        SELECT COUNT(*) FROM articles WHERE articles.category_id = categories.id AND articles.status = 'published'
      )
    `);

    console.log('✅ Sample articles seeded');
  }

  console.log('✅ Database initialized successfully');
}

initializeDatabase();

module.exports = db;
