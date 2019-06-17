const functions = require("firebase-functions"),
  app = require("express")(),
  { admin, db } = require("./util/admin");
(FBAuth = require("./util/fbAuth")), (cors = require("cors"));
app.use(cors({ origin: true }));

const {
  signup,
  login,
  uploadImage,
  addUserDetails,
  getAuthenticatedUser,
  getUserDetails
} = require("./handlers/users");
const {
  getAllQuestions,
  postQuestion,
  getQuestion,
  postVote,
  deleteQuestion
} = require("./handlers/questions");

// users routes
app.post("/signup", signup);
app.post("/login", login);
app.post("/user/image", FBAuth, uploadImage);
app.post("/user", FBAuth, addUserDetails);
app.get("/user", FBAuth, getAuthenticatedUser);
app.get("/user/:userId", getUserDetails);

// question routes
app.post("/question", FBAuth, postQuestion);
app.post("/question/:questionId", FBAuth, postVote);
app.delete("/question/:questionId", FBAuth, deleteQuestion);
app.get("/questions", getAllQuestions);
app.get("/question/:questionId", getQuestion);

app.get("/", (request, response) => {
  response.send("Hello from Firebase!");
});

exports.api = functions.https.onRequest(app);

// @ remove questionID auth user questions field
// @ remove questionID from voters votes field
exports.onQuestionDelete = functions
  .region("us-central1")
  .firestore.document("/questions/{questionId}")
  .onDelete((snapshot, context) => {
    const { questionId } = context.params;
    const batch = db.batch();
    return db
      .collection("users")
      .where("votes", "array-contains", questionId)
      .get()
      .then(data => {
        data.forEach(doc => {
          const user = db.doc(`users/${doc.id}`);
          batch.update(user, {
            votes: admin.firestore.FieldValue.arrayRemove(questionId),
            score: admin.firestore.FieldValue.increment(-1)
          });
        });
        return db.doc(`users/${snapshot.data().authorId}`);
      })
      .then(data => {
        batch.update(data, {
          questions: admin.firestore.FieldValue.arrayRemove(questionId),
          score: admin.firestore.FieldValue.increment(-1)
        });
        return batch.commit();
      })
      .catch(err => console.error(err));
  });
