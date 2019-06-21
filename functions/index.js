const functions = require("firebase-functions"),
  app = require("express")(),
  { admin, db, storage } = require("./util/admin"),
  config = require("./util/fbconfig"),
  FieldValue = admin.firestore.FieldValue,
  FBAuth = require("./util/fbAuth"),
  cors = require("cors");

app.use(cors({ origin: true }));

const {
  signup,
  login,
  signOut,
  uploadImage,
  addUserDetails,
  getAuthenticatedUser,
  getUserDetails,
  markNotificationsRead,
  deleteUserAccount
} = require("./handlers/users");
const {
  getAllQuestions,
  postQuestion,
  getQuestion,
  postVote,
  deleteQuestion
} = require("./handlers/questions");
const { getLeaderBoard } = require("./handlers/leaderboard");

// ================
// EXPRESS ROUTES
// ================

// users routes
app.post("/signup", signup);
app.post("/sessions", login);
app.delete("/sessions", FBAuth, signOut);
app.post("/user/image", FBAuth, uploadImage);
app.post("/user", FBAuth, addUserDetails);
app.get("/user", FBAuth, getAuthenticatedUser);
app.delete("/user/:userId", FBAuth, deleteUserAccount);
app.get("/user/:userId", FBAuth, getUserDetails);
app.post("/notifications", FBAuth, markNotificationsRead);

// question routes
app.post("/question", FBAuth, postQuestion);
app.post("/question/:questionId", FBAuth, postVote);
app.delete("/question/:questionId", FBAuth, deleteQuestion);
app.get("/questions", getAllQuestions);
app.get("/question/:questionId", getQuestion);

// leaderboard route
app.get("/leaderboard", getLeaderBoard);

exports.api = functions.https.onRequest(app);

// =============================================
// @ FUNCTIONS >> CLOUD FIRESTORE EVENT TRIGGERS
// =============================================

exports.createNotificationOnVote = functions
  .region("us-central1")
  .firestore.document("/questions/{questionId}")
  .onUpdate((snapshot, context) => {
    try {
      if (!context.params.questionId) return Promise.resolve();

      // @ Retrieve the current and previous value
      const { questionId } = context.params,
        data = snapshot.after.data(),
        previousData = snapshot.before.data();
      let voterId;

      if (!data.optionOne.votes.length && !data.optionTwo.votes.length) {
        return Promise.resolve();
      }

      // @ We'll only update if the name has changed.
      // @ This is crucial to prevent infinite loops.
      if (
        data.optionOne.votes.length == previousData.optionOne.votes.length &&
        data.optionTwo.votes.length == previousData.optionTwo.votes.length
      )
        return Promise.resolve();

      // ======================================================
      // @ Logic as cloud function triggers with event queues
      // ======================================================
      if (data.optionOne.votes.length !== previousData.optionOne.votes.length) {
        voterId = data.optionOne.votes.slice(-1);
      } else if (
        data.optionTwo.votes.length !== previousData.optionTwo.votes.length
      ) {
        voterId = data.optionTwo.votes.slice(-1);
      }

      // if (
      //   data.optionOne.votes.includes(context.auth.uid) ||
      //   data.optionTwo.votes.includes(context.auth.uid)
      // )
      return db
        .collection(`notifications`)
        .add({
          createdAt: new Date().toISOString(),
          recipient: data.authorId,
          sender: voterId.toString(),
          type: "vote",
          read: false,
          questionId: questionId
        })
        .catch(err => console.error(err));
    } catch (err) {
      console.error(err);
    }
  });

/* 
@ Delete User Account
 @ delete user Email from firebase-auth
 @ delete user account 
 @ delete userImg from storage
 @ delete user created questions from questions collection
 onUserAccountDelete triggers onQuestionDelete
 @ delete user notifications
 @ delete user created questionID from other users votes and decrement score

 let defaultImage = "no-image"; **GLOBAL_VARIABLE**
 'https://firebasestorage.googleapis.com/v0/b/would-you-rather-app-c5895.appspot.com/o/no-img.png?alt=media'; */

// @ Delete User Image from Storage when user delete his/her account
exports.deleteFile = functions
  .region("us-central1")
  .firestore.document("/users/{userId}")
  .onDelete((change, context) => {
    try {
      let defaultImage = "no-img.png",
        imageUrl = change.data().imageUrl,
        [, , , , , bucket, , ...rest] = imageUrl.split("/"),
        filename = rest
          .toString()
          .replace(",", "/")
          .split("?alt=media")[0];

      if (filename == defaultImage) {
        return Promise.resolve();
      } else {
        console.log(`deleting bucket= ${bucket} filename= ${filename}`);
        return storage
          .bucket(bucket)
          .file(filename)
          .delete()
          .then(() => {
            console.log(`gs://${bucket}/${filename} deleted.`);
          })
          .catch(err => {
            console.error("ERROR:", err);
          });
      }
    } catch (error) {
      console.error("ERROR:", err);
    }
  });

// @ Clean all data refrences, when user delete his/her account (notifications, votes, created questions etc...)
exports.onUserAccountDelete = functions
  .region("us-central1")
  .firestore.document("/users/{userId}")
  .onDelete((snapshot, context) => {
    if (!context.params.userId) return Promise.resolve();
    const batch = db.batch();
    return db
      .collection("questions")
      .where("authorId", "==", snapshot.id)
      .get()
      .then(data => {
        data.forEach(doc => {
          // @ delete all question created by user
          batch.delete(db.doc(`questions/${doc.id}`));
        });
        return db
          .collection("questions")
          .where("optionOne.votes", "array-contains", snapshot.id)
          .get();
      })
      .then(data => {
        data.forEach(doc => {
          // @ remove user vote from all other users questions
          batch.update(db.doc(`questions/${doc.id}`), {
            "optionOne.votes": FieldValue.arrayRemove(snapshot.id)
          });
        });
        return db
          .collection("questions")
          .where("optionTwo.votes", "array-contains", snapshot.id)
          .get();
      })
      .then(data => {
        data.forEach(doc => {
          // @ remove user vote from all other users questions
          batch.update(db.doc(`questions/${doc.id}`), {
            "optionTwo.votes": FieldValue.arrayRemove(snapshot.id)
          });
        });
        // @ other users votes and score to this user created questions would be updated by onQuestionDelete trigger, onQuestionDelete trigger becomes active as soon as we start deleting all created questions by user
        return batch.commit();
      })
      .catch(err => {
        console.error(err);
      });
  });

// @ if user profile image has changed
// @ Update all user's created questions img field
exports.onUserImageChange = functions
  .region("us-central1")
  .firestore.document("/users/{userId}")
  .onUpdate(change => {
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      let defaultImage = "no-img.png",
        imageUrl = change.before.data().imageUrl,
        [, , , , , bucket, , ...rest] = imageUrl.split("/"),
        filename = rest
          .toString()
          .replace(",", "/")
          .split("?alt=media")[0];

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

          if (filename == defaultImage) {
            return Promise.resolve();
          } else {
            console.log(`deleting bucket= ${bucket} filename= ${filename}`);
            return storage
              .bucket(bucket)
              .file(filename)
              .delete();
          }
        })
        .then(() => {
          console.log(`gs://${bucket}/${filename} deleted.`);
          return batch.commit();
        })
        .catch(err => {
          console.error(err);
        });
    } else return true;
  });

// @ wipe questionID from author and voter's doc
// @ delete question vote notifications
exports.onQuestionDelete = functions
  .region("us-central1")
  .firestore.document("/questions/{questionId}")
  .onDelete((snapshot, context) => {
    if (!context.params.questionId) return Promise.resolve();
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
            votes: FieldValue.arrayRemove(questionId),
            score: FieldValue.increment(-1)
          });
        });
         return db.doc(`users/${snapshot.data().authorId}`).get();
      })
      .then(data => {
        if(data.exists){
          batch.update(data.ref, {
            questions: FieldValue.arrayRemove(questionId),
            score: FieldValue.increment(-1)
          });
        }
        return db
          .collection("notifications")
          .where("recipient", "==", snapshot.data().authorId)
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
