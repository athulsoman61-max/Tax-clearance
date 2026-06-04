// ═══════════════════════════════════════════════════════════
// Tax Clearance — Universal Client JavaScript (main.js)
// ═══════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ─── Navbar Scroll Effect ───────────────────────────────────
  const navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });
  }

  // ─── Mobile Menu Toggle ─────────────────────────────────────
  const navToggle = document.getElementById('navToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  if (navToggle && mobileMenu) {
    navToggle.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
    });
    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!navToggle.contains(e.target) && !mobileMenu.contains(e.target)) {
        mobileMenu.classList.remove('open');
      }
    });
  }

  // ─── Search Overlay ─────────────────────────────────────────
  const searchOverlay = document.getElementById('searchOverlay');
  const searchInput   = document.getElementById('searchInput');
  const searchResultsLive = document.getElementById('searchResultsLive');

  function openSearch() {
    searchOverlay?.classList.add('open');
    setTimeout(() => searchInput?.focus(), 100);
    document.body.style.overflow = 'hidden';
  }

  function closeSearch() {
    searchOverlay?.classList.remove('open');
    document.body.style.overflow = '';
    if (searchResultsLive) searchResultsLive.style.display = 'none';
  }

  document.getElementById('searchBtn')?.addEventListener('click', openSearch);
  document.getElementById('searchClose')?.addEventListener('click', closeSearch);

  searchOverlay?.addEventListener('click', (e) => {
    if (e.target === searchOverlay) closeSearch();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSearch();
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openSearch();
    }
  });

  // ─── Live Search ────────────────────────────────────────────
  let searchTimer;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) {
      if (searchResultsLive) searchResultsLive.style.display = 'none';
      return;
    }
    searchTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const results = await res.json();
        if (!searchResultsLive) return;
        if (results.length === 0) {
          searchResultsLive.style.display = 'none';
          return;
        }
        searchResultsLive.innerHTML = results.map(r => `
          <a href="/article/${r.slug}" class="search-result-item">
            ${r.featured_image
              ? `<img src="${r.featured_image}" alt="${escapeHtml(r.title)}" class="search-result-img" loading="lazy">`
              : `<div class="search-result-img" style="background:var(--navy-600);display:flex;align-items:center;justify-content:center;font-size:1.2rem">📋</div>`
            }
            <div>
              <div class="search-result-title">${escapeHtml(r.title)}</div>
              <div class="search-result-cat">${escapeHtml(r.category_name || 'Tax')}</div>
            </div>
          </a>
        `).join('') + `<a href="/search?q=${encodeURIComponent(q)}" class="search-result-item" style="justify-content:center;color:var(--indigo-400);font-size:0.85rem;font-weight:600;">View all results →</a>`;
        searchResultsLive.style.display = 'block';
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 280);
  });

  // ─── Scroll Reveal ──────────────────────────────────────────
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // ─── Toast System ────────────────────────────────────────────
  window.showToast = function(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  };

  // ─── Newsletter Forms ─────────────────────────────────────────
  async function submitNewsletter(form) {
    const fd = new FormData(form);
    try {
      const res = await fetch('/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fd).toString()
      });
      const data = await res.json();
      window.showToast(data.message, data.success ? 'success' : 'error');
      if (data.success) form.reset();
    } catch {
      window.showToast('Something went wrong. Please try again.', 'error');
    }
  }

  document.getElementById('footerNewsletter')?.addEventListener('submit', (e) => {
    e.preventDefault();
    submitNewsletter(e.target);
  });

  document.getElementById('sidebarNewsletter')?.addEventListener('submit', (e) => {
    e.preventDefault();
    submitNewsletter(e.target);
  });

  // ─── Infinite Scroll (Homepage Feed) ─────────────────────────
  let currentPage = 1;
  let isLoading = false;
  let feedHasMore = !!document.getElementById('loadMoreBtn');

  async function loadMoreArticles() {
    if (isLoading || !feedHasMore) return;
    isLoading = true;

    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const spinner = document.getElementById('feedSpinner');
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    if (spinner) spinner.style.display = 'block';

    try {
      currentPage++;
      const res = await fetch(`/api/articles?page=${currentPage}&per_page=10`);
      const data = await res.json();
      const feed = document.getElementById('articleFeed');

      if (feed && data.articles && data.articles.length > 0) {
        data.articles.forEach(a => {
          const card = buildArticleCard(a);
          feed.appendChild(card);
          revealObserver.observe(card);
        });
      }

      feedHasMore = data.hasMore;
      const container = document.getElementById('loadMoreContainer');

      if (!feedHasMore) {
        if (container) container.innerHTML = '<p style="color:var(--gray-600);font-size:0.85rem;text-align:center;padding:1rem 0;">You\'ve read everything — <a href="/search" style="color:var(--indigo-400)">search for more topics</a></p>';
      } else {
        if (spinner) spinner.style.display = 'none';
        if (loadMoreBtn) loadMoreBtn.style.display = 'inline-flex';
      }
    } catch (err) {
      const spinner = document.getElementById('feedSpinner');
      const loadMoreBtn = document.getElementById('loadMoreBtn');
      if (spinner) spinner.style.display = 'none';
      if (loadMoreBtn) loadMoreBtn.style.display = 'inline-flex';
      console.error('Load more error:', err);
    }
    isLoading = false;
  }

  document.getElementById('loadMoreBtn')?.addEventListener('click', loadMoreArticles);

  // Auto-load on scroll (intersection of load-more container)
  const loadMoreContainer = document.getElementById('loadMoreContainer');
  if (loadMoreContainer) {
    const scrollLoadObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && feedHasMore && !isLoading) {
        loadMoreArticles();
      }
    }, { rootMargin: '400px' });
    scrollLoadObserver.observe(loadMoreContainer);
  }

  // ─── Build Article Card ───────────────────────────────────────
  function buildArticleCard(a) {
    const article = document.createElement('article');
    article.className = 'article-card reveal';
    const dateStr = new Date(a.publish_date || a.created_at)
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const views = (a.views || 0).toLocaleString();

    article.innerHTML = `
      <a href="/article/${a.slug}" class="article-card-img-link">
        <div class="article-card-img">
          ${a.featured_image
            ? `<img src="${a.featured_image}" alt="${escapeHtml(a.title)}" loading="lazy">`
            : `<div class="article-card-placeholder">${a.category_icon || '📋'}</div>`
          }
        </div>
      </a>
      <div class="article-card-body">
        <div class="article-card-meta">
          <span class="article-card-cat" style="background:${a.category_color}22;color:${a.category_color}">
            ${escapeHtml(a.category_name || 'Tax')}
          </span>
          <span class="article-card-date">${dateStr}</span>
          <span class="article-card-read">⏱ ${a.reading_time || 1} min</span>
        </div>
        <h2 class="article-card-title">
          <a href="/article/${a.slug}">${escapeHtml(a.title)}</a>
        </h2>
        <p class="article-card-excerpt">${escapeHtml(a.excerpt || '')}</p>
        <div class="article-card-footer">
          <span class="article-card-views">👁 ${views}</span>
          <a href="/article/${a.slug}" class="read-more-btn">Read More →</a>
        </div>
      </div>
    `;
    return article;
  }

  // ─── Helper: Escape HTML ─────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
