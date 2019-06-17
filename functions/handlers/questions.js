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
    if (
      !req.body &&
      req.body.trim() === "" &&
      req.body.optionOne.trim() === "" &&
      req.body.optionTwo.trim() === ""
    ) {
      return res.status(400).json({ body: "Options must not be empty" });
    }

    let newQuestionRef = await db.collection("questions").doc();
    let authorProfile = await db.collection("users").doc(req.user.uid);

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

    return Promise.all([
      newQuestionRef,
      authorProfile,
      setNewQuestion,
      updateAuthorProfile
    ]).then(() => res.json(newPost));
  } catch (error) {
    console.log("postQuestion Error:", error);
    res.status(500).json({ error: "something went wrong" });
  }
};

// GET ONE QUESTION
exports.getQuestion = async (req, res) => {
  try {
    let doc = await db.doc(`questions/${req.params.questionId}`).get();
    let checkForToken = await checkAuth(req);
    let votersDetails = await db
      .collection(`/users`)
      .where(`votes`, "array-contains", doc.id)
      .limit(15)
      .get();

    // doc doesn't exist?
    if (!doc.exists) {
      return res.status(404).json({ error: "question not found" });
    }

    // copy doc
    let _d = doc.data();
    let questionData = {};
    questionData.question = doc.data();
    questionData.votersRatio = {};
    questionData.votersPercentage = {};
    questionData.yourVote = {};
    questionData.votersPhotoList = [];

    // @ votes data does'nt exist?
    // @ return --only question
    if (!_d.optionOne.votes.length && !_d.optionTwo.votes.length) {
      return res.json(questionData);
    }

    // @ vote ratio
    // @ return votersRation if option votes exist
    // @ return --else `0 out of --total votes`
    questionData.votersRatio.optionOne = _d.optionOne.votes.length
      ? `${_d.optionOne.votes.length} out of ${_d.optionOne.votes.length +
          _d.optionTwo.votes.length} votes`
      : `0 out of ${_d.optionTwo.votes.length} votes`;

    questionData.votersRatio.optionTwo = _d.optionTwo.votes.length
      ? `${_d.optionTwo.votes.length} out of ${_d.optionOne.votes.length +
          _d.optionTwo.votes.length} votes`
      : `0 out of ${_d.optionOne.votes.length} votes`;

    // @ vote percentage
    // @ return votersPercentage if option votes exist
    // @ return --else `no votes yet`
    questionData.votersPercentage.optionOne = _d.optionOne.votes.length
      ? `${(_d.optionOne.votes.length /
          (_d.optionOne.votes.length + _d.optionTwo.votes.length)) *
          100}%`
      : `no votes yet`;
    questionData.votersPercentage.optionTwo = _d.optionTwo.votes.length
      ? `${(_d.optionTwo.votes.length /
          (_d.optionTwo.votes.length + _d.optionTwo.votes.length)) *
          100}%`
      : `no votes yet`;

    // @ auth user's vote
    // @ return true --else false
    // @ if accessed by auth user && question option has votes
    // @ && include auth user as voters
    questionData.yourVote.optionOne =
      checkForToken.hasUid &&
      _d.optionOne.votes &&
      _d.optionOne.votes.includes(checkForToken.userUid)
        ? true
        : false;
    questionData.yourVote.optionTwo =
      checkForToken.hasUid &&
      _d.optionTwo.votes &&
      _d.optionTwo.votes.includes(checkForToken.userUid)
        ? true
        : false;
    // }

    // @ return 15 voters profile
    let addVotersDetailsToQuestionData = await function(
      votersDetails,
      questionData
    ) {
      // @ return questionsData so far if no voters profile
      if (votersDetails.empty) {
        return;
      }
      // @ return 15 voters profile picture && id
      votersDetails.forEach(voter => {
        questionData.votersPhotoList.push({
          voterId: voter.id,
          voterName: voter.data().fullname,
          voterImageUrl: voter.data().imageUrl
        });
      });
    };

    return Promise.all([
      doc,
      checkForToken,
      votersDetails,
      addVotersDetailsToQuestionData(votersDetails, questionData)
    ]).then(() => {
      return res.json(questionData);
    });
  } catch (error) {
    console.log("getQuestion error catching........>>>>>>>>", error);
    return res.status(500).json({ error: error.code });
  }
};

// ANWSER postVote
exports.postVote = async (req, res) => {
  try {
    if (
      !req.body &&
      req.body.trim() === "" &&
      req.body.vote.trim() === "" &&
      (req.body.vote.trim() !== "optionOne" ||
        req.body.vote.trim() !== "optionTwo")
    ) {
      return res.status(400).json({ body: "Nice try!" });
    }

    let doc = await db.doc(`questions/${req.params.questionId}`).get(),
      userProfile = await db
        .collection("users")
        .doc(req.user.uid)
        .get();

    // @ doc doesn't exist?
    // @ return error
    if (!doc.exists && !userProfile.exists) {
      return res.status(404).json({ error: "question not found" });
    }

    // @ if already captured?
    // @ return error
    if (doc.data().optionOne.votes.includes(req.user.uid) && userProfile.data().votes.includes(req.params.questionId)) {
      return res.status(400).json({ error: "vote already captured" });
    }

    // @ conditional update
    let questionUpdate, userProfileUpdate;
    if (req.body.vote === "optionOne") {
      questionUpdate = {
        "optionOne.votes": admin.firestore.FieldValue.arrayUnion(req.user.uid)
      };
      userProfileUpdate = {
        score: admin.firestore.FieldValue.increment(1),
        votes: admin.firestore.FieldValue.arrayUnion(req.params.questionId)
      };
    }
    if (req.body.vote === "optionTwo") {
      questionUpdate = {
        "optionTwo.votes": admin.firestore.FieldValue.arrayUnion(req.user.uid)
      };
      userProfileUpdate = {
        score: admin.firestore.FieldValue.increment(1),
        votes: admin.firestore.FieldValue.arrayUnion(req.params.questionId)
      };
    }

    let updateQuestionVotes = await doc.ref.update(questionUpdate),
    updateUserVotes = await userProfile.ref.update(userProfileUpdate);

    return Promise.all([doc, userProfile, updateQuestionVotes, updateUserVotes]).then(() =>
      res.status(201).json({ message: "captured successsfully" })
    );
  } catch (error) {
    console.log("postVote error catching........>>>>>>>>", error);
    res.status(500).json({ error: "uncaptured, please try again" });
  }
};

// @ DELETE QUESTION
// @ HAS TRIGGER >> onDeleteQusetion (wipe questionID from author and voter's doc)
exports.deleteQuestion = async (req, res) => {
  try {
    let document = db.collection('questions').doc(`${req.params.questionId}`),
      doc = await document.get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'question not found' });
    }
    if (doc.data().authorId !== req.user.uid) {
      return res.status(403).json({ error: 'Unauthorized' });
    } else {
      await document.delete();
    }
    return res.json({message: 'question deleted successfully'})
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.code });
  }
}



