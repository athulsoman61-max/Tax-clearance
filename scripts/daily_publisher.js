const fetch = require('node-fetch');
const Parser = require('rss-parser');
const { createClient } = require('@libsql/client');
const { GoogleGenAI } = require('@google/genai');
const slugify = require('slugify');

async function run() {
  console.log('Starting automated daily publisher...');

  // 1. Fetch RSS Feed
  console.log('Fetching latest tax news...');
  const parser = new Parser();
  const feed = await parser.parseURL('https://taxfoundation.org/feed/');
  const latestArticle = feed.items[0];

  if (!latestArticle) {
    throw new Error('No articles found in RSS feed.');
  }

  console.log(`Found trending article: ${latestArticle.title}`);

  // 2. Initialize APIs
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const pexelsKey = process.env.PEXELS_API_KEY;

  // 3. Generate Content with Gemini
  console.log('Generating unique SEO article with Gemini...');
  const prompt = `
    You are a professional Enrolled Agent and tax blogger writing for "Tax Clearance".
    Write a highly professional, 100% original, SEO-optimized news article based on the following news:
    Title: ${latestArticle.title}
    Content Snippet: ${latestArticle.contentSnippet || latestArticle.summary}
    Link: ${latestArticle.link}
    
    Rules:
    - Do NOT copy the original article. Write it completely in your own words.
    - Format the response as a JSON object containing:
      {
        "title": "A catchy, SEO-friendly title",
        "excerpt": "A 2-sentence summary",
        "content": "The full article in HTML format (use <p>, <h2>, <ul>)",
        "seo_description": "A meta description",
        "seo_keywords": "comma, separated, keywords",
        "image_search_query": "A 1-2 word search term to find a related photograph on Pexels (e.g. 'taxes', 'money', 'business', 'law')"
      }
    - ONLY output the JSON, no markdown formatting blocks.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
        responseMimeType: "application/json",
    }
  });

  const generated = JSON.parse(response.text);
  const slug = slugify(generated.title, { lower: true, strict: true });
  console.log('Successfully generated article content!');

  // 4. Fetch Real Image from Pexels
  console.log(`Searching Pexels for image using query: ${generated.image_search_query}...`);
  let imageUrl = '/images/default_tax_image.jpg';
  
  if (pexelsKey) {
    const pexelsRes = await fetch(`https://api.pexels.com/v1/search?query=${generated.image_search_query}&per_page=1`, {
      headers: { Authorization: pexelsKey }
    });
    const pexelsData = await pexelsRes.json();
    if (pexelsData.photos && pexelsData.photos.length > 0) {
      imageUrl = pexelsData.photos[0].src.large;
      console.log('Found real photograph on Pexels!');
    } else {
      console.log('No Pexels image found, using default.');
    }
  } else {
    console.log('PEXELS_API_KEY not provided, using default image.');
  }

  // 5. Connect to Turso and Insert
  console.log('Connecting to Turso Database...');
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });

  // Check if article exists
  const existing = await db.execute({
    sql: "SELECT id FROM articles WHERE slug = ?",
    args: [slug]
  });

  if (existing.rows.length > 0) {
    console.log('Article already exists in database. Skipping.');
    return;
  }

  console.log('Publishing article to database...');
  await db.execute({
    sql: \`INSERT INTO articles (title, slug, content, excerpt, author_id, category_id, status, featured_image, seo_title, seo_description, seo_keywords, reading_time, publish_date, views)
          VALUES (?, ?, ?, ?, 1, 1, 'published', ?, ?, ?, ?, 4, CURRENT_TIMESTAMP, 500)\`,
    args: [
      generated.title,
      slug,
      generated.content,
      generated.excerpt,
      imageUrl,
      generated.title,
      generated.seo_description,
      generated.seo_keywords
    ]
  });

  console.log('✅ Successfully published daily automated article!');
}

run().catch(err => {
  console.error('Failed to run daily publisher:', err);
  process.exit(1);
});
