const admin = require("firebase-admin");
// firebase = require("firebase"),
// config = require("./config");

const serviceAccount = require("./s-a-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

//firebase.initializeApp(config);


const db = admin.firestore();
//const perf = firebase.performance();
module.exports = { 
  admin, 
  db, 
  // perf 
};