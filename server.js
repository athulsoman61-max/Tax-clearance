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

// Image path migration: map known article slugs to committed image files
const IMAGE_FIXES = [
  { match: 'june-jobs-report',          image: '/uploads/june_jobs_report.png' },
  { match: 'us-job-growth',             image: '/uploads/june_jobs_report.png' },
  { match: 'irs-safe-harbor',           image: '/uploads/irs_safe_harbor_photo.png' },
  { match: 'treasury-irs-safe-harbor',  image: '/uploads/irs_safe_harbor_photo.png' },
  { match: 'trump-account',             image: '/uploads/trump_account_tax.png' },
  { match: 'working-families-tax-cuts', image: '/uploads/trump_account_tax.png' },
  { match: 'property-tax-relief',       image: '/uploads/property_tax_relief_photo.png' },
  { match: 'counties-opt-out',          image: '/uploads/property_tax_relief_photo.png' },
  { match: 'ai-risks',                  image: '/uploads/irs_ai_risks_photo.png' },
  { match: 'circular-230',              image: '/uploads/irs_ai_risks_photo.png' },
  { match: 'charitable-contribution',   image: '/uploads/charitable_contributions.png' },
  { match: 'stacking-charitable',       image: '/uploads/charitable_contributions.png' },
  { match: 'obbba',                     image: '/uploads/obbba_tax_bill.png' },
  { match: 'digital-services-tax',      image: '/uploads/digital_tax_concept.png' },
  { match: 'polestar',                  image: '/uploads/polestar_ev_ban.png' },
];

async function fixImagePaths() {
  try {
    const articles = await db.all("SELECT id, slug, featured_image FROM articles WHERE featured_image IS NOT NULL");
    for (const article of articles) {
      // Fix if image path has old random timestamp format OR points to a missing /images/ path
      const needsFix = !article.featured_image || 
        article.featured_image.match(/\/uploads\/\d{13}-\d+/) ||
        (article.featured_image.startsWith('/images/') && !['obbba_tax_bill.png','digital_tax_concept.png','dst_global_map.png','dst_tariffs_trade.png','gift_tax_safe_harbor_2026.png','advocate_report_2026.png','polestar_ev_ban.png'].some(f => article.featured_image.includes(f)));
      if (needsFix) {
        const fix = IMAGE_FIXES.find(f => article.slug.includes(f.match));
        if (fix) {
          await db.run('UPDATE articles SET featured_image = ? WHERE id = ?', [fix.image, article.id]);
          console.log(`🖼️  Fixed image: ${article.slug} => ${fix.image}`);
        }
      }
    }
  } catch (e) {
    console.error('Image path migration error (non-fatal):', e.message);
  }
}

async function startServer() {
  try {
    await initializeDatabase();
    await fixImagePaths();
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
