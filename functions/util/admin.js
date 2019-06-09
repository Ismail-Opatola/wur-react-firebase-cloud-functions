const admin = require("firebase-admin");
let db;

// Initialize Firebase
try {
  admin.initializeApp();
  db = admin.firestore();
  console.log("Firebase Initialized");
} catch (err) {
  console.log("Error Initializing Firebase");
}

module.exports = { admin, db };
