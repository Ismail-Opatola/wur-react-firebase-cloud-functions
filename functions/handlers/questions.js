const { db } = require("../util/admin");
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

      let groupQuestionsIfTokenOrReturnAsUnanswered = function({hasUid, userUid}) {
        if (
          !hasUid ||
          hasUid === "undefined" ||
          hasUid === null
        ) {
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

      return Promise.all([checkForToken, groupQuestionsIfTokenOrReturnAsUnanswered(checkForToken)]).then(() =>
        res.json(questions)
      );
    })
    .catch(err => {
      console.log("getAllQuestions Error:", err);
      return res.status(500).json({ error: err.code });
    });
};
