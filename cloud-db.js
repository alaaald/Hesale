/**
 * cloud-db.js — مزامنة المقالات مع Firebase Firestore
 * عند التفعيل: النشر من لوحة التحكم يظهر لجميع الزوار فوراً
 */

const CloudDB = {
  db: null,
  auth: null,
  ready: false,

  isEnabled() {
    return typeof FIREBASE_ENABLED !== 'undefined' && FIREBASE_ENABLED;
  },

  init() {
    if (!this.isEnabled() || typeof firebase === 'undefined') return false;
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    this.db = firebase.firestore();
    this.auth = firebase.auth();
    this.ready = true;
    return true;
  },

  async loadPublishedPosts() {
    const snap = await this.db.collection('posts').where('status', '==', 'published').get();
    return snap.docs.map(d => this._normalize({ ...d.data(), id: parseInt(d.id) || d.data().id }));
  },

  async loadAllPosts() {
    const snap = await this.db.collection('posts').get();
    return snap.docs.map(d => this._normalize({ ...d.data(), id: parseInt(d.id) || d.data().id }));
  },

  async savePost(post) {
    await this.db.collection('posts').doc(String(post.id)).set(this._strip(post));
  },

  async deletePost(id) {
    await this.db.collection('posts').doc(String(id)).delete();
  },

  async saveAllPosts(posts) {
    const batch = this.db.batch();
    posts.forEach(p => {
      batch.set(this.db.collection('posts').doc(String(p.id)), this._strip(p));
    });
    await batch.commit();
  },

  async incrementViews(id, views) {
    await this.db.collection('posts').doc(String(id)).update({ views });
  },

  async loadSettings() {
    const doc = await this.db.collection('config').doc('settings').get();
    return doc.exists ? doc.data() : null;
  },

  async saveSettings(data) {
    await this.db.collection('config').doc('settings').set(data);
  },

  async login(email, password) {
    return this.auth.signInWithEmailAndPassword(email, password);
  },

  async logout() {
    if (this.auth) await this.auth.signOut();
  },

  currentUser() {
    return this.auth?.currentUser || null;
  },

  _strip(post) {
    const copy = { ...post };
    delete copy._cloud;
    return copy;
  },

  _normalize(post) {
    if (post.tags && typeof post.tags === 'string') post.tags = post.tags.split(',').map(t => t.trim());
    return post;
  }
};

async function syncPostsFromCloud(includeDrafts = false) {
  if (!CloudDB.ready) return;
  try {
    const posts = includeDrafts && CloudDB.currentUser()
      ? await CloudDB.loadAllPosts()
      : await CloudDB.loadPublishedPosts();
    if (posts.length) {
      BlogStorage.set(BlogStorage.KEYS.POSTS, { posts });
    }
  } catch (e) {
    console.warn('CloudDB sync:', e.message);
  }
}

async function seedCloudIfEmpty() {
  if (!CloudDB.ready) return;
  const existing = await CloudDB.loadAllPosts();
  if (existing.length > 0) return;
  let posts = [];
  try {
    const r = await fetch('posts.json');
    const data = await r.json();
    posts = Array.isArray(data) ? data : (data.posts || []);
  } catch { return; }
  if (posts.length) await CloudDB.saveAllPosts(posts);
}
