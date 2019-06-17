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
  getUserDetails,
  markNotificationsRead
} = require("./handlers/users");
const {
  getAllQuestions,
  postQuestion,
  getQuestion,
  postVote,
  deleteQuestion
} = require("./handlers/questions");
const { getLeaderBoard } = require("./handlers/leaderboard");

// users routes
app.post("/signup", signup);
app.post("/login", login);
app.post("/user/image", FBAuth, uploadImage);
app.post("/user", FBAuth, addUserDetails);
app.get("/user", FBAuth, getAuthenticatedUser);
app.get("/user/:userId", getUserDetails);
app.post("/notifications", FBAuth, markNotificationsRead);

// question routes
app.post("/question", FBAuth, postQuestion);
app.post("/question/:questionId", FBAuth, postVote);
app.delete("/question/:questionId", FBAuth, deleteQuestion);
app.get("/questions", getAllQuestions);
app.get("/question/:questionId", getQuestion);

// leaderboard route
app.get("/leaderboard", getLeaderBoard);

app.get("/", (request, response) => {
  response.send("Hello from Firebase!");
});

exports.api = functions.https.onRequest(app);

// @ FUNCTIONS >> CLOUD FIRESTORE EVENT TRIGGERS
// @ ref: https://firebase.google.com/docs/functions/firestore-events
//        https://cloud.google.com/functions/docs/bestpractices/tips#performance
//        https://www.youtube.com/playlist?list=PLIivdWyY5sqK5zce0-fd1Vam7oPY-s_8X

// @ if user profile image has changed
// @ Update all user's created questions img field
exports.onUserImageChange = functions
  .region("us-central1")
  .firestore.document("/users/{userId}")
  .onUpdate(change => {
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      const batch = db.batch();
      return db
        .collection("questions")
        .where("authorId", "==", change.before.data().userId)
        .get()
        .then(data => {
          data.forEach(doc => {
            const question = db.doc(`/questions/${doc.id}`);
            batch.update(question, { authorImg: change.after.data().imageUrl });
          });
          return batch.commit();
        });
    } else return true;
  });

exports.createNotificationOnVote = functions
  .region("us-central1")
  .firestore.document("/questions/{questionId}/")
  .onUpdate((snapshot, context) => {
    try {
      // @ Retrieve the current and previous value
      const { questionId } = context.params;
      const data = snapshot.after.data();
      const previousData = snapshot.before.data();

      // @ We'll only update if the name has changed.
      // @ This is crucial to prevent infinite loops.
      if (
        data.optionOne.votes.length == previousData.optionOne.votes.length &&
        data.optionTwo.votes.length == previousData.optionTwo.votes.length
      )
        return null;

      // ===========================================================
      // @ Logic as cloud function triggers with event queues
      // ===========================================================

      if (
        data.optionOne.votes.includes(context.auth.uid) ||
        data.optionTwo.votes.includes(context.auth.uid)
      )
        return db
          .collection(`notifications`)
          .doc()
          .set({
            createdAt: new Date().toISOString(),
            recipient: snapshot.data().authorId,
            sender: context.auth.uid,
            type: "vote",
            read: false,
            questionId: questionId
          })
          .catch(err => console.error(err));
    } catch (err) {
      console.error(err);
    }
  });

// @ wipe questionID from author and voter's doc
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
        return db
          .collection("notifications")
          .where("recipient", "==", context.auth.uid)
          .where("questionId", "==", questionId)
          .get();
      })
      .then(data => {
        data.forEach(doc => {
          batch.delete(db.doc(`/notifications/${doc.id}`)); // delete notifications
        });
        return batch.commit();
      })
      .catch(err => console.error(err));
  });

// UNMARKED

// Global variable
// function hasChange(votes, previousVotes) {
//   let change = votes.filter(vote => !previousVotes.includes(vote));
//   return change;
// }

/**
 * exports.createNotificationOnVote = functions
  .region("us-central1")
  .firestore.document("/questions/{questionId}/")
  .onUpdate((snapshot, context) => {
    try {
    // @ Retrieve the current and previous value
    const { questionId } = context.params;
    const data = snapshot.after.data();
    const previousData = snapshot.before.data();

    //  ==================================
      @ Logic if voters were able to unvote

      let {change} = hasChange()
      if (!change || change.length === 0) return null;
      if (change.length === 1) {
        // update notification
      } else if (change.length > 1) {
        // loop change
        // batch update notification
      }
    // ===================================

    // We'll only update if the name has changed.
    // This is crucial to prevent infinite loops.

    if (
      data.optionOne.votes.length == previousData.optionOne.votes.length &&
      data.optionTwo.votes.length == previousData.optionTwo.votes.length
    )
      return null;

    // ===========================================================
    // @ Logic if cloud function triggers without event queues
    // ===========================================================
    
    // Retrieve the current voteID
    let whatChange =
      data.optionOne.votes.length !== previousData.optionOne.votes.length
        ? hasChange(data.optionOne.votes, previousData.optionOne.votes)
        : data.optionTwo.votes.length == !previousData.optionTwo.votes.length
        ? hasChange(data.optionTwo.votes, previousData.optionTwo.votes)
        : null;

    if (!whatChange || whatChange === "undefined" || whatChange === null) {
      return null;
    }

    if (whatChange.length === 1 && whatChange.includes(context.auth.uid)) {
      return db.doc(`/notifications/${snapshot.id}`).set({
        createdAt: new Date().toISOString(),
        recipient: snapshot.data().authorId,
        sender: context.auth.uid,
        type: "vote",
        read: false,
        questionId: questionId
      });
    } else if (whatChange.length > 1) {
      return whatChange.forEach(voteID => {
        const notify = db.doc(`/notifications/${snapshot.id}`);
        db.batch().create(notify, {
          createdAt: new Date().toISOString(),
          recipient: snapshot.data().authorId,
          sender: voteID,
          type: "vote",
          read: false,
          questionId: questionId
        });
        return batch.commit();
      });
    }
  } catch (err) {
    console.error(err);
  }
});

// Example from firebase documentation
// Listen for updates to any `user` document.
exports.countNameChanges = functions.firestore
    .document('users/{userId}')
    .onUpdate((change, context) => {
      // Retrieve the current and previous value
      const data = change.after.data();
      const previousData = change.before.data();

      // We'll only update if the name has changed.
      // This is crucial to prevent infinite loops.
      if (data.name == previousData.name) return null;

      // Retrieve the current count of name changes
      let count = data.name_change_count;
      if (!count) {
        count = 0;
      }

      // Then return a promise of a set operation to update the count
      return change.after.ref.set({
        name_change_count: count + 1
      }, {merge: true});
    });

 */
