const fs = require('fs');

async function upload() {
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
  console.log("Cookie:", cookie);

  const data = JSON.parse(fs.readFileSync('new_articles_data.json', 'utf8'));
  
  let ok = 0;
  for (const art of data) {
    console.log(`Uploading: ${art.title}`);
    
    const form = new FormData();
    // Intentionally omitting 'id' to create a NEW article
    form.append('title', art.title);
    form.append('slug', art.slug);
    form.append('content', art.content);
    form.append('excerpt', art.excerpt);
    form.append('category_id', art.cat);
    form.append('status', 'published');
    form.append('seo_title', art.seo_t || '');
    form.append('seo_description', art.seo_d || '');
    form.append('seo_keywords', art.seo_k || '');
    form.append('existing_featured_image', '/img/articles/' + art.img);
    form.append('existing_og_image', '/img/articles/' + art.img);
    
    const saveRes = await fetch(base + '/admin/articles/save', {
      method: 'POST',
      headers: { 'Cookie': cookie },
      body: form,
      redirect: 'manual'
    });
    
    if (saveRes.status === 302) {
      console.log("  ✅ Uploaded successfully.");
      ok++;
    } else {
      console.log("  ⚠️ Upload failed, status:", saveRes.status);
    }
  }
  console.log(`Finished uploading ${ok} new articles!`);
}

upload().catch(console.error);
