const fs = require('fs');

async function fix() {
  const base = "https://tax-clearance.onrender.com";
  const loginRes = await fetch(base + '/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'username=admin&password=TaxClearance2024!',
    redirect: 'manual'
  });
  
  let cookie = loginRes.headers.get('set-cookie');
  if (cookie) cookie = cookie.split(';')[0];

  const data = JSON.parse(fs.readFileSync('articles_data.json', 'utf8'));
  const art = data[4];
  
  const id = 13;
  console.log(`Updating ID ${id}: ${art.title}`);
  
  const form = new FormData();
  form.append('id', id);
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
    console.log("  ✅ Updated successfully.");
  } else {
    console.log("  ⚠️ Update failed, status:", saveRes.status);
  }
}

fix().catch(console.error);
