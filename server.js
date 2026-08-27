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
      if (exists) {
        await db.run("UPDATE articles SET publish_date = CURRENT_TIMESTAMP, views = 1500 WHERE slug = 'trump-federal-challenge-new-york-luxury-pied-a-terre-tax'");
        console.log('✅ Updated Trump NYC Tax article to appear in feeds.');
      } else {
        await db.run(`
          INSERT INTO articles (title, slug, content, excerpt, author_id, category_id, status, featured_image, seo_title, seo_description, seo_keywords, reading_time, publish_date, views)
          VALUES (?, ?, ?, ?, 1, 1, 'published', ?, ?, ?, ?, 3, CURRENT_TIMESTAMP, 1500)
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
        console.log('✅ Inserted Trump NYC Tax article on startup with current timestamp and 1500 views.');
      }

      const slug2 = 'trump-legal-challenge-nyc-luxury-second-home-tax-guide';
      const exists2 = await db.get("SELECT id FROM articles WHERE slug = ?", [slug2]);
      if (!exists2) {
        const content2 = `<p>New York City’s new tax on certain high-value non-primary residences has quickly become the center of a legal and political dispute.</p>
<p>President Donald Trump said he was assessing whether the federal government could mount a legal challenge against the city’s new "pied-à-terre" surcharge, while a separate lawsuit by New York City homeowners has already resulted in a temporary court order affecting the rollout of the program.</p>
<p>The controversy raises an important question for wealthy homeowners and real estate investors: <em>What happens when a local property tax becomes the subject of a federal legal challenge?</em></p>
<p>Here is what taxpayers and property owners should understand about the new NYC surcharge, the current legal dispute, and what could happen next.</p>
<h2>What Is the NYC Pied-à-Terre Tax?</h2>
<p>The tax is an annual surcharge on certain residential properties in New York City that are not used as the owner's primary residence. The policy was designed to increase taxes on high-value secondary residences, particularly properties owned by people whose primary residence is outside New York City.</p>
<p>According to New York City’s Department of Finance, the surcharge can apply during the 2026–27 and 2027–28 property tax years to:</p>
<ul>
  <li>One-, two-, and three-family homes valued at $5 million or more</li>
  <li>Condominiums and cooperative units valued at $1 million or more</li>
</ul>
<p>The surcharge generally does not apply when the property qualifies as a primary residence under the applicable rules or falls within certain exemptions. The city estimates that the tax could generate substantial additional revenue, with earlier analysis from the NYC Comptroller estimating the program could potentially raise around $500 million annually.</p>
<h2>Why Is Trump Considering a Legal Challenge?</h2>
<p>Trump criticized the new surcharge and said his administration was examining whether the federal government could challenge it. That does not mean the federal government has already filed a lawsuit or that the tax has been declared unconstitutional. At this stage, the issue is whether the federal government has a legal basis to intervene against a tax created and administered at the state and local level.</p>
<p>That distinction matters. A presidential statement about potentially challenging a tax is different from an actual federal lawsuit, injunction, or court ruling. For property owners, the practical question is therefore not simply whether Trump opposes the tax, but whether a court ultimately determines that the tax or its implementation violates applicable law.</p>
<h2>A Separate Lawsuit Has Already Put the Rollout Under Pressure</h2>
<p>The federal discussion comes as the NYC tax is already facing a separate legal challenge from property owners. A Staten Island judge temporarily blocked aspects of the city's rollout after homeowners challenged the way the program was being implemented. The lawsuit focuses on the city's process for identifying potentially affected properties and notifying owners.</p>
<p>The dispute is significant because some property owners who say their homes are actually their primary residences received notices indicating that their properties could be subject to the surcharge. The temporary court action therefore concerns not only the tax itself, but also how the city identified properties and placed the burden on owners to establish that they qualified for an exemption.</p>
<h2>Who Could Be Affected?</h2>
<p>The tax is aimed at a relatively narrow group of property owners. A typical homeowner with an ordinary primary residence is generally outside the intended scope of the surcharge. For the 2026–27 and 2027–28 property tax years, NYC lists the following general thresholds:</p>
<h3>One-, Two-, and Three-Family Homes</h3>
<p>Properties valued by the Department of Finance at:</p>
<ul>
  <li>$5 million or more but less than $15 million — 0.8%</li>
  <li>$15 million or more but less than $25 million — 1.05%</li>
  <li>$25 million or more — 1.3%</li>
</ul>
<h3>Condominiums and Cooperatives</h3>
<p>For the current property tax years, NYC states that the surcharge may apply to condominium and cooperative units with a Department of Finance value of $1 million or more. This distinction is important because the valuation methodology for different types of residential property is not identical.</p>
<h2>Is Every Second Home Taxed?</h2>
<p>No. Calling the measure a "second-home tax" can make the rule sound broader than it actually is. The key issue is whether the property is considered a non-primary residence under the applicable NYC rules.</p>
<p>The city says the surcharge generally does not apply when the property is used as a primary residence by:</p>
<ul>
  <li>The owner</li>
  <li>A qualifying tenant</li>
  <li>An immediate family member of the owner</li>
  <li>Certain individuals with a majority interest in an entity owning the property</li>
</ul>
<p>The exact exemption requirements matter, which means property owners should not assume that simply calling a property a primary residence is sufficient. Documentation can become important if the Department of Finance questions the property's status.</p>
<h2>Why the Primary-Residence Question Matters</h2>
<p>The current legal dispute highlights a broader issue in property taxation: <em>How does the government determine whether a luxury property is actually a primary residence?</em></p>
<p>A property owner might own a high-value apartment but maintain another home elsewhere. Another owner might have a New York City property that is legitimately their primary residence but still receive a notice because the property appears on a potentially affected list. That is why documentation can become critical. Taxpayers may need records supporting where they actually live, how the property is used, and whether another property is treated as their primary residence.</p>
<h2>What Should Property Owners Do Now?</h2>
<p>The current legal uncertainty does not mean property owners should ignore notices from the NYC Department of Finance. The Department of Finance says owners who received a notice and believe they are exempt must respond by the deadline stated in the notice and provide information supporting the exemption.</p>
<p>For the current cycle, NYC lists <strong>August 21, 2026</strong> as the deadline for residential homes and condos, and <strong>August 24, 2026</strong> for cooperative units.</p>
<p>Property owners should therefore:</p>
<ul>
  <li>Review the notice carefully.</li>
  <li>Determine how the property is classified.</li>
  <li>Confirm the property's Department of Finance valuation.</li>
  <li>Review whether a primary-residence or other exemption applies.</li>
  <li>Gather supporting documentation.</li>
  <li>Respond within the applicable deadline.</li>
  <li>Monitor the ongoing court proceedings.</li>
</ul>
<h2>What Could Happen Next?</h2>
<p>Several outcomes remain possible:</p>
<ul>
  <li>The courts could allow the NYC program to continue substantially as designed.</li>
  <li>The city could be required to modify how it identifies properties or communicates with owners.</li>
  <li>The litigation could produce additional guidance about exemptions and the government's burden of proof.</li>
  <li>Separately, the federal government could decide whether to pursue its own legal challenge.</li>
</ul>
<p>At this point, it is important to distinguish between what has already happened and what remains hypothetical. The NYC surcharge exists, the rollout has faced a state-court challenge, and Trump has said he is considering possible federal action. But the ultimate legal outcome has not yet been determined.</p>
<h2>Why This Matters Beyond New York</h2>
<p>The dispute could become an important case study in how cities attempt to tax high-value residential property. If the program survives, other jurisdictions could look at similar approaches to raising revenue from expensive secondary residences.</p>
<h2>Final Takeaway</h2>
<p>New York City's luxury second-home tax is no longer just a tax-policy debate. It is now a developing legal dispute involving property owners, New York City officials, state courts, and potentially the federal government.</p>
<p>For affected homeowners, the most important step is not to assume that the tax will disappear because of the current litigation. Instead, review the applicable rules, understand your property's classification, preserve supporting records, and pay attention to official notices and court developments.</p>`;

        await db.run(`
          INSERT INTO articles (title, slug, content, excerpt, author_id, category_id, status, featured_image, seo_title, seo_description, seo_keywords, reading_time, publish_date, views)
          VALUES (?, ?, ?, ?, 1, 1, 'published', ?, ?, ?, ?, 5, CURRENT_TIMESTAMP, 1800)
        `, [
          "Trump Considers Legal Challenge to New York City’s Luxury Second-Home Tax: What Property Owners Need to Know",
          slug2,
          content2,
          "New York City’s new tax on high-value non-primary residences has become the center of a legal and political dispute. Here is what taxpayers and property owners should understand about the NYC surcharge and what could happen next.",
          "/images/nyc_luxury_condos.jpg",
          "Trump Legal Challenge NYC Luxury Second-Home Tax Guide",
          "A comprehensive guide for property owners on the NYC pied-à-terre tax, exemptions, deadlines, and the potential federal legal challenge being considered by Donald Trump.",
          "NYC pied-a-terre tax guide, Trump NY luxury tax challenge, second home tax NYC exemptions, property tax NYC 2026, Zohran Mamdani tax"
        ]);
        console.log('✅ Inserted NYC Condos guide article.');
      }

      const slug3 = 'maryland-digital-ad-tax-invalidated-2026-analysis';
      const exists3 = await db.get("SELECT id FROM articles WHERE slug = ?", [slug3]);
      if (!exists3) {
        const content3 = `<p>In a landmark decision that could reverberate across the country, the Maryland Tax Court has officially invalidated the state's pioneering <strong>Digital Advertising Gross Revenues Tax</strong>. The ruling strikes down what was widely considered a test case for state-level taxation of digital economy giants.</p>

<p>The court concluded that the tax, which levied a surcharge on revenue generated from digital advertising within the state, violated both the federal <strong>Internet Tax Freedom Act (ITFA)</strong> and the U.S. Constitution's Commerce Clause.</p>

<h2>The Origins of the Digital Ad Tax</h2>

<p>Enacted amidst significant controversy, Maryland was the first state in the U.S. to pass a tax specifically targeting digital advertising revenue. The tax applied primarily to large technology companies—such as Google, Meta, and Amazon—that derive substantial income from targeted online ads displayed to users located in Maryland.</p>

<p>The core argument from state lawmakers was that these massive digital platforms were profiting immensely from Maryland residents' data and attention, yet paying disproportionately little in state corporate taxes compared to traditional businesses with physical footprints.</p>

<h2>Why the Court Struck It Down</h2>

<p>The court's decision hinged on two primary legal hurdles that critics of the tax have cited since its inception:</p>

<ul>
  <li><strong>The Internet Tax Freedom Act (ITFA):</strong> The ITFA prohibits states from imposing "discriminatory taxes on electronic commerce." The court agreed with the plaintiffs that Maryland's law unfairly singled out digital advertising for taxation while leaving traditional offline advertising (like print, radio, and television) untaxed.</li>
  <li><strong>The Commerce Clause:</strong> The ruling also noted that the tax inherently burdened interstate commerce. Because digital advertising operates seamlessly across state lines, calculating the exact portion of revenue derived "within Maryland" proved highly complex, and the tax's structure was found to penalize companies based on their out-of-state operations.</li>
</ul>

<h2>A Blueprint for Legal Challenges</h2>

<p>Tax experts and legal scholars are already analyzing the Maryland decision as a definitive roadmap for fighting similar legislation. In recent years, several other states—including New York, Massachusetts, and Texas—have explored or introduced bills mirroring Maryland's approach.</p>

<p>This ruling sets a powerful precedent. States attempting to tax the digital economy will now have to navigate the strict boundaries set by the ITFA, ensuring that any new digital tax cannot be construed as discriminating against electronic commerce in favor of traditional commerce.</p>

<h2>What Happens Next?</h2>

<p>The state of Maryland is expected to appeal the decision, meaning the legal battle may ultimately reach the state's highest court, or potentially even the federal courts, given the constitutional and ITFA questions involved.</p>

<p>For now, large tech platforms have secured a significant victory. Meanwhile, state governments facing budget shortfalls will need to return to the drawing board to find constitutionally sound methods for taxing the evolving digital landscape.</p>`;

        await db.run(`
          INSERT INTO articles (title, slug, content, excerpt, author_id, category_id, status, featured_image, seo_title, seo_description, seo_keywords, reading_time, publish_date, views)
          VALUES (?, ?, ?, ?, 1, 1, 'published', ?, ?, ?, ?, 4, CURRENT_TIMESTAMP, 1200)
        `, [
          "Maryland's Pioneering Digital Ad Tax Invalidated by Tax Court",
          slug3,
          content3,
          "The Maryland Tax Court has struck down the state's digital advertising gross revenues tax, citing violations of the Internet Tax Freedom Act and the U.S. Constitution.",
          "/images/maryland_digital_ad_tax.jpg",
          "Maryland Digital Ad Tax Invalidated | ITFA Ruling 2026",
          "The Maryland Tax Court has invalidated the state's controversial digital advertising tax, setting a major precedent for state-level taxation of tech giants.",
          "Maryland digital ad tax, ITFA violation, Internet Tax Freedom Act, digital advertising tax ruling, state digital taxes 2026, tech company taxes"
        ]);
        console.log('✅ Inserted Maryland Digital Ad Tax article.');
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
