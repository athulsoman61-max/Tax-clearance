const fs = require('fs');

async function publish() {
  const base = "https://tax-clearance.onrender.com";
  
  // Login first
  console.log("Logging in...");
  const loginRes = await fetch(base + '/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'username=admin&password=TaxClearance2024!',
    redirect: 'manual'
  });
  
  let cookie = loginRes.headers.get('set-cookie');
  if (cookie) cookie = cookie.split(';')[0];
  if (!cookie) { console.error("Login failed!"); return; }
  console.log("Logged in successfully.");

  const article = {
    title: "Trump Explores Federal Legal Challenge Against New York's Luxury \"Pied-à-Terre\" Tax",
    slug: "trump-federal-challenge-new-york-luxury-pied-a-terre-tax",
    excerpt: "President Donald Trump is assessing whether the federal government can intervene to block New York City's controversial new \"pied-à-terre\" tax on luxury second homes, describing the policy as a \"dangerous political experiment.\"",
    category_id: 1,
    status: "published",
    seo_title: "Trump Considers Federal Legal Challenge to NY Luxury Second Home Tax",
    seo_description: "President Donald Trump announced he is evaluating federal legal action to block New York City's new pied-à-terre tax on non-primary luxury homes, citing economic concerns.",
    seo_keywords: "Trump New York tax challenge, pied-a-terre tax NYC, luxury second home tax, federal intervention NY taxes, Zohran Mamdani, real estate tax news 2026, non-resident property tax",
    img: "nyc_luxury_tax_gavel.jpg",
    content: `<p>In a move that escalates the ongoing tension between federal and local policy, President Donald Trump has announced he is evaluating whether the federal government can mount a legal challenge against New York City's controversial new tax on luxury second homes.</p>

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

<p>For now, owners of luxury secondary homes in New York City remain in a state of limbo. Tax professionals and real estate advisors are closely monitoring the situation, as the outcome of both the state-level lawsuit and potential federal action will significantly impact property valuations and investment strategies in one of the world's most expensive real estate markets.</p>`
  };

  const payload = {
    title: article.title,
    slug: article.slug,
    content: article.content,
    excerpt: article.excerpt,
    category_id: article.category_id,
    seo_title: article.seo_title,
    seo_description: article.seo_description,
    seo_keywords: article.seo_keywords,
    status: article.status,
    featured_image: article.img,
    author_id: 1
  };

  console.log("Publishing article...");
  const pubRes = await fetch(base + '/admin/article/create', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': cookie
    },
    body: JSON.stringify(payload)
  });

  const text = await pubRes.text();
  if (pubRes.ok && pubRes.url.includes('/admin/articles')) {
    console.log("SUCCESS! Article published.");
  } else {
    console.error("FAILED. Status:", pubRes.status);
    console.error(text.substring(0, 500));
  }
}

publish().catch(console.error);
