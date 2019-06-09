const functions = require("firebase-functions"),
  app = require("express")(),
  cors = require("cors");

app.use(cors({ origin: true }));

const { signup, login } = require("./handlers/users");

// users routes
app.post('/signup', signup)
app.post('/login', login)


exports.api = functions.https.onRequest(app);

// app.get("/", (request, response) => {
//   response.send("Hello from Firebase!");
// });

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
