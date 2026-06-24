/**
 * analytics.js - تتبع الزيارات والتحليلات
 * HeSale Blog
 */

const HeSaleAnalytics = {
  SESSION_KEY: 'hesale_session',
  IDLE_TIMEOUT: 30 * 60 * 1000,

  init() {
    this.trackPageView();
    this.setupIdleTracking();
    this.injectAnalyticsScripts();
  },

  getData() {
    const stored = BlogStorage.get(BlogStorage.KEYS.ANALYTICS);
    return stored?.analytics || {
      totalViews: 0,
      dailyViews: [],
      postViews: [],
      keywordHits: {},
      comments: 0,
      bounceRate: 42
    };
  },

  saveData(data) {
    BlogStorage.set(BlogStorage.KEYS.ANALYTICS, { analytics: data });
  },

  trackPageView(postId = null, postTitle = null) {
    const data = this.getData();
    const today = new Date().toISOString().split('T')[0];

    data.totalViews = (data.totalViews || 0) + 1;
    const dayIdx = data.dailyViews.findIndex(d => d.date === today);
    if (dayIdx >= 0) data.dailyViews[dayIdx].views++;
    else data.dailyViews.push({ date: today, views: 1 });
    if (data.dailyViews.length > 365) data.dailyViews = data.dailyViews.slice(-365);

    if (postId) {
      const pvIdx = data.postViews.findIndex(p => p.postId === postId);
      if (pvIdx >= 0) data.postViews[pvIdx].views++;
      else data.postViews.push({ postId, postTitle: postTitle || '', views: 1 });
    }

    this.saveData(data);
  },

  trackKeywords(tags) {
    if (!tags) return;
    const data = this.getData();
    const list = Array.isArray(tags) ? tags : tags.split(',');
    list.forEach(tag => {
      const key = tag.trim();
      if (key) data.keywordHits[key] = (data.keywordHits[key] || 0) + 1;
    });
    this.saveData(data);
  },

  getTodayViews() {
    const today = new Date().toISOString().split('T')[0];
    const day = this.getData().dailyViews.find(d => d.date === today);
    return day ? day.views : 0;
  },

  getWeeklyViews() {
    return this.getData().dailyViews.slice(-7);
  },

  getMonthlyViews() {
    const data = this.getData();
    const months = {};
    data.dailyViews.forEach(d => {
      const month = d.date.substring(0, 7);
      months[month] = (months[month] || 0) + d.views;
    });
    return Object.entries(months).slice(-12);
  },

  getTopPosts(count = 10) {
    return [...this.getData().postViews]
      .sort((a, b) => b.views - a.views)
      .slice(0, count);
  },

  setupIdleTracking() {
    let lastActivity = Date.now();
    const reset = () => { lastActivity = Date.now(); };
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(e =>
      document.addEventListener(e, reset, { passive: true })
    );

    setInterval(() => {
      if (typeof Auth !== 'undefined' && Auth.isLoggedIn() &&
          Date.now() - lastActivity > this.IDLE_TIMEOUT) {
        Auth.logout();
        if (window.location.pathname.includes('admin')) {
          window.location.href = 'admin-panel.html';
        }
      }
    }, 60000);
  },

  injectAnalyticsScripts() {
    const settings = SettingsManager.get();
    if (settings.googleAnalyticsId) {
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${settings.googleAnalyticsId}`;
      document.head.appendChild(s);
      const inline = document.createElement('script');
      inline.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${settings.googleAnalyticsId}');`;
      document.head.appendChild(inline);
    }
    if (settings.googleSearchConsoleCode) {
      const meta = document.createElement('meta');
      meta.name = 'google-site-verification';
      meta.content = settings.googleSearchConsoleCode;
      document.head.appendChild(meta);
    }
    if (settings.facebookPixelId) {
      const fb = document.createElement('script');
      fb.textContent = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${settings.facebookPixelId}');fbq('track','PageView');`;
      document.head.appendChild(fb);
    }
  }
};
