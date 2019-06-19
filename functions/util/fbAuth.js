const { admin, db } = require("./admin");

module.exports = (req, res, next) => {
  let idToken;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ") &&
    req.headers.authorization.split("Bearer ")[1].trim()
  ) {
    idToken = req.headers.authorization.split("Bearer ")[1];
  } else {
    console.error("No token found");
    return res.status(403).json({ error: "Unauthorized" });
  }
  return admin
    .auth()
    .verifyIdToken(idToken)
    .then(decodedToken => {
      req.user = decodedToken;
      return db
        .collection("users")
        .where("userId", "==", req.user.uid)
        .limit(1)
        .get();
    })
    .then(data => {
      req.user.fullName = data.docs[0].data().fullname;
      req.user.imageUrl = data.docs[0].data().imageUrl;
      return next();
    })
    .catch(err => {
      console.log("Error while verifying token", err);
      return res.status(403).json({error: "Unauthorized"});
    });
};
