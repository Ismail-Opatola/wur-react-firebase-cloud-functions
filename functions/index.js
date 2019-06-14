const functions = require('firebase-functions');
const app = require("express")();
const FBAuth = require('./util/fbAuth');

const cors = require("cors");
app.use(cors({origin: true}));

const { signup, login, uploadImage, addUserDetails } = require("./handlers/users");
const { getAllQuestions, postQuestion } = require("./handlers/questions");

// users routes
app.post("/signup", signup);
app.post("/login", login);
app.post('/user/image', FBAuth, uploadImage);
app.post('/user', FBAuth, addUserDetails);


// question routes
app.get('/questions', getAllQuestions);
app.post('/question', FBAuth, postQuestion)

app.get("/", (request, response) => {
  response.send("Hello from Firebase!");
});

exports.api = functions.https.onRequest(app);
