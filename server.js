require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const app = express();

app.enable('trust proxy');

// Canonical Domain Redirect (Production only)
app.use((req, res, next) => {
  const host = req.get('host');
  if (process.env.NODE_ENV === 'production' && host && host !== 'www.taxclearance.space') {
    return res.redirect(301, `https://www.taxclearance.space${req.originalUrl}`);
  }
  next();
});

// Global siteUrl and req middleware
app.use((req, res, next) => {
  res.locals.req = req;
  res.locals.siteUrl = process.env.SITE_URL || (req.protocol + '://' + req.get('host'));
  next();
});

// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Auto-clean stale node-sqlite3-wasm lock directory (left behind on crash)
const dbLockDir = path.join(__dirname, 'database/taxclearance.db.lock');
if (fs.existsSync(dbLockDir)) {
  try { fs.rmSync(dbLockDir, { recursive: true, force: true }); } catch {}
}

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Routes
const publicRoutes = require('./routes/public');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const communityRoutes = require('./routes/community');

app.use('/', authRoutes);
app.use('/', communityRoutes);
app.use('/', publicRoutes);
app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);

// 404 handler
app.use(async (req, res, next) => {
  try {
    const { getAllSettings } = require('./database/db');
    const settings = await getAllSettings();
    res.status(404).render('404', {
      settings,
      page: '404',
      title: '404 — Page Not Found | Tax Clearance',
      description: 'The page you are looking for could not be found.',
    });
  } catch (err) {
    next(err);
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('<h1>Server Error</h1><p>' + err.message + '</p>');
});

const { initializeDatabase, db } = require('./database/db');
const PORT = process.env.PORT || 3000;

// All known committed images in public/uploads/ and public/images/
const SLUG_IMAGE_MAP = [
  { slugPart: 'section-179',            image: '/uploads/section_179_vs_bonus_depreciation_2026.jpg' },
  { slugPart: 'bonus-deprec',           image: '/uploads/section_179_vs_bonus_depreciation_2026.jpg' },
  { slugPart: 'dependency-rule',        image: '/uploads/irs_dependency_rules_guide_2026.jpg' },
  { slugPart: 'qualifying-child',       image: '/uploads/irs_dependency_rules_guide_2026.jpg' },
  { slugPart: 'spains-50m',             image: '/uploads/world_cup_tax_spain_2026.png' },
  { slugPart: 'world-cup-prize',        image: '/uploads/spain_world_cup_tax_2026.png' },
  { slugPart: 'world-cup',              image: '/uploads/world_cup_tax_spain_2026.png' },
  { slugPart: 'sell-your-home',         image: '/uploads/home_sale_tax_free_2026.png' },
  { slugPart: 'home-sale',              image: '/uploads/home_sale_tax_free_2026.png' },
  { slugPart: 'capital-gains-tax-rates',image: '/uploads/capital_gains_tax_2026.png' },
  { slugPart: 'capital-gains',          image: '/uploads/capital_gains_tax_realistic.png' },
  { slugPart: 'qcd',                    image: '/uploads/charitable_contributions.png' },
  { slugPart: 'tariff-brazil',          image: '/uploads/us_brazil_tariff_2026.png' },
  { slugPart: 'mileage-rate',           image: '/uploads/gas_pump_mileage_rate_2026.png' },
  { slugPart: 'rmd-penalty',            image: '/uploads/missed_rmd_form_5329.png' },
  { slugPart: 'required-minimum',       image: '/uploads/missed_rmd_form_5329.png' },
  { slugPart: 'form-8606',              image: '/uploads/ira_double_tax_form_8606.png' },
  { slugPart: 'taxed-twice-ira',        image: '/uploads/ira_double_tax_form_8606.png' },
  { slugPart: 'voids-trump-irs',        image: '/uploads/irs_settlement_voided_macro_2026.png' },
  { slugPart: 'gig-economy',            image: '/uploads/gig_economy_social_security_2026.png' },
  { slugPart: 'reps-audit',             image: '/uploads/reps_audit_trap_2026.png' },
  { slugPart: 'form-1099-r',            image: '/uploads/form_1099r_tax_realistic_2026.png' },
  { slugPart: 'diy-taxes',              image: '/uploads/diy_vs_pro_taxes.png' },
  { slugPart: 'freelancers-schedule',   image: '/uploads/freelancer_outside.png' },
  { slugPart: 'automates-penalty',      image: '/uploads/irs_penalty_relief.png' },
  { slugPart: 'tax-bracket-updates',    image: '/img/articles/tax-brackets-2025.png' },
  { slugPart: 'overlooked-tax-deduct',  image: '/img/articles/standard-deduction-2025.png' },
  { slugPart: 'june-jobs',              image: '/uploads/june_jobs_report.png' },
  { slugPart: 'us-job-growth',          image: '/uploads/june_jobs_report.png' },
  { slugPart: 'jobs-report',            image: '/uploads/june_jobs_report.png' },
  { slugPart: 'irs-safe-harbor',        image: '/uploads/irs_safe_harbor_photo.png' },
  { slugPart: 'trump-account',          image: '/uploads/trump_account_tax.png' },
  { slugPart: 'working-families',       image: '/uploads/trump_account_tax.png' },
  { slugPart: 'property-tax',           image: '/uploads/property_tax_relief_photo.png' },
  { slugPart: 'counties-opt-out',       image: '/uploads/property_tax_relief_photo.png' },
  { slugPart: 'opt-out',                image: '/uploads/property_tax_relief_photo.png' },
  { slugPart: 'ai-risk',                image: '/uploads/irs_ai_risks_photo.png' },
  { slugPart: 'circular-230',           image: '/uploads/irs_ai_risks_photo.png' },
  { slugPart: 'charitable',             image: '/uploads/charitable_contributions.png' },
  { slugPart: 'obbba',                  image: '/uploads/obbba_tax_bill.png' },
  { slugPart: 'big-beautiful',          image: '/uploads/obbba_tax_bill.png' },
  { slugPart: 'digital-service',        image: '/uploads/digital_tax_concept.png' },
  { slugPart: 'dst',                    image: '/uploads/digital_tax_concept.png' },
  { slugPart: 'polestar',               image: '/uploads/polestar_ev_ban.png' },
  { slugPart: 'gift-tax',               image: '/uploads/gift_tax_safe_harbor_2026.png' },
  { slugPart: 'advocate',               image: '/uploads/advocate_report_2026.png' },
];

function fileExists(imgPath) {
  try {
    let normalizedPath = imgPath.startsWith('/') ? imgPath.slice(1) : imgPath;
    if (!normalizedPath.includes('/')) {
      normalizedPath = 'images/' + normalizedPath;
    }
    return fs.existsSync(path.join(__dirname, 'public', normalizedPath));
  } catch { return false; }
}

async function fixImagePaths() {
  try {
    const articles = await db.all('SELECT id, slug, featured_image FROM articles');
    let fixed = 0;
    for (const article of articles) {
      const cur = article.featured_image || '';
      
      // Ensure leading slash for relative filenames (e.g., aca_age_26...)
      if (cur && !cur.startsWith('/')) {
        let testPath = cur.includes('/') ? '/' + cur : '/images/' + cur;
        if (fileExists(testPath)) {
          await db.run('UPDATE articles SET featured_image = ? WHERE id = ?', [testPath, article.id]);
          console.log(`🖼️  Image prefix fixed: [${article.id}] ${article.slug} => ${testPath}`);
          fixed++;
          continue;
        }
      }

      // Skip if current file actually exists on disk and starts with a slash
      if (cur && cur.startsWith('/') && fileExists(cur)) continue;

      // Find a replacement based on slug
      const fix = SLUG_IMAGE_MAP.find(m => article.slug && article.slug.includes(m.slugPart));
      if (fix && fileExists(fix.image)) {
        await db.run('UPDATE articles SET featured_image = ? WHERE id = ?', [fix.image, article.id]);
        console.log(`🖼️  Image fixed: [${article.id}] ${article.slug} => ${fix.image}`);
        fixed++;
      } else if (cur) {
        console.log(`⚠️  No fix found: [${article.id}] ${article.slug} has missing image: ${cur}`);
      }
    }
    if (fixed > 0) console.log(`✅ Fixed ${fixed} article image paths.`);
    else console.log('✅ All article images OK.');
  } catch (e) {
    console.error('Image path migration error (non-fatal):', e.message);
  }
}

async function insertTrumpArticle() {
  try {
    const exists = await db.get("SELECT id FROM articles WHERE slug = 'trump-federal-challenge-new-york-luxury-pied-a-terre-tax'");
    if (!exists) {
      const content = `<p>In a move that escalates the ongoing tension between federal and local policy, President Donald Trump has announced he is evaluating whether the federal government can mount a legal challenge against New York City's controversial new tax on luxury second homes.</p>

<p>The policy, commonly known as the <strong>"pied-à-terre" tax</strong>, has sparked fierce debate since it was enacted into the state budget in May 2026. Officially taking effect on July 1, the measure imposes an annual surcharge on high-value residential properties—including single-family homes, condominiums, and co-ops—that are not used as an owner's primary residence.</p>

<h2>A "Dangerous Political Experiment"</h2>

<p>President Trump took to social media to voice his stark opposition to the tax, characterizing it as a <em>"dangerous political experiment."</em> He confirmed his administration is actively looking into whether federal legal standing exists to <em>"avert this disaster."</em></p>

<p>The federal administration argues that aggressively taxing non-resident property owners will ultimately harm the city's economy. The primary concern is capital flight: the fear that wealthy individuals who maintain secondary residences in the city will simply sell their properties and relocate their investments to more tax-friendly jurisdictions, depressing the local real estate market and reducing ancillary spending in the city.</p>

<h2>The Mechanics of the Pied-à-Terre Tax</h2>

<p>Proponents of the tax, including New York Mayor Zohran Mamdani, view the surcharge as a necessary step to close the city's looming budget gap. The tax is projected to generate approximately <strong>$500 million in annual revenue</strong>.</p>

<p>The rationale is straightforward: non-resident owners of luxury properties utilize city infrastructure and services but do not contribute to the local income tax base in the same manner as full-time residents. The pied-à-terre tax aims to capture revenue from this specific demographic of property owners.</p>

<h2>Legal Hurdles and Ongoing Litigation</h2>

<p>Even before the President's suggestion of federal intervention, the tax faced significant legal roadblocks. The rollout has been heavily criticized for its implementation, particularly regarding the methodology used by the city to identify and notify potentially affected homeowners.</p>

<p>A coalition of homeowners recently filed a lawsuit in New York Supreme Court in Staten Island, challenging the legality and process of the tax. This resulted in a judge temporarily blocking the rollout. However, the city has already moved to appeal that decision, determined to push the tax forward while the legal dispute winds its way through the courts.</p>

<h2>What This Means for Luxury Real Estate</h2>

<p>The prospect of federal intervention adds a complex new layer to an already contentious issue. If the Trump administration finds a viable legal avenue to challenge the state tax, it could set a massive precedent regarding federal oversight of state and local taxation powers.</p>

<p>For now, owners of luxury secondary homes in New York City remain in a state of limbo. Tax professionals and real estate advisors are closely monitoring the situation, as the outcome of both the state-level lawsuit and potential federal action will significantly impact property valuations and investment strategies in one of the world's most expensive real estate markets.</p>`;
      
      await db.run(`
        INSERT INTO articles (title, slug, content, excerpt, author_id, category_id, status, featured_image, seo_title, seo_description, seo_keywords, reading_time)
        VALUES (?, ?, ?, ?, 1, 1, 'published', ?, ?, ?, ?, 3)
      `, [
        "Trump Explores Federal Legal Challenge Against New York's Luxury \"Pied-à-Terre\" Tax",
        "trump-federal-challenge-new-york-luxury-pied-a-terre-tax",
        content,
        "President Donald Trump is assessing whether the federal government can intervene to block New York City's controversial new \"pied-à-terre\" tax on luxury second homes, describing the policy as a \"dangerous political experiment.\"",
        "/images/nyc_luxury_tax_gavel.jpg",
        "Trump Considers Federal Legal Challenge to NY Luxury Second Home Tax",
        "President Donald Trump announced he is evaluating federal legal action to block New York City's new pied-à-terre tax on non-primary luxury homes, citing economic concerns.",
        "Trump New York tax challenge, pied-a-terre tax NYC, luxury second home tax, federal intervention NY taxes, Zohran Mamdani, real estate tax news 2026, non-resident property tax"
      ]);
      console.log('✅ Inserted Trump NYC Tax article on startup.');
    }
  } catch(e) {
    console.error('Error inserting Trump article:', e);
  }
}

async function startServer() {
  try {
    await initializeDatabase();
    await fixImagePaths();
    await insertTrumpArticle();
    app.listen(PORT, () => {
      console.log(`\n🚀 Tax Clearance is running at http://localhost:${PORT}`);
      console.log(`📊 Admin panel: http://localhost:${PORT}/admin`);
      console.log(`👤 Login: admin / TaxClearance2024!\n`);
    });
  } catch (err) {
    console.error('Fatal database initialization error:', err);
    process.exit(1);
  }
}

startServer();
