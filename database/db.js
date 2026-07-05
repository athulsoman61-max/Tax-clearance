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
    `CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      category_id INTEGER,
      image_url TEXT,
      is_anonymous INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      status TEXT DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )`,
    `CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      is_verified_answer INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS discussions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      category_id INTEGER,
      views INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )`,
    `CREATE TABLE IF NOT EXISTS expert_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      verification_type TEXT NOT NULL,
      credentials TEXT,
      experience TEXT,
      specialization TEXT,
      reputation_score INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status)`,
    `CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id)`,
    `CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug)`,
    `CREATE INDEX IF NOT EXISTS idx_comments_article ON comments(article_id)`,
    `CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category_id)`,
    `CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id)`,
  ];

  for (const sql of tables) {
    await db.run(sql);
  }

  // Attempt to add new columns to existing tables (fails silently if already exists)
  try {
    await db.run("ALTER TABLE questions ADD COLUMN image_url TEXT");
  } catch (e) {
    // Column likely already exists
  }

  // --- MIGRATION: Insert Fringe Benefits Article ---
  try {
    const fringeExists = await db.get("SELECT id FROM articles WHERE slug = 'fringe-benefits-fica-taxes-exemption'");
    if (!fringeExists) {
      console.log('Migrating: Adding Fringe Benefits article...');
      const admin = await db.get("SELECT id FROM users LIMIT 1");
      let cat = await db.get("SELECT id FROM categories WHERE slug = 'tax-news'");
      if (!cat) cat = await db.get("SELECT id FROM categories LIMIT 1");
      const content = `<p>When it comes to payroll taxes, employers and HR professionals often encounter a confusing crossroad: If a fringe benefit is exempt from federal income tax, does that mean it is also exempt from FICA taxes (Social Security and Medicare)?</p>
<p>The short answer is: <strong>Not necessarily.</strong> While many tax-exempt benefits share exclusions for both income and FICA taxes, it is not a universal rule.</p>
<h3>Different Tax Codes, Different Definitions</h3>
<p>The core of this confusion stems from the fact that federal income tax and FICA taxes operate under completely different sections of the Internal Revenue Code (IRC). Each section carries its own definitions and list of specific exclusions.</p>
<p>Generally, all fringe benefits are treated as taxable "wages" for both income tax and FICA purposes unless a specific tax code explicitly excludes them. However, an exclusion for federal income tax does not automatically trigger an exclusion for FICA.</p>
<h3>Example 1: When They Don't Align</h3>
<p>A primary example where income tax and FICA tax rules diverge is <strong>Adoption Assistance</strong>. Under IRC Section 137, qualified adoption assistance provided by an employer is excluded from an employee's gross income for federal income tax purposes. However, the definition of "wages" for FICA purposes (IRC Section 3121) does not contain a parallel exclusion. As a result, these adoption benefits remain fully subject to FICA taxes.</p>
<h3>Example 2: When They Do Align</h3>
<p>In many other cases, the IRS provides specific exclusions that apply across the board. For example, <strong>qualified transportation plans</strong> and <strong>employer-provided health insurance</strong> are generally excluded from both federal income tax and FICA taxes.</p>
<h3>Takeaway for Employers</h3>
<p>Because the rules for federal income tax and FICA tax do not always operate in sync, business owners and payroll administrators cannot assume that a benefit is exempt from FICA simply because it avoids federal income tax.</p>
<p>It is crucial to review the specific tax code provisions for each individual benefit you offer. When in doubt, consult a qualified tax professional or refer to IRS Publication 15-B (Employer's Tax Guide to Fringe Benefits) to ensure accurate payroll tax withholding and reporting.</p>`;
      await db.run(`
        INSERT INTO articles (
          title, slug, content, excerpt, featured_image, 
          author_id, category_id, status, publish_date, views, reading_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)
      `, [
        "Are Fringe Benefits Exempt from FICA Taxes?",
        "fringe-benefits-fica-taxes-exemption",
        content,
        "Don't assume that because a fringe benefit is exempt from federal income tax, it's also exempt from FICA taxes. The rules can differ significantly.",
        "fringe_benefits_fica_tax.png",
        admin ? admin.id : 1,
        cat ? cat.id : 1,
        "published",
        0,
        3
      ]);
    }
  } catch (e) {
    console.error('Migration failed:', e);
  }
  // ------------------------------------------------

  // --- MIGRATION: Insert CP53E Notice Article ---
  try {
    const cp53Exists = await db.get("SELECT id FROM articles WHERE slug = 'irs-incorrect-cp53e-notices'");
    if (!cp53Exists) {
      console.log('Migrating: Adding CP53E Notice article...');
      const admin = await db.get("SELECT id FROM users LIMIT 1");
      let cat = await db.get("SELECT id FROM categories WHERE slug = 'irs-updates'");
      if (!cat) cat = await db.get("SELECT id FROM categories LIMIT 1");
      const content = `<p>The IRS is actively investigating reports of erroneous <strong>CP53E notices</strong> being sent to taxpayers and is seeking examples to determine the root cause of the issue.</p>
<h3>What is a CP53E Notice?</h3>
<p>The CP53E notice was recently introduced by the IRS to facilitate a transition from paper checks to electronic direct deposits, aligning with Executive Order 14247. The primary purpose of the notice is to ask taxpayers to provide or update their bank account information so they can receive their tax refunds electronically.</p>
<h3>The Problem: Erroneous Notices</h3>
<p>While the IRS initially maintained that the notices were not sent in error, a significant number of taxpayers and tax professionals have reported receiving them under confusing circumstances. According to reports gathered by the American Institute of CPAs (AICPA), these notices have been sent to taxpayers who:</p>
<ul>
  <li>Did not expect a refund because they applied their overpayments to the following tax year.</li>
  <li>Actually reported a balance due rather than a refund.</li>
  <li>Already had valid, up-to-date direct deposit information on file with the IRS.</li>
</ul>
<h3>How You Can Help (and What to Do)</h3>
<p>If you or your clients have received a CP53E notice in error—specifically cases where there was no net positive adjustment to the account or where a bank deposit wasn't rejected—the AICPA is collecting these examples to share directly with the IRS.</p>
<p>Tax professionals and taxpayers can send examples of these incorrect notices via email to <strong>IRSServices@aicpa-cima.com</strong>.</p>
<h3>Beware of Scams</h3>
<p>Because of the widespread confusion surrounding these notices, scammers have unfortunately begun circulating fraudulent versions of the CP53E letter to steal banking information.</p>
<p><strong>Safety Tips:</strong></p>
<ul>
  <li>Always verify your account status independently by logging into your secure IRS Online Account directly at <strong>IRS.gov</strong>.</li>
  <li>Do not scan QR codes or click links in any unexpected tax notice you receive via email or letter.</li>
  <li>Remember that the IRS will never ask for sensitive banking information via text message, email, or social media, nor can they update your banking details over the phone.</li>
</ul>
<p>Stay vigilant, and if you believe you received one of these notices in error, consider submitting it to the AICPA to help resolve this administrative glitch.</p>`;
      await db.run(`
        INSERT INTO articles (
          title, slug, content, excerpt, featured_image, 
          author_id, category_id, status, publish_date, views, reading_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)
      `, [
        "IRS Seeks Examples of Incorrect CP53E Notices",
        "irs-incorrect-cp53e-notices",
        content,
        "Did you receive a CP53E notice in error? The IRS is investigating reports of notices sent to taxpayers who didn't expect a refund, and the AICPA is collecting examples.",
        "irs_cp53e_notice.png",
        admin ? admin.id : 1,
        cat ? cat.id : 1,
        "published",
        0,
        3
      ]);
    }
  } catch (e) {
    console.error('Migration failed:', e);
  }
  // ------------------------------------------------

  // --- MIGRATION: Insert Charitable Contributions Article ---
  try {
    const charityExists = await db.get("SELECT id FROM articles WHERE slug = 'charitable-contributions-cannot-claim'");
    if (!charityExists) {
      console.log('Migrating: Adding Charitable Contributions article...');
      const admin = await db.get("SELECT id FROM users LIMIT 1");
      let cat = await db.get("SELECT id FROM categories WHERE slug = 'tax-deductions'");
      if (!cat) cat = await db.get("SELECT id FROM categories LIMIT 1");
      const content = `<p>As tax season approaches, many taxpayers look to their charitable giving to help reduce their taxable income. However, the IRS has strict rules regarding what qualifies as a tax-deductible donation. It is common for taxpayers to assume certain expenses are deductible when, in reality, they are not.</p>
<h3>1. Donations to Non-Qualified Organizations</h3>
<p>To be tax-deductible, your contribution must be made to an IRS-recognized 501(c)(3) charitable organization. You <strong>cannot</strong> deduct donations made to:</p>
<ul>
  <li>Civic leagues and chambers of commerce</li>
  <li>Social and sports clubs</li>
  <li>Labor unions</li>
  <li>Political organizations, campaigns, or candidates</li>
</ul>
<p>Additionally, gifts given directly to specific individuals in need—no matter how generous—are never tax-deductible.</p>
<h3>2. The Value of Your Time or Services</h3>
<p>If you volunteer your time at a local charity, you might think you can deduct your hourly professional rate. Unfortunately, the IRS does not allow you to deduct the value of your time, labor, or services.</p>
<p><em>However,</em> you may be able to deduct certain out-of-pocket expenses directly related to your volunteering, such as travel costs or purchasing a required uniform that has no general utility outside of the charity work.</p>
<h3>3. "Quid Pro Quo" Contributions</h3>
<p>If you receive a benefit in exchange for your donation—such as buying a ticket to a charity gala, participating in a raffle, or receiving a tote bag—you generally cannot deduct the full amount you paid. The IRS requires you to subtract the fair market value of the item or benefit you received from your total donation. You can only deduct the difference.</p>
<h3>4. Pledges and Promises</h3>
<p>A pledge to pay a charity in the future does not count for the current tax year. You can only deduct contributions that are actually paid (whether by cash, check, or credit card) by December 31 of the tax year in question.</p>
<h3>Common Pitfalls to Avoid</h3>
<p>Even if your contribution qualifies, you must ensure you file correctly:</p>
<ul>
  <li><strong>You Must Itemize:</strong> To claim charitable deductions, you generally must itemize your deductions on Schedule A. If you take the Standard Deduction, you usually cannot claim these contributions.</li>
  <li><strong>Keep Your Records:</strong> The IRS requires documentation for all contributions. For cash donations, you need a bank record or a written acknowledgment. For donations of $250 or more, you must have a "contemporaneous written acknowledgment" from the charity.</li>
</ul>
<p>Understanding these rules ahead of time can help you avoid audits and ensure you only claim the deductions you are legally entitled to.</p>`;
      await db.run(`
        INSERT INTO articles (
          title, slug, content, excerpt, featured_image, 
          author_id, category_id, status, publish_date, views, reading_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)
      `, [
        "Charitable Contributions You Think You Can Claim but Can't",
        "charitable-contributions-cannot-claim",
        content,
        "Many taxpayers overestimate their tax-deductible charitable contributions. Learn the strict IRS rules about what actually qualifies, including non-deductible time, quid pro quo gifts, and organization types.",
        "charitable_contributions_photo.png",
        admin ? admin.id : 1,
        cat ? cat.id : 1,
        "published",
        0,
        4
      ]);
    }
  } catch (e) {
    console.error('Migration failed:', e);
  }
  // ------------------------------------------------

  // Check if database is already seeded
  try {
    const settingsCount = await db.get('SELECT COUNT(*) as cnt FROM settings');
    if (settingsCount && settingsCount.cnt > 0) {
      console.log('✅ Database tables verified. Settings exist, skipping seed queries.');
      console.log('✅ Database initialized successfully');
      return;
    }
  } catch (e) {
    console.log('⚠️ Seed check failed, running full seed sequence...', e.message);
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
      {
        title: 'One Big Beautiful Bill Explained: 10 Tax Changes Every Taxpayer Should Understand in 2026',
        slug: 'one-big-beautiful-bill-explained-2026',
        excerpt: 'The One Big Beautiful Bill Act (OBBBA) is one of the most significant U.S. tax laws enacted since the 2017 Tax Cuts and Jobs Act (TCJA). Here is what you need to know.',
        content: `## Introduction\n\nThe **One Big Beautiful Bill Act (OBBBA)** is one of the most significant U.S. tax laws enacted since the 2017 Tax Cuts and Jobs Act (TCJA). Signed into law on **July 4, 2025**, it permanently extends many TCJA provisions while introducing several new deductions, modifying tax credits, changing business tax rules, and phasing out numerous clean energy incentives.\n\nFor taxpayers, business owners, and tax professionals, understanding these changes is essential for effective tax planning. Some provisions applied beginning with the **2025 tax year**, while others became effective in **2026 and later**.\n\nThis guide highlights the ten most important tax changes and explains what they could mean for you.\n\n---\n\n# 1. TCJA Individual Tax Rates Are Now Permanent\n\nOne of the law's biggest changes is the permanent extension of the individual income tax brackets created by the Tax Cuts and Jobs Act.\n\nWithout new legislation, those lower tax rates were scheduled to expire. Instead, Congress made them permanent, giving taxpayers greater certainty for long-term planning.\n\n**Planning Tip:** Individuals considering Roth conversions, retirement withdrawals, or investment sales can now make decisions without the immediate concern of expiring tax brackets.\n\n---\n\n# 2. Higher Standard Deduction Continues\n\nThe law permanently preserves the increased standard deduction introduced under the TCJA and incorporates annual inflation adjustments.\n\nBecause of the larger deduction, many taxpayers will continue claiming the standard deduction rather than itemizing.\n\n**Example**\n\nA married couple with moderate mortgage interest and charitable contributions may still receive a larger deduction by using the standard deduction instead of itemizing.\n\n---\n\n# 3. SALT Deduction Increased\n\nOne of the most discussed provisions is the increase in the **State and Local Tax (SALT) deduction limitation**.\n\nFor many taxpayers, the deduction cap increased substantially compared with the previous $10,000 limitation, although income-based phaseouts and future adjustments may apply depending on the tax year.\n\nThis change primarily benefits taxpayers living in high-tax states.\n\n---\n\n# 4. New Deduction for Qualified Tips\n\nThe Act introduced a temporary deduction allowing eligible workers to deduct certain qualified tip income.\n\nIndustries likely to benefit include:\n\n* Restaurants\n* Hospitality\n* Food service\n* Personal services\n\nThe deduction is subject to statutory eligibility requirements, income limitations, and IRS guidance.\n\n---\n\n# 5. Deduction for Qualified Overtime Pay\n\nEligible taxpayers may also claim a deduction for qualified overtime compensation.\n\nUnlike an exclusion from income, this generally operates as a deduction subject to the requirements established by Congress and subsequent IRS guidance.\n\nWorkers should retain:\n\n* Payroll records\n* Form W-2\n* Employer documentation\n\n---\n\n# 6. Senior Deduction Expanded\n\nOlder taxpayers received an additional deduction under the legislation.\n\nThe new deduction is designed to provide tax relief for qualifying seniors while maintaining existing Social Security taxation rules.\n\nTaxpayers should review applicable income limitations before assuming eligibility.\n\n---\n\n# 7. Trump Accounts Introduced\n\nThe Act created **Trump Accounts**, new tax-advantaged savings accounts intended to encourage long-term savings for eligible children.\n\nRecent IRS guidance also established a safe harbor that reduces gift tax reporting requirements for many qualifying contributions.\n\nFamilies considering these accounts should understand:\n\n* Eligibility requirements\n* Contribution limits\n* Distribution rules\n* Investment options\n* Gift tax implications\n\n---\n\n# 8. Business Tax Incentives Expanded\n\nBusinesses received several favorable provisions, including permanent or expanded incentives related to:\n\n* Bonus depreciation\n* Domestic research and experimental expenditures\n* Interest limitation rules\n* Capital investment\n\nMany of these provisions are intended to encourage long-term investment and economic growth.\n\nSmall businesses should consult their tax advisors before making significant purchasing decisions.\n\n---\n\n# 9. Estate and Gift Tax Exemption Increased\n\nThe legislation permanently increases the federal estate and gift tax exemption, indexed for inflation.\n\nAlthough relatively few taxpayers owe federal estate tax, the higher exemption provides additional planning opportunities for high-net-worth families.\n\nEstate plans, trusts, and gifting strategies should be reviewed periodically to reflect the updated exemption amounts.\n\n---\n\n# 10. Clean Energy Tax Credits Narrowed\n\nSeveral clean energy incentives enacted under prior law were modified, phased out, or repealed.\n\nAffected areas include certain:\n\n* Electric vehicle credits\n* Residential energy credits\n* Commercial clean energy incentives\n\nTaxpayers considering major energy-related purchases should verify whether a credit is still available before completing a transaction.\n\n---\n\n# What This Means for Taxpayers\n\nThe One Big Beautiful Bill provides both opportunities and responsibilities.\n\n**Individuals may benefit from:**\n\n* Lower permanent tax rates\n* Higher deductions\n* New deductions for qualified tips and overtime\n* Additional relief for seniors\n* Expanded family savings opportunities\n\n**Businesses may benefit from:**\n\n* Increased investment incentives\n* Expanded depreciation opportunities\n* Improved research expense treatment\n* Greater certainty for long-term planning\n\nAt the same time, taxpayers should be aware that some provisions are temporary, while others require detailed IRS guidance before they can be fully applied.\n\n---\n\n# Planning Checklist\n\nBefore filing your next return, consider the following:\n\n* Review whether itemizing or taking the standard deduction produces the best result.\n* Determine whether you qualify for the new deductions for tips or overtime.\n* Reevaluate estimated tax payments if your taxable income changes.\n* Review estate planning documents if higher exemption amounts affect your strategy.\n* Confirm eligibility before claiming clean energy credits.\n* Stay current with IRS guidance implementing the new law.\n\n---\n\n# Frequently Asked Questions\n\n### Does every provision begin in the same tax year?\n\nNo. Some provisions apply beginning with the 2025 tax year, while others became effective in 2026 or later.\n\n### Are all provisions permanent?\n\nNo. The Act contains both permanent and temporary provisions. Taxpayers should verify the effective dates and expiration rules for each benefit.\n\n### Will the IRS issue additional guidance?\n\nYes. The IRS continues to release regulations, notices, revenue procedures, FAQs, and tax tips explaining how taxpayers should apply various provisions.\n\n---\n\n# Final Thoughts\n\nThe One Big Beautiful Bill represents a comprehensive overhaul of numerous areas of the Internal Revenue Code. While many taxpayers will experience lower taxes or expanded deductions, the law also introduces new compliance requirements and planning considerations.\n\nBecause implementation continues through IRS guidance, taxpayers and practitioners should monitor future announcements rather than relying solely on the statutory language. Understanding how each provision applies to your individual circumstances is the best way to maximize available tax benefits while remaining compliant.\n\n---\n\n## Sources\n\n**Primary Sources**\n\n1. IRS – One Big Beautiful Bill Provisions.\n2. IRS – One Big Beautiful Bill: Individuals and Workers.\n3. IRS Tax Tips on OBBB implementation.\n4. Public Law 119-21 (One Big Beautiful Bill Act).\n\n**Additional References**\n\n* Tax Foundation – Analysis of the One Big Beautiful Bill Act.\n* Grant Thornton – OBBB U.S. Tax Legislative Overview.\n* H&R Block – OBBB Tax Law Summary (for practical illustrations).`,
        category_id: irsRow?.id || 3,
        status: 'published',
        reading_time: 7,
        is_featured: 1,
        is_trending: 1,
        seo_title: 'One Big Beautiful Bill Explained 2026 | Tax Clearance',
        seo_description: 'Discover the 10 most important tax changes in the One Big Beautiful Bill Act (OBBBA) and what they mean for taxpayers in 2026.',
        seo_keywords: 'OBBBA, tax reform 2026, new tax brackets, tax changes, One Big Beautiful Bill',
        views: 450,
        featured_image: 'obbba_tax_bill.png'
      },
      {
        title: 'IRS Provides Gift Tax Safe Harbor for Trump Accounts: What Families Need to Know',
        slug: 'irs-gift-tax-safe-harbor-trump-accounts-2026',
        excerpt: 'The IRS has issued Revenue Procedure 2026-25, providing a significant gift tax reporting safe harbor for contributions to Trump Accounts. Learn what this means for your family.',
        content: `## IRS Eases Gift Tax Reporting Burden\n\nThe U.S. Department of the Treasury and the Internal Revenue Service (IRS) have issued **Revenue Procedure 2026-25**, providing a significant gift tax reporting safe harbor for certain contributions to Trump Accounts.\n\nBefore this guidance, estate and gift tax practitioners raised concerns that contributions to Trump Accounts could be treated as **future-interest gifts**, potentially requiring donors to file **Form 709, United States Gift (and Generation-Skipping Transfer) Tax Return**, even when contributions were relatively small.\n\nThe new IRS guidance resolves much of that uncertainty by allowing many eligible contributions to avoid gift tax reporting requirements when specific conditions are met.\n\nThis clarification is expected to reduce administrative burdens for families and encourage participation in the new savings program.\n\n---\n\n# Background\n\nTrump Accounts were created under the **Working Families Tax Cuts** legislation as a new tax-advantaged savings vehicle for eligible children.\n\nThe accounts are intended to encourage long-term investing and wealth building beginning in childhood. Eligible children may receive contributions from:\n\n* Parents\n* Grandparents\n* Other family members\n* Friends\n* Certain employers\n* Qualified organizations\n\nHowever, because beneficiaries generally cannot freely access the funds immediately, tax professionals questioned whether these contributions constituted **future-interest gifts**, which normally do not qualify for the annual gift tax exclusion.\n\nThat uncertainty created concern that every personal contribution—even a relatively small one—could require Form 709.\n\n---\n\n# What Changed?\n\nRevenue Procedure 2026-25 introduces a **gift tax reporting safe harbor**.\n\nUnder the safe harbor, certain individual donors are **not required to file Form 709** solely because they contributed to a Trump Account.\n\nThe IRS effectively removes one of the largest compliance concerns surrounding these accounts.\n\n---\n\n# Who Qualifies for the Safe Harbor?\n\nThe relief generally applies when all applicable requirements are satisfied, including:\n\n* The donor is an individual.\n* Contributions are made to a qualifying Trump Account.\n* Total gifts to the beneficiary remain within the annual exclusion amount for the year.\n* No gift tax or generation-skipping transfer (GST) tax liability results after applying available exclusions and exemptions.\n\nTaxpayers should review the complete requirements in Revenue Procedure 2026-25 before relying on the safe harbor.\n\n---\n\n# Why Was This Necessary?\n\nUnder traditional gift tax rules, only **present-interest gifts** qualify for the annual gift tax exclusion.\n\nBecause Trump Account assets generally cannot be accessed immediately by the beneficiary, many practitioners believed contributions could be classified as **future-interest gifts**.\n\nFuture-interest gifts normally require Form 709 reporting regardless of amount.\n\nSeveral estate planning professionals publicly advised clients to delay contributions until the IRS clarified the rules.\n\nRevenue Procedure 2026-25 addresses that uncertainty by providing administrative relief for qualifying contributions.\n\n---\n\n# Example\n\n### Example 1\n\nEmily contributes **$5,000** to her daughter's Trump Account during 2026.\n\nShe makes no other taxable gifts to her daughter during the year.\n\nIf all safe harbor requirements are met, Emily generally **does not need to file Form 709** solely because of this contribution.\n\n---\n\n### Example 2\n\nDavid contributes **$19,000** to his son's Trump Account and later transfers an additional **$10,000** in cash directly to him during the same calendar year.\n\nBecause total gifts exceed the annual exclusion amount, David should carefully review whether Form 709 filing requirements apply.\n\n---\n\n# What Didn't Change?\n\nThe guidance does **not** eliminate federal gift tax.\n\nInstead, it only provides administrative relief from filing requirements for qualifying contributions.\n\nTaxpayers should remember:\n\n* Large gifts may still require reporting.\n* Gift splitting rules remain unchanged.\n* Generation-skipping transfer tax rules continue to apply where applicable.\n* Lifetime gift and estate tax exemptions remain relevant.\n\n---\n\n# Benefits of the New Guidance\n\nThe IRS guidance provides several practical advantages.\n\n### Reduced Compliance Costs\n\nFamilies may avoid preparing Form 709 for qualifying contributions.\n\n### Greater Certainty\n\nTax professionals now have official administrative guidance rather than relying solely on statutory interpretation.\n\n### Encourages Participation\n\nRemoving unnecessary filing requirements may encourage more parents and grandparents to contribute.\n\n### Simplifies Tax Planning\n\nFamilies can better coordinate annual gifting strategies without unnecessary paperwork.\n\n---\n\n# What Tax Preparers Should Discuss with Clients\n\nTax professionals should consider asking:\n\n* Will total gifts exceed the annual exclusion?\n* Were other reportable gifts made during the year?\n* Does the client intend to split gifts with a spouse?\n* Are GST tax rules implicated?\n* Does the contribution satisfy every safe harbor requirement?\n\nProper documentation remains essential.\n\n---\n\n# Key Takeaways\n\n* Revenue Procedure 2026-25 creates a gift tax reporting safe harbor for qualifying Trump Account contributions.\n* Many taxpayers will no longer need to file Form 709 solely because they contributed to a Trump Account.\n* The safe harbor applies only when all IRS conditions are satisfied.\n* Larger gifts and certain complex transactions may still require reporting.\n* Taxpayers should retain records supporting all contributions.\n\n---\n\n# Frequently Asked Questions\n\n## Does this eliminate gift tax?\n\nNo. The guidance primarily addresses gift tax reporting requirements for qualifying contributions.\n\n## Is Form 709 permanently eliminated?\n\nNo. Form 709 may still be required depending on the facts and circumstances.\n\n## Does the guidance apply automatically?\n\nOnly if the contribution satisfies the safe harbor requirements described in Revenue Procedure 2026-25.\n\n## Should taxpayers keep documentation?\n\nYes. Maintaining contribution records remains an important best practice.\n\n---\n\n# Final Thoughts\n\nThe IRS has resolved one of the most significant uncertainties surrounding Trump Accounts. By providing a gift tax reporting safe harbor, Treasury and the IRS have reduced a potential compliance burden that many practitioners believed could discourage participation.\n\nAlthough the guidance simplifies reporting for many taxpayers, donors should continue evaluating their overall gift tax situation before making substantial transfers.\n\nAs additional regulations are issued, taxpayers and advisors should monitor future IRS announcements to ensure continued compliance.\n\n---\n\n## Sources\n\n1. IRS News Release IR-2026-80 – Treasury and IRS provide safe harbor for certain contributions to Trump Accounts.\n2. Revenue Procedure 2026-25 (Internal Revenue Service).\n3. IRS – Proposed Regulations on Opening Initial Trump Accounts.\n4. IRS – About Form 709, United States Gift (and Generation-Skipping Transfer) Tax Return.\n5. Industry analysis from Thomson Reuters, Law360 Tax Authority, and professional estate planning organizations discussing the impact of the new guidance.`,
        category_id: irsRow?.id || 3,
        status: 'published',
        reading_time: 6,
        is_featured: 1,
        is_trending: 1,
        seo_title: 'Gift Tax Safe Harbor for Trump Accounts | IRS Updates 2026',
        seo_description: 'Learn about Revenue Procedure 2026-25 and the IRS gift tax reporting safe harbor for contributions to Trump Accounts.',
        seo_keywords: 'gift tax, safe harbor, Trump accounts, IRS Revenue Procedure 2026-25, tax planning',
        views: 320,
        featured_image: 'gift_tax_safe_harbor_2026.png'
      }
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

let settingsCache = null;
let categoriesCache = null;
let totalArticlesCache = null;

async function getAllSettings() {
  if (settingsCache) {
    return settingsCache;
  }
  const rows = await db.all('SELECT key, value FROM settings');
  const s = {};
  rows.forEach(r => s[r.key] = r.value);
  settingsCache = s;
  console.log('⚙️ Settings cache filled');
  return settingsCache;
}

async function getSetting(key) {
  const settings = await getAllSettings();
  return settings[key] || '';
}

function clearSettingsCache() {
  settingsCache = null;
  console.log('⚙️ Settings cache invalidated');
}

async function getCategories() {
  if (categoriesCache) {
    return categoriesCache;
  }
  categoriesCache = await db.all('SELECT * FROM categories ORDER BY article_count DESC');
  console.log('📂 Categories cache filled');
  return categoriesCache;
}

function clearCategoriesCache() {
  categoriesCache = null;
  console.log('📂 Categories cache invalidated');
}

async function getTotalArticles() {
  if (totalArticlesCache !== null) {
    return totalArticlesCache;
  }
  const totalRow = await db.get(`SELECT COUNT(*) as cnt FROM articles WHERE status = 'published'`);
  totalArticlesCache = totalRow?.cnt || 0;
  console.log('📄 Published articles count cache filled');
  return totalArticlesCache;
}

function clearArticlesCache() {
  totalArticlesCache = null;
  console.log('📄 Articles count cache invalidated');
}

module.exports = {
  db,
  initializeDatabase,
  getAllSettings,
  getSetting,
  clearSettingsCache,
  getCategories,
  clearCategoriesCache,
  getTotalArticles,
  clearArticlesCache
};
