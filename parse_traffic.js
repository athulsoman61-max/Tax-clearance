const fs = require('fs');
const html = fs.readFileSync('temp_articles.html', 'utf8');

const regex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
let match;
const articles = [];

while ((match = regex.exec(html)) !== null) {
  const rowHtml = match[1];
  
  const titleMatch = rowHtml.match(/<a href="\/admin\/articles\/\d+\/edit"[^>]*>([\s\S]*?)<\/a>/);
  if (!titleMatch) continue;
  let title = titleMatch[1].trim();
  title = title.replace(/&#39;/g, "'");
  
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
  let tdMatch;
  const tds = [];
  while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
    tds.push(tdMatch[1].replace(/<[^>]+>/g, '').trim());
  }
  
  if (tds.length >= 7) {
    const viewsStr = tds[4];
    const views = parseInt(viewsStr.replace(/,/g, '')) || 0;
    articles.push({ title, views });
  }
}

articles.sort((a, b) => b.views - a.views);

console.log("VIEWS  | TITLE");
console.log("-------|---------------------------------------------------------");
articles.forEach(a => {
  console.log(`${a.views.toString().padEnd(6)} | ${a.title}`);
});
