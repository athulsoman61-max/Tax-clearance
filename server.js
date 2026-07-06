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

// All known committed images in public/uploads/
const SLUG_IMAGE_MAP = [
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
    // Strip leading slash so path.join doesn't treat it as an absolute path root
    let normalizedPath = imgPath.startsWith('/') ? imgPath.slice(1) : imgPath;
    // If it's just a filename with no directory, assume images/
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
      // Skip if current file actually exists on disk
      if (cur && fileExists(cur)) continue;

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
