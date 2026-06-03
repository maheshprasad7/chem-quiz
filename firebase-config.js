// ============================================================
// FIREBASE CONFIGURATION
// Steps to set up:
// 1. Go to https://console.firebase.google.com
// 2. Create a new project (e.g. "chem-quiz")
// 3. Click "Web" app icon and register the app
// 4. Copy your config values below
// 5. Go to Firestore Database → Create database (start in test mode)
// ============================================================

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Set to true once you've filled in the config above
const FIREBASE_CONFIGURED = false;
