require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const app = express();

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

const { initializeDatabase } = require('./database/db');
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await initializeDatabase();
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
