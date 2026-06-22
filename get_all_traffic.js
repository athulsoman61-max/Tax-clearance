const fs = require('fs');

async function getAll() {
  const base = "https://tax-clearance.onrender.com";
  const loginRes = await fetch(base + '/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'username=admin&password=TaxClearance2024!',
    redirect: 'manual'
  });
  
  let cookie = loginRes.headers.get('set-cookie');
  if (cookie) cookie = cookie.split(';')[0];

  let allArticles = [];
  
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(base + '/admin/articles?page=' + page, { headers: { 'Cookie': cookie } });
    const html = await res.text();
    
    const regex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let match;
    let count = 0;
    while ((match = regex.exec(html)) !== null) {
      const rowHtml = match[1];
      const titleMatch = rowHtml.match(/<a href="\/admin\/articles\/\d+\/edit"[^>]*>([\s\S]*?)<\/a>/);
      if (!titleMatch) continue;
      let title = titleMatch[1].trim().replace(/&#39;/g, "'");
      
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
      let tdMatch;
      const tds = [];
      while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
        tds.push(tdMatch[1].replace(/<[^>]+>/g, '').trim());
      }
      if (tds.length >= 7) {
        const viewsStr = tds[4];
        const views = parseInt(viewsStr.replace(/,/g, '')) || 0;
        // avoid duplicates
        if (!allArticles.find(a => a.title === title)) {
          allArticles.push({ title, views });
          count++;
        }
      }
    }
    if (count === 0) break;
  }
  
  allArticles.sort((a, b) => b.views - a.views);

  let out = "| Views | Article Title |\n";
  out += "|---|---|\n";
  allArticles.forEach(a => {
    out += `| **${a.views.toLocaleString()}** | ${a.title} |\n`;
  });
  
  fs.writeFileSync('C:\\Users\\athul\\.gemini\\antigravity\\brain\\cfe43fa5-fd06-407d-9a00-a5f3c2b73a84\\traffic_report.md', out);
  console.log("Saved traffic report.");
}

getAll().catch(console.error);
