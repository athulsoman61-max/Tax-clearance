const base = "https://tax-clearance.onrender.com";
async function getStats() {
  const loginRes = await fetch(base + '/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'username=admin&password=TaxClearance2024!',
    redirect: 'manual'
  });
  
  let cookie = loginRes.headers.get('set-cookie');
  if (cookie) cookie = cookie.split(';')[0];

  const res = await fetch(base + '/admin', { headers: { 'Cookie': cookie } });
  const html = await res.text();
  
  const viewsMatch = html.match(/<div class="dash-stat-num">([\d,]+)<\/div>\s*<div class="dash-stat-label">Total Views<\/div>/);
  const articlesMatch = html.match(/<div class="dash-stat-num">([\d,]+)<\/div>\s*<div class="dash-stat-label">Total Articles<\/div>/);
  
  console.log("=== TRAFFIC STATS ===");
  if (viewsMatch) console.log("Total Views:", viewsMatch[1]);
  if (articlesMatch) console.log("Total Articles:", articlesMatch[1]);
}
getStats().catch(console.error);
