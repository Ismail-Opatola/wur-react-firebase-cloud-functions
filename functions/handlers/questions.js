const { admin, db } = require("../util/admin");
const checkAuth = require("../util/checkAuth");

exports.getAllQuestions = (req, res) => {
  db.collection("questions")
    .orderBy("createdAt", "desc")
    .get()
    .then(async data => {
      let questions = {
        answered: [],
        unanswered: []
      };

      let groupQuestionsIfTokenOrReturnAsUnanswered = function({
        hasUid,
        userUid
      }) {
        if (!hasUid || hasUid === "undefined" || hasUid === null) {
          data.forEach(doc => {
            questions.unanswered.push(doc.data());
          });
        } else if (hasUid) {
          data.forEach(doc => {
            doc.data().optionOne.votes.includes(userUid) ||
            doc.data().optionTwo.votes.includes(userUid)
              ? questions.answered.push(doc.data())
              : questions.unanswered.push(doc.data());
          });
        }
      };

      let checkForToken = await checkAuth(req);

      return Promise.all([
        checkForToken,
        groupQuestionsIfTokenOrReturnAsUnanswered(checkForToken)
      ]).then(() => res.json(questions));
    })
    .catch(err => {
      console.log("getAllQuestions Error:", err);
      return res.status(500).json({ error: err.code });
    });
};

exports.postQuestion = async (req, res) => {
  try {
    console.time("START_TIME");

    let newQuestionRef = await db.collection("questions").doc();
    let authorProfile = await db
      .collection("users")
      .doc(req.user.uid);

    const newPost = {
      questionId: newQuestionRef.id,
      author: req.user.fullName, 
      authorId: req.user.uid,
      authorImg: req.user.imageUrl,
      createdAt: new Date().toISOString(),
      optionOne: {
        votes: [],
        text: req.body.optionOne
      },
      optionTwo: {
        votes: [],
        text: req.body.optionTwo
      }
    };

    let setNewQuestion = await newQuestionRef.set(newPost);
    let updateAuthorProfile = await authorProfile.update({
      questions: admin.firestore.FieldValue.arrayUnion(newQuestionRef.id),
      score: admin.firestore.FieldValue.increment(1)
    });
    
    console.timeEnd("END_TIME");

    return Promise.all([
      newQuestionRef,
      authorProfile,
      setNewQuestion,
      updateAuthorProfile
    ]).then(() => res.json(newPost));

  } catch (error) {
    console.log("postQuestion Error:", error);
  }
};
