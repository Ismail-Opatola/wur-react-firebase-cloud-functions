const { admin } = require("./admin");

module.exports = async req => {
  try {
    let idToken,
      userUid = "",
      hasUid = false;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ") &&
      req.headers.authorization.split("Bearer ")[1].trim()
    ) {
      idToken = req.headers.authorization.split("Bearer ")[1];
      let getDecodedToken = await admin.auth().verifyIdToken(idToken);
      
      return Promise.resolve(getDecodedToken).then(decodedToken => {
        userUid = decodedToken.uid;
        return {
          userUid,
          hasUid: userUid ? !hasUid : hasUid
        };
      });
    } else { return { hasUid } }
  } catch (err) {
    console.log("chechAuth Error: ", err.message);
    return { hasUid: false };
  }
};

// AnOfTpowYsNpwd08KhTFDpqNpWs1 user22
// qdVhvjxLnxNf6jYSdxBpGA1QNv33 user1

// Case
// user may enter Hearders Authorization as 'Bearer <fakeToken>', 'Bearer ', 'Be', '...empty'
// If statement Checks for Auth, Auth starts with 'Bearer ', Auth contains two strings
// If error such as fake token 'Bearer <fakeToken>' return hasUid as false
