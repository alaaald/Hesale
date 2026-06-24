/**
 * admin.js - وظائف لوحة التحكم المخفية HeSale
 * يُستخدم فقط في صفحات admin-*.html
 */

const AdminUI = {
  init(page = 'dashboard') {
    if (!Auth.requireAuth()) return;
    this.renderSidebar(page);
    this.setupLogout();
    this.setupMobileMenu();
    initTheme();
    applyThemeColors();
  },

  renderSidebar(page) {
    const el = document.querySelector('.admin-sidebar');
    if (!el) return;
    const links = [
      { href: 'admin-panel.html', icon: '📊', label: 'الرئيسية', id: 'dashboard' },
      { href: 'admin-posts.html', icon: '📝', label: 'المقالات', id: 'posts' },
      { href: 'admin-edit-post.html', icon: '➕', label: 'مقالة جديدة', id: 'edit' },
      { href: 'admin-ads.html', icon: '📢', label: 'الإعلانات', id: 'ads' },
      { href: 'admin-analytics.html', icon: '📈', label: 'الإحصائيات', id: 'analytics' },
      { href: 'admin-settings.html', icon: '⚙️', label: 'الإعدادات', id: 'settings' }
    ];
    el.innerHTML = `
      <div class="admin-brand"><span>⚡</span><div><strong>HeSale</strong><small>لوحة الإدارة</small></div></div>
      <nav class="admin-nav">${links.map(l => `<a href="${l.href}" class="admin-nav-link ${page === l.id ? 'active' : ''}"><span>${l.icon}</span>${l.label}</a>`).join('')}</nav>
      <div class="admin-nav-footer">
        <a href="index.html" target="_blank" class="admin-nav-link">🌐 عرض الموقع</a>
        <button id="logoutBtn" class="admin-nav-link logout-btn">🚪 خروج</button>
      </div>`;
  },

  setupLogout() {
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      if (confirm('تسجيل الخروج؟')) { Auth.logout(); window.location.href = 'admin-panel.html'; }
    });
  },

  setupMobileMenu() {
    document.querySelector('.admin-menu-toggle')?.addEventListener('click', () => {
      document.querySelector('.admin-sidebar')?.classList.toggle('open');
    });
  }
};

const LoginPage = {
  init() {
    if (Auth.isLoggedIn()) { this.showDashboard(); return; }
    document.getElementById('loginSection')?.classList.remove('hidden');
    document.getElementById('dashboardSection')?.classList.add('hidden');
    document.getElementById('loginForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.target.querySelector('[type=submit]');
      btn.disabled = true;
      const r = await Auth.login(
        document.getElementById('username').value.trim(),
        document.getElementById('password').value,
        document.getElementById('rememberMe').checked
      );
      if (r.success) { showToast('مرحباً بك', 'success'); this.showDashboard(); }
      else { showToast(r.message, 'error'); btn.disabled = false; }
    });
  },
  showDashboard() {
    document.getElementById('loginSection')?.classList.add('hidden');
    document.getElementById('dashboardSection')?.classList.remove('hidden');
    Dashboard.render();
    AdminUI.init('dashboard');
  }
};

const Dashboard = {
  render() {
    const posts = PostsManager.getAll();
    const analytics = HeSaleAnalytics.getData();
    const published = posts.filter(p => p.status === 'published').length;
    document.getElementById('dashStats') && (document.getElementById('dashStats').innerHTML = `
      <div class="stat-card"><div class="stat-icon">📝</div><div><h3>${posts.length}</h3><p>المقالات</p><small>${published} منشورة</small></div></div>
      <div class="stat-card"><div class="stat-icon">👁</div><div><h3>${(analytics.totalViews||0).toLocaleString('ar')}</h3><p>الزيارات</p></div></div>
      <div class="stat-card"><div class="stat-icon">📂</div><div><h3>${Object.keys(PostsManager.getCategories()).length}</h3><p>الفئات</p></div></div>
      <div class="stat-card"><div class="stat-icon">💬</div><div><h3>${analytics.comments||0}</h3><p>التعليقات</p></div></div>`);
    const latest = [...posts].sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0,5);
    document.getElementById('dashLatest') && (document.getElementById('dashLatest').innerHTML = latest.map(p => `
      <tr><td>${p.emoji||'📝'} ${Security.escapeHtml(p.title)}</td><td>${formatDate(p.date)}</td>
      <td><span class="status-badge ${p.status}">${p.status}</span></td><td>${p.views}</td>
      <td><a href="admin-edit-post.html?id=${p.id}" class="btn btn-sm btn-primary">تعديل</a></td></tr>`).join(''));
    this.renderChart();
  },
  renderChart() {
    const canvas = document.getElementById('dashChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const data = HeSaleAnalytics.getWeeklyViews();
    if (canvas.chartInstance) canvas.chartInstance.destroy();
    canvas.chartInstance = new Chart(canvas, {
      type: 'line',
      data: { labels: data.map(d => d.date), datasets: [{ label: 'زيارات', data: data.map(d => d.views), borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }
};

const PostsAdmin = {
  renderTable() {
    const tbody = document.getElementById('postsTableBody');
    if (!tbody) return;
    const posts = PostsManager.getAll().sort((a,b) => new Date(b.date)-new Date(a.date));
    tbody.innerHTML = posts.length ? posts.map(p => `
      <tr>
        <td><input type="checkbox" class="post-check" value="${p.id}"></td>
        <td>${Security.escapeHtml(p.title)}</td><td>${formatDate(p.date)}</td>
        <td>${Security.escapeHtml(p.category)}</td><td>${p.views}</td>
        <td><span class="status-badge ${p.status}">${p.status}</span></td>
        <td class="actions">
          <a href="admin-edit-post.html?id=${p.id}" class="btn btn-sm btn-primary" title="تعديل">✏️</a>
          <a href="post.html?slug=${encodeURIComponent(p.slug)}" target="_blank" class="btn btn-sm btn-secondary" title="معاينة">👁️</a>
          <button onclick="PostsAdmin.deletePost(${p.id})" class="btn btn-sm btn-danger" title="حذف">🗑️</button>
        </td>
      </tr>`).join('') : '<tr><td colspan="7" class="empty-state">لا توجد مقالات</td></tr>';
  },
  deletePost(id) {
    const p = PostsManager.getById(id);
    if (!p || !confirm(`حذف "${p.title}"؟`)) return;
    if (!Security.validateCSRFToken(Auth.getCSRFToken())) return showToast('انتهت الجلسة', 'error');
    PostsManager.delete(id);
    showToast('تم الحذف', 'success');
    this.renderTable();
  },
  setupFilters() {
    const run = () => {
      const q = document.getElementById('postSearch')?.value || '';
      const st = document.getElementById('statusFilter')?.value || '';
      const results = PostsManager.search(q, { includeDrafts: true, status: st || undefined });
      document.getElementById('postsTableBody').innerHTML = results.map(p => `
        <tr><td><input type="checkbox" class="post-check" value="${p.id}"></td>
        <td>${Security.escapeHtml(p.title)}</td><td>${formatDate(p.date)}</td><td>${p.category}</td><td>${p.views}</td>
        <td><span class="status-badge ${p.status}">${p.status}</span></td>
        <td class="actions"><a href="admin-edit-post.html?id=${p.id}" class="btn btn-sm btn-primary">✏️</a>
        <button onclick="PostsAdmin.deletePost(${p.id})" class="btn btn-sm btn-danger">🗑️</button></td></tr>`).join('');
    };
    document.getElementById('postSearch')?.addEventListener('input', debounce(run, 300));
    document.getElementById('statusFilter')?.addEventListener('change', run);
  },
  setupAutoRefresh() {
    setInterval(() => this.renderTable(), 30000);
  },
  setupBatch() {
    document.getElementById('selectAll')?.addEventListener('change', e => {
      document.querySelectorAll('.post-check').forEach(c => c.checked = e.target.checked);
    });
    document.getElementById('batchDelete')?.addEventListener('click', () => {
      const ids = [...document.querySelectorAll('.post-check:checked')].map(c => c.value);
      if (!ids.length || !confirm(`حذف ${ids.length} مقالة؟`)) return;
      ids.forEach(id => PostsManager.delete(id));
      showToast('تم الحذف', 'success');
      this.renderTable();
    });
  }
};

const PostEditor = {
  init() {
    const id = new URLSearchParams(location.search).get('id');
    if (id) { this.load(id); document.getElementById('editorTitle').textContent = 'تعديل المقالة'; }
    this.setupToolbar();
    this.setupForm();
    document.getElementById('postTitle')?.addEventListener('input', e => {
      if (!document.getElementById('customSlug').value)
        document.getElementById('slugPreview').textContent = generateSlug(e.target.value);
    });
  },
  load(id) {
    const p = PostsManager.getById(id);
    if (!p) return;
    document.getElementById('postId').value = p.id;
    const fields = { postTitle: p.title, postExcerpt: p.excerpt, postCategory: p.category, postEmoji: p.emoji, postImage: p.image, postStatus: p.status, customSlug: p.slug, seoTitle: p.seoTitle, seoDescription: p.seoDescription, ogImage: p.ogImage, publishDate: p.date?.split('T')[0] };
    Object.entries(fields).forEach(([k,v]) => { const el = document.getElementById(k); if (el && v) el.value = v; });
    document.getElementById('postTags').value = (p.tags || []).join(', ');
    document.getElementById('postFeatured').checked = p.featured;
    document.getElementById('postContent').innerHTML = p.content;
    document.getElementById('readTimePreview').textContent = p.readTime || PostsManager.calcReadTime(p.content);
    if (p.image) { const img = document.getElementById('imagePreview'); img.src = p.image; img.style.display = 'block'; }
  },
  setupToolbar() {
    document.querySelectorAll('[data-cmd]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        let val = btn.dataset.val || null;
        if (btn.dataset.cmd === 'createLink') { val = prompt('الرابط:', 'https://'); if (!val) return; }
        document.execCommand(btn.dataset.cmd, false, val);
        document.getElementById('postContent').focus();
      });
    });
  },
  setupForm() {
    document.getElementById('postImage')?.addEventListener('input', e => {
      const img = document.getElementById('imagePreview');
      img.src = e.target.value; img.style.display = e.target.value ? 'block' : 'none';
    });
    document.getElementById('postForm')?.addEventListener('submit', e => { e.preventDefault(); this.save(e.submitter?.dataset?.action || 'published'); });
    document.getElementById('previewBtn')?.addEventListener('click', () => this.save('draft', true));
  },
  getData(status) {
    const content = Security.sanitizeHtml(document.getElementById('postContent').innerHTML);
    const tags = document.getElementById('postTags').value.split(',').map(t => t.trim()).filter(Boolean);
    return {
      title: document.getElementById('postTitle').value.trim(),
      excerpt: document.getElementById('postExcerpt').value.trim(),
      content, tags, category: document.getElementById('postCategory').value,
      emoji: document.getElementById('postEmoji').value || '📝',
      image: document.getElementById('postImage').value.trim(),
      status, featured: document.getElementById('postFeatured').checked,
      slug: document.getElementById('customSlug').value || generateSlug(document.getElementById('postTitle').value),
      seoTitle: document.getElementById('seoTitle').value || document.getElementById('postTitle').value,
      seoDescription: document.getElementById('seoDescription').value || document.getElementById('postExcerpt').value,
      ogImage: document.getElementById('ogImage').value || document.getElementById('postImage').value,
      date: document.getElementById('publishDate').value ? new Date(document.getElementById('publishDate').value).toISOString() : new Date().toISOString(),
      author: SettingsManager.get().author, readTime: PostsManager.calcReadTime(content)
    };
  },
  save(status, preview = false) {
    if (!Security.validateCSRFToken(document.getElementById('csrfToken')?.value)) return showToast('انتهت الجلسة', 'error');
    const data = this.getData(status);
    if (!data.title || !data.excerpt) return showToast('العنوان والوصف مطلوبان', 'error');
    const id = document.getElementById('postId').value;
    const post = id ? PostsManager.update(id, data) : PostsManager.create(data);
    showToast('تم الحفظ', 'success');
    if (preview) window.open(`post.html?slug=${encodeURIComponent(post.slug)}`, '_blank');
    else setTimeout(() => location.href = 'admin-posts.html', 800);
  }
};

const AdsAdmin = {
  renderTable() {
    const tbody = document.getElementById('adsTableBody');
    if (!tbody) return;
    tbody.innerHTML = AdsManager.getAll().map(ad => `
      <tr><td>${ad.id}</td><td>${ad.type === 'google-adsense' ? 'AdSense' : 'HTML'}</td>
      <td>${ad.placement}</td><td>${ad.width}×${ad.height}</td>
      <td><label class="toggle-switch"><input type="checkbox" ${ad.enabled?'checked':''} onchange="AdsAdmin.toggle('${ad.id}',this.checked)"><span class="toggle-slider"></span></label></td>
      <td><button class="btn btn-sm btn-primary" onclick="AdsAdmin.edit('${ad.id}')">✏️</button>
      <button class="btn btn-sm btn-secondary" onclick="AdsAdmin.preview('${ad.id}')">👁️</button></td></tr>`).join('');
  },
  toggle(id, enabled) { AdsManager.update(id, { enabled }); showToast(enabled ? 'مفعّل' : 'معطّل', 'success'); },
  edit(id) {
    const ad = AdsManager.getById(id);
    if (!ad) return;
    ['editAdId','editAdType','editAdCode','editAdPlacement','editAdWidth','editAdHeight'].forEach(k => {
      const el = document.getElementById(k);
      const map = { editAdId:'id', editAdType:'type', editAdCode:'code', editAdPlacement:'placement', editAdWidth:'width', editAdHeight:'height' };
      if (el) el.value = ad[map[k]];
    });
    document.getElementById('adModal').classList.add('show');
  },
  save() {
    const id = document.getElementById('editAdId').value;
    AdsManager.update(id, { type: document.getElementById('editAdType').value, code: document.getElementById('editAdCode').value, placement: document.getElementById('editAdPlacement').value, width: document.getElementById('editAdWidth').value, height: document.getElementById('editAdHeight').value });
    document.getElementById('adModal').classList.remove('show');
    this.renderTable();
    showToast('تم الحفظ', 'success');
  },
  preview(id) {
    document.getElementById('adPreviewArea').innerHTML = AdsManager.renderAd(id);
    document.getElementById('adPreviewModal').classList.add('show');
  }
};

const AnalyticsAdmin = {
  render() {
    const d = HeSaleAnalytics.getData();
    document.getElementById('totalViews') && (document.getElementById('totalViews').textContent = (d.totalViews||0).toLocaleString('ar'));
    document.getElementById('avgDaily') && (document.getElementById('avgDaily').textContent = Math.round((d.totalViews||0) / Math.max(d.dailyViews.length,1)));
    document.getElementById('bounceRate') && (document.getElementById('bounceRate').textContent = (d.bounceRate||42) + '%');
    const topDay = [...d.dailyViews].sort((a,b) => b.views-a.views)[0];
    document.getElementById('topDay') && (document.getElementById('topDay').textContent = topDay ? `${topDay.views} (${topDay.date})` : '-');
    this.renderCharts();
    const topPosts = PostsManager.getMostViewed(10);
    document.getElementById('topPostsAdmin') && (document.getElementById('topPostsAdmin').innerHTML = topPosts.map((p,i) => `<li><span class="rank">${i+1}</span>${Security.escapeHtml(p.title)}<span class="badge">${p.views}</span></li>`).join(''));
    const cats = {};
    PostsManager.getPublished().forEach(p => { cats[p.category] = (cats[p.category]||0) + p.views; });
    document.getElementById('topCats') && (document.getElementById('topCats').innerHTML = Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([c,v],i) => `<li><span class="rank">${i+1}</span>${c}<span class="badge">${v}</span></li>`).join(''));
  },
  renderCharts() {
    const daily = document.getElementById('dailyChart');
    const monthly = document.getElementById('monthlyChart');
    if (daily && typeof Chart !== 'undefined') {
      const data = HeSaleAnalytics.getData().dailyViews.slice(-30);
      if (daily.chartInstance) daily.chartInstance.destroy();
      daily.chartInstance = new Chart(daily, { type: 'bar', data: { labels: data.map(d=>d.date), datasets: [{ data: data.map(d=>d.views), backgroundColor: '#3B82F6', borderRadius: 6 }] }, options: { responsive: true, plugins: { legend: { display: false } } } });
    }
    if (monthly && typeof Chart !== 'undefined') {
      const data = HeSaleAnalytics.getMonthlyViews();
      if (monthly.chartInstance) monthly.chartInstance.destroy();
      monthly.chartInstance = new Chart(monthly, { type: 'line', data: { labels: data.map(d=>d[0]), datasets: [{ data: data.map(d=>d[1]), borderColor: '#10B981', fill: true, backgroundColor: 'rgba(16,185,129,0.1)' }] }, options: { responsive: true } });
    }
  }
};

const SettingsAdmin = {
  init() {
    const s = SettingsManager.get();
    const auth = BlogStorage.get(BlogStorage.KEYS.AUTH);
    const fields = { blogName: s.blogName, blogNameAr: s.blogNameAr, blogDescription: s.blogDescription, blogLogo: s.blogLogo, blogKeywords: s.blogKeywords, googleAdSenseId: s.googleAdSenseId, googleAnalyticsId: s.googleAnalyticsId, googleSearchConsoleCode: s.googleSearchConsoleCode, facebookPixelId: s.facebookPixelId, siteUrl: s.siteUrl, primaryColor: s.primaryColor, secondaryColor: s.secondaryColor, adminUsername: auth?.username };
    Object.entries(fields).forEach(([k,v]) => { const el = document.getElementById(k); if (el && v !== undefined) el.value = v; });
    const social = s.socialLinks || {};
    ['facebook','twitter','linkedin','instagram'].forEach(k => { const el = document.getElementById('social_'+k); if (el) el.value = social[k] || ''; });
    document.getElementById('settingsForm')?.addEventListener('submit', e => { e.preventDefault(); this.save(); });
    document.getElementById('passwordForm')?.addEventListener('submit', e => { e.preventDefault(); this.changePassword(); });
    document.getElementById('exportBtn')?.addEventListener('click', () => DataExport.exportAll());
    document.getElementById('importBtn')?.addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile')?.addEventListener('change', async e => {
      try { await DataExport.importFromFile(e.target.files[0]); showToast('تم الاستيراد', 'success'); setTimeout(() => location.reload(), 1000); }
      catch { showToast('فشل الاستيراد', 'error'); }
    });
    document.getElementById('deleteAllBtn')?.addEventListener('click', () => {
      if (prompt('اكتب "حذف الكل" للتأكيد') === 'حذف الكل') {
        Object.values(BlogStorage.KEYS).forEach(k => BlogStorage.remove(k));
        showToast('تم حذف البيانات', 'warning');
        setTimeout(() => location.reload(), 1000);
      }
    });
  },
  save() {
    if (!Security.validateCSRFToken(document.getElementById('csrfToken')?.value)) return;
    SettingsManager.update({
      blogName: document.getElementById('blogName').value,
      blogNameAr: document.getElementById('blogNameAr').value,
      blogDescription: document.getElementById('blogDescription').value,
      blogLogo: document.getElementById('blogLogo').value,
      blogKeywords: document.getElementById('blogKeywords').value,
      googleAdSenseId: document.getElementById('googleAdSenseId').value,
      googleAnalyticsId: document.getElementById('googleAnalyticsId').value,
      googleSearchConsoleCode: document.getElementById('googleSearchConsoleCode').value,
      facebookPixelId: document.getElementById('facebookPixelId').value,
      siteUrl: document.getElementById('siteUrl').value,
      primaryColor: document.getElementById('primaryColor').value,
      secondaryColor: document.getElementById('secondaryColor').value,
      socialLinks: { facebook: document.getElementById('social_facebook').value, twitter: document.getElementById('social_twitter').value, linkedin: document.getElementById('social_linkedin').value, instagram: document.getElementById('social_instagram').value }
    });
    const auth = BlogStorage.get(BlogStorage.KEYS.AUTH);
    BlogStorage.set(BlogStorage.KEYS.AUTH, { ...auth, username: document.getElementById('adminUsername').value });
    showToast('تم الحفظ', 'success');
  },
  async changePassword() {
    const cur = document.getElementById('currentPassword').value;
    const nw = document.getElementById('newPassword').value;
    const cf = document.getElementById('confirmPassword').value;
    if (nw !== cf) return showToast('كلمتا السر غير متطابقتين', 'error');
    const auth = BlogStorage.get(BlogStorage.KEYS.AUTH);
    if (!(await Security.verifyPassword(cur, auth.passwordHash))) return showToast('كلمة السر الحالية خاطئة', 'error');
    BlogStorage.set(BlogStorage.KEYS.AUTH, { ...auth, passwordHash: await Security.hashPassword(nw) });
    document.getElementById('passwordForm').reset();
    showToast('تم تغيير كلمة السر', 'success');
  }
};

function debounce(fn, delay) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); }; }
function getCSRFInput() { return `<input type="hidden" id="csrfToken" value="${Auth.getCSRFToken() || Security.generateCSRFToken()}">`; }
