/**
 * script.js - الوظائف العامة لمدونة HeSale
 * لا يحتوي على أي إشارة للوحة التحكم
 */

const BlogStorage = {
  KEYS: {
    POSTS: 'hesale_posts_v2',
    ADS: 'hesale_ads',
    ANALYTICS: 'hesale_analytics',
    SETTINGS: 'hesale_settings_v2',
    AUTH: 'hesale_auth',
    CSRF: 'hesale_csrf',
    THEME: 'hesale_theme',
    ACTIVITY_LOG: 'hesale_activity_log',
    BACKUP: 'hesale_backup'
  },
  get(key, fb = null) {
    try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fb; } catch { return fb; }
  },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
  remove(key) { localStorage.removeItem(key); }
};

/* ========== الأمان ========== */
const Security = {
  escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },
  sanitizeHtml(html) {
    const allowed = ['p','br','strong','em','u','b','i','h1','h2','h3','h4','h5','ul','ol','li','a','code','pre','blockquote','img','span','div','figure','figcaption','table','thead','tbody','tr','th','td'];
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const walk = (node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (!allowed.includes(node.tagName.toLowerCase())) {
          node.replaceWith(...node.childNodes);
          return;
        }
        [...node.attributes].forEach(attr => {
          const n = attr.name.toLowerCase();
          if (n.startsWith('on') || (n === 'href' && attr.value.trim().toLowerCase().startsWith('javascript:')))
            node.removeAttribute(attr.name);
        });
      }
      [...node.childNodes].forEach(walk);
    };
    [...temp.childNodes].forEach(walk);
    return temp.innerHTML;
  },
  generateCSRFToken() {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    BlogStorage.set(BlogStorage.KEYS.CSRF, { token, created: Date.now() });
    return token;
  },
  validateCSRFToken(token) {
    const s = BlogStorage.get(BlogStorage.KEYS.CSRF);
    if (!s || !token) return false;
    return s.token === token && Date.now() - s.created < 86400000;
  },
  async hashPassword(pw) {
    if (typeof bcrypt !== 'undefined') return bcrypt.hashSync(pw, 10);
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw + 'hesale_salt'));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  },
  async verifyPassword(pw, hash) {
    if (typeof bcrypt !== 'undefined' && hash?.startsWith('$2')) return bcrypt.compareSync(pw, hash);
    return (await this.hashPassword(pw)) === hash;
  }
};

/* ========== تهيئة البيانات ========== */
async function initializeData() {
  if (!BlogStorage.get(BlogStorage.KEYS.SETTINGS)) {
    try {
      const r = await fetch('settings.json');
      BlogStorage.set(BlogStorage.KEYS.SETTINGS, r.ok ? await r.json() : getDefaultSettings());
    } catch { BlogStorage.set(BlogStorage.KEYS.SETTINGS, getDefaultSettings()); }
  }
  if (!BlogStorage.get(BlogStorage.KEYS.POSTS)) {
    try {
      const r = await fetch('posts.json');
      const data = await r.json();
      BlogStorage.set(BlogStorage.KEYS.POSTS, Array.isArray(data) ? { posts: data } : data);
    } catch { BlogStorage.set(BlogStorage.KEYS.POSTS, { posts: [] }); }
  }
  if (!BlogStorage.get(BlogStorage.KEYS.ADS)) {
    try {
      const r = await fetch('ads.json');
      BlogStorage.set(BlogStorage.KEYS.ADS, r.ok ? await r.json() : getDefaultAds());
    } catch { BlogStorage.set(BlogStorage.KEYS.ADS, getDefaultAds()); }
  }
  if (!BlogStorage.get(BlogStorage.KEYS.ANALYTICS)) {
    BlogStorage.set(BlogStorage.KEYS.ANALYTICS, {
      analytics: { totalViews: 0, dailyViews: [], postViews: [], keywordHits: {}, comments: 0, bounceRate: 42 }
    });
  }
  if (!BlogStorage.get(BlogStorage.KEYS.AUTH)) {
    BlogStorage.set(BlogStorage.KEYS.AUTH, {
      username: 'hesale_admin',
      email: 'admin@hesale.blog',
      passwordHash: await Security.hashPassword('HeSale@2024!'),
      rememberMe: false
    });
  }
  applyThemeColors();
  setupAutoBackup();
}

function getDefaultSettings() {
  return { blogName: 'HeSale', blogNameAr: 'سيل', blogDescription: 'مدونة HeSale — مقالات متنوعة عن الحياة والسفر والترفيه', blogLogo: '⚡', blogKeywords: 'HeSale, سيل, مدونة, منوعات', primaryColor: '#0F172A', secondaryColor: '#3B82F6', accentColor: '#10B981', author: 'فريق HeSale', authorBio: 'نكتب عن كل ما يهمك في الحياة اليومية', authorImage: '', googleAdSenseId: '', googleAnalyticsId: '', socialLinks: {}, siteUrl: 'https://hesale.blog' };
}

function getDefaultAds() {
  return { ads: [{ id: 'ad-slot-1', name: 'Ad Slot 1', type: 'custom-html', code: '<div class="ad-placeholder"><span>إعلان</span></div>', placement: 'sidebar', enabled: true, width: '300px', height: '250px' }] };
}

function setupAutoBackup() {
  const last = parseInt(localStorage.getItem('hesale_last_backup') || '0');
  if (Date.now() - last > 3600000) {
    const backup = { posts: BlogStorage.get(BlogStorage.KEYS.POSTS), settings: BlogStorage.get(BlogStorage.KEYS.SETTINGS), ads: BlogStorage.get(BlogStorage.KEYS.ADS), analytics: BlogStorage.get(BlogStorage.KEYS.ANALYTICS), at: new Date().toISOString() };
    BlogStorage.set(BlogStorage.KEYS.BACKUP, backup);
    localStorage.setItem('hesale_last_backup', Date.now().toString());
  }
}

/* ========== الإعدادات ========== */
const SettingsManager = {
  get() { return BlogStorage.get(BlogStorage.KEYS.SETTINGS, getDefaultSettings()); },
  update(u) {
    const m = { ...this.get(), ...u };
    BlogStorage.set(BlogStorage.KEYS.SETTINGS, m);
    applyThemeColors(m);
    return m;
  }
};

/* ========== المقالات ========== */
const PostsManager = {
  getAll() { return BlogStorage.get(BlogStorage.KEYS.POSTS, { posts: [] }).posts || []; },
  getPublished() { return this.getAll().filter(p => p.status === 'published'); },
  getById(id) { return this.getAll().find(p => p.id === parseInt(id)); },
  getBySlug(slug) { return this.getAll().find(p => p.slug === slug); },
  getFeatured(n = 3) { return this.getPublished().filter(p => p.featured).slice(0, n); },
  getLatest(n = 12) { return this.getPublished().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, n); },
  getPaginated(page = 1, perPage = 12) {
    const all = this.getPublished().sort((a, b) => new Date(b.date) - new Date(a.date));
    const total = Math.ceil(all.length / perPage);
    const start = (page - 1) * perPage;
    return { posts: all.slice(start, start + perPage), totalPages: total, currentPage: page, total: all.length };
  },
  getByCategory(cat, page = 1, perPage = 12) {
    const all = this.getPublished().filter(p => p.category === cat).sort((a, b) => new Date(b.date) - new Date(a.date));
    const total = Math.ceil(all.length / perPage);
    const start = (page - 1) * perPage;
    return { posts: all.slice(start, start + perPage), totalPages: total, currentPage: page, total: all.length };
  },
  getMostViewed(n = 5) { return this.getPublished().sort((a, b) => b.views - a.views).slice(0, n); },
  getRelated(post, n = 4) {
    return this.getPublished().filter(p => p.id !== post.id && (p.category === post.category || p.tags?.some(t => post.tags?.includes(t)))).slice(0, n);
  },
  getCategories() {
    const c = {};
    this.getPublished().forEach(p => { c[p.category] = (c[p.category] || 0) + 1; });
    return c;
  },
  calcReadTime(content) {
    const words = (content || '').replace(/<[^>]+>/g, '').split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
  },
  create(post) {
    const posts = this.getAll();
    const id = posts.reduce((m, p) => Math.max(m, p.id), 0) + 1;
    const np = { ...post, id, slug: post.slug || generateSlug(post.title), views: 0, readTime: this.calcReadTime(post.content), date: post.date || new Date().toISOString() };
    posts.push(np);
    BlogStorage.set(BlogStorage.KEYS.POSTS, { posts });
    logActivity('create', `مقالة جديدة: ${np.title}`);
    return np;
  },
  update(id, updates) {
    const posts = this.getAll();
    const i = posts.findIndex(p => p.id === parseInt(id));
    if (i < 0) return null;
    if (updates.content) updates.readTime = this.calcReadTime(updates.content);
    posts[i] = { ...posts[i], ...updates };
    if (updates.title && !updates.slug) posts[i].slug = generateSlug(updates.title);
    BlogStorage.set(BlogStorage.KEYS.POSTS, { posts });
    logActivity('update', `تعديل: ${posts[i].title}`);
    return posts[i];
  },
  delete(id) {
    const p = this.getById(id);
    BlogStorage.set(BlogStorage.KEYS.POSTS, { posts: this.getAll().filter(p => p.id !== parseInt(id)) });
    logActivity('delete', `حذف: ${p?.title}`);
  },
  incrementViews(id) {
    const p = this.getById(id);
    if (p) {
      this.update(id, { views: p.views + 1 });
      HeSaleAnalytics.trackPageView(id, p.title);
      HeSaleAnalytics.trackKeywords(p.tags);
    }
  },
  search(query, filters = {}) {
    let r = filters.includeDrafts ? this.getAll() : this.getPublished();
    if (query) {
      const q = query.toLowerCase();
      r = r.filter(p => p.title.toLowerCase().includes(q) || p.excerpt.toLowerCase().includes(q) || p.tags?.some(t => t.toLowerCase().includes(q)));
    }
    if (filters.categories?.length) r = r.filter(p => filters.categories.includes(p.category));
    if (filters.dateFrom) r = r.filter(p => p.date >= filters.dateFrom);
    if (filters.dateTo) r = r.filter(p => p.date <= filters.dateTo);
    if (filters.status) r = r.filter(p => p.status === filters.status);
    const sort = filters.sort || 'newest';
    if (sort === 'newest') r.sort((a, b) => new Date(b.date) - new Date(a.date));
    else if (sort === 'oldest') r.sort((a, b) => new Date(a.date) - new Date(b.date));
    else if (sort === 'views') r.sort((a, b) => b.views - a.views);
    return r;
  }
};

function generateSlug(title) {
  return title.trim().replace(/\s+/g, '-').replace(/[^\u0600-\u06FFa-zA-Z0-9\-]/g, '').toLowerCase() || 'post-' + Date.now();
}

function logActivity(action, detail) {
  const log = BlogStorage.get(BlogStorage.KEYS.ACTIVITY_LOG, []);
  log.unshift({ action, detail, at: new Date().toISOString() });
  BlogStorage.set(BlogStorage.KEYS.ACTIVITY_LOG, log.slice(0, 100));
}

/* ========== الإعلانات ========== */
const AdsManager = {
  getAll() { return BlogStorage.get(BlogStorage.KEYS.ADS, { ads: [] }).ads || []; },
  getById(id) { return this.getAll().find(a => a.id === id); },
  update(id, u) {
    const ads = this.getAll();
    const i = ads.findIndex(a => a.id === id);
    if (i < 0) return null;
    ads[i] = { ...ads[i], ...u };
    BlogStorage.set(BlogStorage.KEYS.ADS, { ads });
    return ads[i];
  },
  renderAd(slotId) {
    const ad = this.getById(slotId);
    if (!ad?.enabled) return '';
    let code = ad.code;
    const s = SettingsManager.get();
    if (ad.type === 'google-adsense' && s.googleAdSenseId)
      code = code.replace(/\{\{ADSENSE_ID\}\}/g, Security.escapeHtml(s.googleAdSenseId));
    return `<div class="ad-container" data-ad="${Security.escapeHtml(ad.id)}" style="max-width:100%;min-height:${Security.escapeHtml(ad.height)}">${code}</div>`;
  },
  insertAdsInContent(content, slots = ['ad-slot-2', 'ad-slot-3']) {
    const text = content.replace(/<[^>]+>/g, '');
    const words = text.split(/\s+/).filter(Boolean);
    let result = content;
    const targets = [300, 600];
    slots.forEach((slot, idx) => {
      if (words.length < targets[idx]) return;
      const ad = this.renderAd(slot);
      if (!ad) return;
      const parts = result.split('</p>');
      if (parts.length > 2) {
        const pos = Math.floor(parts.length * (targets[idx] / words.length));
        parts[pos] = parts[pos] + '</p>' + ad;
        result = parts.join('</p>');
      }
    });
    return result;
  }
};

/* ========== المصادقة (للاستخدام في admin.js فقط) ========== */
const Auth = {
  isLoggedIn() { return !!(sessionStorage.getItem('hesale_session') || localStorage.getItem('hesale_remember')); },
  async login(user, pw, remember) {
    const auth = BlogStorage.get(BlogStorage.KEYS.AUTH);
    if (!auth || (auth.username !== user && auth.email !== user)) return { success: false, message: 'بيانات الدخول غير صحيحة' };
    if (!(await Security.verifyPassword(pw, auth.passwordHash))) return { success: false, message: 'كلمة السر غير صحيحة' };
    const token = Security.generateCSRFToken();
    const data = { user: auth.username, token, loginTime: Date.now() };
    remember ? localStorage.setItem('hesale_remember', JSON.stringify(data)) : sessionStorage.setItem('hesale_session', JSON.stringify(data));
    logActivity('login', 'تسجيل دخول');
    return { success: true, token };
  },
  logout() {
    sessionStorage.removeItem('hesale_session');
    localStorage.removeItem('hesale_remember');
    logActivity('logout', 'تسجيل خروج');
  },
  requireAuth() {
    if (!this.isLoggedIn()) { window.location.href = 'admin-panel.html'; return false; }
    return true;
  },
  getCSRFToken() {
    try {
      const s = sessionStorage.getItem('hesale_session') || localStorage.getItem('hesale_remember');
      return s ? JSON.parse(s).token : null;
    } catch { return null; }
  }
};

/* ========== تصدير/استيراد ========== */
const DataExport = {
  exportAll() {
    const data = { posts: BlogStorage.get(BlogStorage.KEYS.POSTS), ads: BlogStorage.get(BlogStorage.KEYS.ADS), analytics: BlogStorage.get(BlogStorage.KEYS.ANALYTICS), settings: BlogStorage.get(BlogStorage.KEYS.SETTINGS), exportedAt: new Date().toISOString() };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `hesale-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast('تم التصدير بنجاح', 'success');
  },
  importFromFile(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => {
        try {
          const d = JSON.parse(e.target.result);
          if (d.posts) BlogStorage.set(BlogStorage.KEYS.POSTS, d.posts);
          if (d.ads) BlogStorage.set(BlogStorage.KEYS.ADS, d.ads);
          if (d.analytics) BlogStorage.set(BlogStorage.KEYS.ANALYTICS, d.analytics);
          if (d.settings) BlogStorage.set(BlogStorage.KEYS.SETTINGS, d.settings);
          res(d);
        } catch (err) { rej(err); }
      };
      r.onerror = rej;
      r.readAsText(file);
    });
  }
};

/* ========== SEO ========== */
const SEO = {
  setMeta({ title, description, keywords, image, url, type = 'website', article = null }) {
    const s = SettingsManager.get();
    document.title = title;
    const set = (sel, attr, val) => { let el = document.querySelector(sel); if (!el) { el = document.createElement('meta'); const [a, v] = attr.split('='); el.setAttribute(a, v.replace(/"/g, '')); document.head.appendChild(el); } el.content = val; };
    set('meta[name="description"]', 'name=description', description);
    set('meta[name="keywords"]', 'name=keywords', keywords || s.blogKeywords);
    set('meta[property="og:title"]', 'property=og:title', title);
    set('meta[property="og:description"]', 'property=og:description', description);
    set('meta[property="og:image"]', 'property=og:image', image || '');
    set('meta[property="og:url"]', 'property=og:url', url || s.siteUrl);
    set('meta[property="og:type"]', 'property=og:type', type);
    set('meta[property="og:site_name"]', 'property=og:site_name', `HeSale - ${s.blogNameAr || 'سيل'}`);
    set('meta[name="twitter:card"]', 'name=twitter:card', 'summary_large_image');
    set('meta[name="twitter:title"]', 'name=twitter:title', title);
    set('meta[name="twitter:description"]', 'name=twitter:description', description);
    set('meta[name="twitter:image"]', 'name=twitter:image', image || '');
    let canon = document.querySelector('link[rel="canonical"]');
    if (!canon) { canon = document.createElement('link'); canon.rel = 'canonical'; document.head.appendChild(canon); }
    canon.href = url || s.siteUrl;
    if (article) this.setArticleSchema(article);
    else this.setOrgSchema();
  },
  setArticleSchema(post) {
    const s = SettingsManager.get();
    const schema = { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.seoTitle || post.title, description: post.seoDescription || post.excerpt, image: post.ogImage || post.image, datePublished: post.date, author: { '@type': 'Person', name: post.author }, publisher: { '@type': 'Organization', name: 'HeSale', logo: { '@type': 'ImageObject', url: s.siteUrl + '/manifest.json' } }, mainEntityOfPage: { '@type': 'WebPage', '@id': `${s.siteUrl}/post.html?slug=${post.slug}` } };
    this._injectSchema(schema, 'article-schema');
  },
  setOrgSchema() {
    const s = SettingsManager.get();
    this._injectSchema({ '@context': 'https://schema.org', '@type': 'Organization', name: 'HeSale', alternateName: 'سيل', url: s.siteUrl, description: s.blogDescription }, 'org-schema');
  },
  _injectSchema(data, id) {
    let el = document.getElementById(id);
    if (!el) { el = document.createElement('script'); el.id = id; el.type = 'application/ld+json'; document.head.appendChild(el); }
    el.textContent = JSON.stringify(data);
  }
};

/* ========== الواجهة ========== */
function applyThemeColors(settings) {
  const s = settings || SettingsManager.get();
  document.documentElement.style.setProperty('--primary', s.primaryColor || '#0F172A');
  document.documentElement.style.setProperty('--secondary', s.secondaryColor || '#3B82F6');
  document.documentElement.style.setProperty('--accent', s.accentColor || '#10B981');
}

function initTheme() {
  const t = localStorage.getItem(BlogStorage.KEYS.THEME) || 'light';
  document.documentElement.setAttribute('data-theme', t);
  updateThemeIcon(t);
}

function toggleTheme() {
  const next = (document.documentElement.getAttribute('data-theme') || 'light') === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(BlogStorage.KEYS.THEME, next);
  updateThemeIcon(next);
}

function updateThemeIcon(t) {
  document.querySelectorAll('.theme-toggle-btn').forEach(b => {
    b.innerHTML = t === 'dark' ? '☀️' : '🌙';
    b.setAttribute('aria-label', t === 'dark' ? 'وضع فاتح' : 'وضع داكن');
  });
}

function showToast(msg, type = 'info') {
  let c = document.querySelector('.toast-container');
  if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
}

function renderPostCard(post, opts = {}) {
  const s = SettingsManager.get();
  return `<article class="post-card">
    <a href="post.html?slug=${encodeURIComponent(post.slug)}" class="post-card-link">
      <div class="post-card-image">
        <img src="${Security.escapeHtml(post.image)}" alt="${Security.escapeHtml(post.title)}" loading="lazy" width="400" height="250" onerror="this.src='https://via.placeholder.com/400x250/0F172A/3B82F6?text=HeSale'">
        <span class="post-emoji">${post.emoji || '📝'}</span>
        ${post.featured ? '<span class="featured-badge">مميز</span>' : ''}
      </div>
      <div class="post-card-body">
        <span class="post-category">${Security.escapeHtml(post.category)}</span>
        <h3 class="post-title">${Security.escapeHtml(post.title)}</h3>
        <p class="post-excerpt">${Security.escapeHtml(post.excerpt)}</p>
        <div class="post-meta">
          <span>📅 ${formatDate(post.date)}</span>
          <span>⏱ ${post.readTime || 5} د</span>
          <span>👁 ${post.views}</span>
        </div>
        ${opts.showReadMore !== false ? '<span class="read-more">اقرأ المزيد ←</span>' : ''}
      </div>
    </a>
  </article>`;
}

function renderNavbar(active = '') {
  const s = SettingsManager.get();
  return `<header class="site-header" role="banner">
    <div class="container header-inner">
      <a href="index.html" class="logo" aria-label="HeSale الرئيسية">
        <span class="logo-icon">${s.blogLogo || '⚡'}</span>
        <span class="logo-text"><strong>HeSale</strong> <small>سيل</small></span>
      </a>
      <button class="nav-toggle" aria-label="القائمة" aria-expanded="false"><span></span><span></span><span></span></button>
      <nav class="main-nav" role="navigation">
        <ul class="nav-links">
          <li><a href="index.html" class="${active === 'home' ? 'active' : ''}">الرئيسية</a></li>
          <li><a href="category.html" class="${active === 'categories' ? 'active' : ''}">الفئات</a></li>
          <li><a href="search.html" class="${active === 'search' ? 'active' : ''}">البحث</a></li>
          <li><a href="contact.html" class="${active === 'contact' ? 'active' : ''}">التواصل</a></li>
        </ul>
        <form class="header-search" action="search.html" method="get" role="search">
          <input type="search" name="q" placeholder="ابحث..." aria-label="بحث" class="search-input">
          <button type="submit" aria-label="بحث">🔍</button>
        </form>
        <button class="theme-toggle-btn" onclick="toggleTheme()" type="button">🌙</button>
      </nav>
    </div>
  </header>`;
}

function renderFooter() {
  const s = SettingsManager.get();
  const year = new Date().getFullYear();
  const social = s.socialLinks || {};
  const socialIcons = { facebook: '📘', twitter: '🐦', linkedin: '💼', instagram: '📷' };
  return `<footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <div class="logo"><span class="logo-icon">${s.blogLogo || '⚡'}</span><strong>HeSale</strong> <small>سيل</small></div>
        <p>${Security.escapeHtml(s.blogDescription)}</p>
        <div class="social-links">${Object.entries(social).filter(([,v]) => v).map(([k,v]) => `<a href="${Security.escapeHtml(v)}" target="_blank" rel="noopener noreferrer" aria-label="${k}">${socialIcons[k] || '🔗'}</a>`).join('')}</div>
      </div>
      <div><h4>روابط</h4><ul class="footer-links"><li><a href="about.html">من نحن</a></li><li><a href="contact.html">تواصل معنا</a></li><li><a href="search.html">البحث</a></li></ul></div>
      <div><h4>قانوني</h4><ul class="footer-links"><li><a href="privacy.html">سياسة الخصوصية</a></li><li><a href="terms.html">شروط الاستخدام</a></li></ul></div>
      <div><h4>الفئات</h4><ul class="footer-links">${Object.keys(PostsManager.getCategories()).slice(0,5).map(c => `<li><a href="category.html?cat=${encodeURIComponent(c)}">${Security.escapeHtml(c)}</a></li>`).join('')}</ul></div>
    </div>
    <div class="footer-bottom"><p>© ${year} HeSale - سيل. جميع الحقوق محفوظة.</p></div>
  </footer>`;
}

function renderSidebar(opts = {}) {
  const top = PostsManager.getMostViewed(5);
  const cats = PostsManager.getCategories();
  return `<aside class="sidebar">
    ${opts.showAd !== false ? `<div class="sidebar-widget ad-widget"><h3 class="widget-title">إعلان</h3>${AdsManager.renderAd('ad-slot-1')}</div>` : ''}
    <div class="sidebar-widget"><h3 class="widget-title">🔥 الأكثر مشاهدة</h3><ul class="top-posts-list">${top.map((p,i) => `<li><span class="rank">${i+1}</span><a href="post.html?slug=${encodeURIComponent(p.slug)}">${Security.escapeHtml(p.title)}</a><small>${p.views} مشاهدة</small></li>`).join('')}</ul></div>
    <div class="sidebar-widget"><h3 class="widget-title">📂 الفئات</h3><ul class="categories-list">${Object.entries(cats).map(([c,n]) => `<li><a href="category.html?cat=${encodeURIComponent(c)}">${Security.escapeHtml(c)}<span class="badge">${n}</span></a></li>`).join('')}</ul></div>
    ${opts.newsletter ? `<div class="sidebar-widget newsletter-widget"><h3 class="widget-title">📬 النشرة البريدية</h3><p>اشترك لتصلك أحدث المقالات</p><form class="newsletter-form" onsubmit="event.preventDefault();showToast('شكراً للاشتراك!','success');this.reset();"><input type="email" placeholder="بريدك الإلكتروني" required class="form-control"><button type="submit" class="btn btn-primary btn-block">اشترك</button></form></div>` : ''}
  </aside>`;
}

function renderPagination(current, total, baseUrl) {
  if (total <= 1) return '';
  let html = '<nav class="pagination" aria-label="التنقل بين الصفحات">';
  if (current > 1) html += `<a href="${baseUrl}page=${current-1}" class="page-btn">→ السابق</a>`;
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - current) <= 2)
      html += `<a href="${baseUrl}page=${i}" class="page-btn ${i === current ? 'active' : ''}">${i}</a>`;
    else if (Math.abs(i - current) === 3) html += '<span class="page-dots">...</span>';
  }
  if (current < total) html += `<a href="${baseUrl}page=${current+1}" class="page-btn">التالي ←</a>`;
  return html + '</nav>';
}

function generateTOC(content) {
  const headings = [...content.matchAll(/<h([23])[^>]*>(.*?)<\/h\1>/gi)];
  if (!headings.length) return { html: '', content };
  let toc = '<nav class="toc"><h4>📑 فهرس المقالة</h4><ol>';
  headings.forEach((m, i) => {
    const id = `section-${i}`;
    content = content.replace(m[0], m[0].replace('>', ` id="${id}">`));
    toc += `<li><a href="#${id}">${m[2].replace(/<[^>]+>/g, '')}</a></li>`;
  });
  return { html: toc + '</ol></nav>', content };
}

function renderShareButtons(post) {
  const url = encodeURIComponent(`${SettingsManager.get().siteUrl}/post.html?slug=${post.slug}`);
  const title = encodeURIComponent(post.title);
  return `<div class="share-buttons">
    <span>شارك:</span>
    <a href="https://twitter.com/intent/tweet?url=${url}&text=${title}" target="_blank" rel="noopener" class="share-btn">🐦</a>
    <a href="https://www.facebook.com/sharer/sharer.php?u=${url}" target="_blank" rel="noopener" class="share-btn">📘</a>
    <a href="https://www.linkedin.com/sharing/share-offsite/?url=${url}" target="_blank" rel="noopener" class="share-btn">💼</a>
    <a href="https://wa.me/?text=${title}%20${url}" target="_blank" rel="noopener" class="share-btn">💬</a>
  </div>`;
}

function initNavbar() {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', !open);
      nav.classList.toggle('open');
      toggle.classList.toggle('active');
    });
  }
}

function initPublicPage(active = '') {
  const header = document.getElementById('site-header');
  const footer = document.getElementById('site-footer');
  if (header) header.innerHTML = renderNavbar(active);
  if (footer) footer.innerHTML = renderFooter();
  initNavbar();
  initTheme();
  applyThemeColors();
}

document.addEventListener('DOMContentLoaded', async () => {
  await initializeData();
  if (typeof HeSaleAnalytics !== 'undefined') HeSaleAnalytics.init();
});
