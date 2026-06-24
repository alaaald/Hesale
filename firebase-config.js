/**
 * إعداد Firebase — املأ القيم بعد إنشاء مشروع Firebase
 * الدليل: https://console.firebase.google.com
 *
 * 1. أنشئ مشروع → Firestore Database → ابدأ
 * 2. Authentication → Email/Password → فعّل
 * 3. أضف مستخدم (بريدك + كلمة سر) من تبويب Users
 * 4. Project Settings → Web app → انسخ firebaseConfig هنا
 * 5. Firestore → Rules → الصق محتوى firestore.rules
 */

const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};

// true عندما تملأ apiKey و projectId
const FIREBASE_ENABLED = !!(firebaseConfig.apiKey && firebaseConfig.projectId);
