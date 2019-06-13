const functions = require('firebase-functions');
const app = require("express")();

const cors = require("cors");
app.use(cors({origin: true}));

const { signup, login } = require("./handlers/users");
const { getAllQuestions } = require("./handlers/questions");

// users routes
app.post("/signup", signup);
app.post("/login", login);

// question routes
app.get('/questions', getAllQuestions)

app.get("/", (request, response) => {
  response.send("Hello from Firebase!");
});

exports.api = functions.https.onRequest(app);
