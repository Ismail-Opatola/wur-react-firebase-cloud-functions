const { db } = require("../util/admin");

exports.getLeaderBoard = (req, res) => {
  db.collection("users")
    .where("score", ">", 0)
    .orderBy("score", "desc")
    .orderBy('createdAt', 'asc')
    .limit(50)
    .get()
    .then(data => {
        if(data.empty) {
            return res.status(404).json({message: 'no one has earned a position yet' });
        }

        let leaderboard = [], Num = 0;
        data.forEach(doc => {
            leaderboard.push({
                userId: doc.data().userId,
                username: doc.data().fullname,
                imageUrl: doc.data().imageUrl,
                created: doc.data().questions.length,
                answered: doc.data().votes.length,
                score: doc.data().score,
                position: Num++
            });
        })

        return res.json(leaderboard);
    }).catch((error) => {
        console.log('getLeaderBoard catching error........>>>>>>>>>>>.', error);
        return res.status(500).json({error: error.code })
    });
};
