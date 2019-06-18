const { admin, db } = require("../util/admin"),
  config = require("../util/fbconfig"),
  client = require("firebase"),
  {
    validateSignupData,
    validateLoginData,
    reduceUserDetails
  } = require("../util/validation");

client.initializeApp(config);

// Sign user up
exports.signup = (req, res) => {
  const newUser = {
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    fullname: `${req.body.firstName} ${req.body.lastName}`
  };

  const { valid, errors } = validateSignupData(newUser);
  if (!valid) return res.status(400).json(errors);

  const noImg = "no-img.png";
  let userId, token;

  // @ ref: https://firebase.google.com/docs/auth/admin/verify-id-tokens
  client
    .auth()
    .createUserWithEmailAndPassword(newUser.email, newUser.password)
    .then(userRecord => {
      return userRecord.user.getIdToken();
    })
    .then(idToken => {
      token = idToken;
      // idToken comes from the client app
      return admin.auth().verifyIdToken(idToken);
    })
    .then(function(decodedToken) {
      userId = decodedToken.uid;
      const userCredentials = {
        fullname: newUser.fullname,
        createdAt: new Date().toISOString(),
        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${
          config.storageBucket
        }/o/${noImg}?alt=media`,
        score: 0,
        questions: [],
        votes: [],
        userId: userId
      };
      return db.doc(`users/${userId}`).set(userCredentials);
    })
    .then(() => {
      return res.status(201).json({ token });
    })
    .catch(err => {
      console.log("Signup error: ", err);
      if (err.code === "auth/email-already-in-use") {
        return res.status(400).json({ email: "Email already in use" });
      } else {
        return res
          .status(500)
          .json({ general: "Something went wrong, please try agin" });
      }
    });
};

// Log user in
exports.login = (req, res) => {
  const user = {
    email: req.body.email,
    password: req.body.password
  };

  let token;

  const { valid, errors } = validateLoginData(user);
  if (!valid) return res.status(400).json(errors);

  client
    .auth()
    .signInWithEmailAndPassword(user.email, user.password)
    .then(data => {
      return data.user.getIdToken();
    })
    .then(idToken => {
      token = idToken;
      return admin.auth().verifyIdToken(idToken);
    })
    .then(() => {
      return res.json({ token });
    })
    .catch(err => {
      console.log(err);
      return res.status(403).json({
        general: "Wrong credentials, please try again",
        error: err.message
      });
    });
};

exports.signOut = (req, res) => {
  return firebase
    .auth()
    .signOut()
    .then(function() {
      res.status(204).json({ message: "Sign-out successful" });
    })
    .catch(function(error) {
      console.log("signOut error catching>>>>>>>>>", error.code);
      return res.status(500).json({ error: "An error happened, try again" });
    });
};

// Upload user profile Image
// exports.uploadImage = async (req, res) => {
//   try {
//     console.log("running image upload...");
//     const BusBoy = require("busboy"),
//       path = require("path"),
//       os = require("os"),
//       fs = require("fs");

//     const busboy = new BusBoy({ headers: req.headers });

//     let imageToBeUploaded = {},
//       imageFileName;

//     await busboy.on("file", async (fieldname, file, filename, encoding, mimetype) => {
//       // console.log(fieldname, file, filename, encoding, mimetype);
//       if (mimetype !== "image/jpeg" && mimetype !== "image/png") {
//         return res.status(400).json({ error: "Wrong file type submitted" });
//       }

//       // @return extension 'png' or 'jpeg'
//       const imageExtension = filename.split(".")[
//         filename.split(".").length - 1
//       ];

//       imageFileName = `${Math.round(
//         Math.random() * 1000000000000
//       ).toString()}.${imageExtension}`;

//       const filepath = path.join(os.tmpdir(), imageFileName);
//       imageToBeUploaded = { filepath, mimetype };
//       await file.pipe(fs.createWriteStream(filepath));

//       file.on('error',function(err){
//         console.log('fstream error ' + err);
//       });

//     });

//     // busboy.on('error', (error) => {
//     //   console.log('Fix this:', error.stack, error);
//     // });

//     await busboy.on("finish", async () => {
//       await admin
//         .storage()
//         .bucket()
//         .upload(imageToBeUploaded.filepath, {
//           resumable: false,
//           metadata: {
//             metadata: {
//               contentType: imageToBeUploaded.mimetype
//             }
//           }
//         })
//         .then(() => {
//           const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${
//             config.storageBucket
//           }/o/${imageFileName}?alt=media`;

//           return db.doc(`users/${req.user.uid}`).update({ imageUrl });
//         })
//         .then(() => {
//           return res.json({ message: "image uploaded successfully" });
//         })
//         .catch(err => {
//           console.error(err);
//           return res.status(500).json({ error: "something went wrong" });
//         });
//     });

//     await busboy.on('error',function(err){
//       console.log('busboy error' + err);
//     });

//     await busboy.end(req.rawBody);

//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ error: "something went wrong" });
//   }
// };

exports.uploadImage = (req, res) => {
  // TODO: FIX ERROR FROM BOSBOY
  const BusBoy = require("busboy");
  const path = require("path");
  const os = require("os");
  const fs = require("fs");

  const busboy = new BusBoy({ headers: req.headers }); // instanciate

  let imageToBeUploaded = {};
  let imageFileName;

  busboy.on("error", function(err) {
    console.log("Busboy error catching>>>>>>>>>>", err);
  });

  busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
    if (mimetype !== "image/jpeg" && mimetype !== "image/png") {
      return res.status(400).json({ error: "Wrong file type submitted" });
    }

    file.on("error", function(err) {
      console.log("fstream error catching>>>>>>>>>>", err);
    });

    const imageExtension = filename.split(".")[filename.split(".").length - 1];

    // 32756238461724837.png
    imageFileName = `${Math.round(
      Math.random() * 1000000000000
    ).toString()}.${imageExtension}`;

    const filepath = path.join(os.tmpdir(), imageFileName);
    imageToBeUploaded = { filepath, mimetype };
    file.pipe(fs.createWriteStream(filepath));
  });

  busboy.on("finish", () => {
    admin
      .storage()
      .bucket()
      .upload(imageToBeUploaded.filepath, {
        resumable: false,
        metadata: {
          metadata: {
            contentType: imageToBeUploaded.mimetype
          }
        }
      })
      .then(() => {
        // const imgUrl to add to our user doc
        const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${
          config.storageBucket
        }/o/${imageFileName}?alt=media`;
        // access req.user.handle from fbAuth middleware
        return db.doc(`/users/${req.user.uid}`).update({ imageUrl });
      })
      .then(() => {
        return res.json({ message: "image uploaded successfully" });
      })
      .catch(err => {
        console.error(err);
        return res.status(500).json({ error: "something went wrong" });
      });
  });

  busboy.end(req.rawBody);
};

exports.addUserDetails = (req, res) => {
  let userDetails = reduceUserDetails(req.body);

  return db
    .doc(`/users/${req.user.uid}`)
    .update(userDetails)
    .then(() => {
      return res.json({ message: "Details added successfully" });
    })
    .catch(err => {
      console.log("addUserDetails error catching>>>>>>>>>>", err);
      return res.status(500).json({ error: err.code });
    });
};

// Get own user details
exports.getAuthenticatedUser = (req, res) => {
  let userData = {};
  return db
    .doc(`/users/${req.user.uid}`)
    .get()
    .then(doc => {
      if (doc.exists) {
        userData.credentials = doc.data();
        return db
          .collection("notifications")
          .where("recipient", "==", req.user.uid)
          .orderBy("createdAt", "desc")
          .limit(10)
          .get();
      }
    })
    .then(data => {
      userData.notifications = [];
      data.forEach(doc => {
        userData.notifications.push({
          recipient: doc.data().recipient,
          sender: doc.data().sender,
          createdAt: doc.data().createdAt,
          questionId: doc.data().questionId,
          type: doc.data().type,
          read: doc.data().read,
          notificationId: doc.id
        });
      });
      return res.json(userData);
    })
    .catch(err => {
      console.error("getAuthenticatedUser error catching>>>>>>>>>>", err);
      return res.status(500).json({ error: err.code });
    });
};

exports.getUserDetails = (req, res) => {
  let userData = {};
  return db
    .doc(`users/${req.params.userId}`)
    .get()
    .then(doc => {
      if (doc.exists) {
        userData.user = doc.data();
        return db
          .collection("questions")
          .where("authorId", "==", req.params.userId)
          .orderBy("createdAt", "desc")
          .get();
        // TODO: PAGINATION
      } else {
        return res.status(404).json({ error: "User not found" });
      }
    })
    .then(data => {
      userData.questions = [];
      data.forEach(doc => {
        userData.questions.push({
          questionId: doc.id,
          author: doc.data().author,
          authorId: doc.data().authorId,
          authorImg: doc.data().authorImg,
          createdAt: doc.data().createdAt,
          optionOne: {
            votes: doc.data().optionOne.votes,
            text: doc.data().optionOne.text
          },
          optionTwo: {
            votes: doc.data().optionTwo.votes,
            text: doc.data().optionTwo.text
          }
        });
      });
      return res.json(userData);
    })
    .catch(err => {
      console.log("getUserDetails error catching>>>>>>>>>>", err);
      return res.status(500).json({ error: err.code });
    });
};

// @ mark read notifications
exports.markNotificationsRead = (req, res) => {
  // when u open a dropdown that has a couple of notifications that are not read, we're gonna send to our server an array of Ids of those notifications that the user has just seen, so we can mark them as 'read' so they're not marked as unread on the client side any more...
  // use batch writes: when you need to write/update multiple docs
  let batch = db.batch();
  req.body.forEach(notificationId => {
    const notification = db.doc(`/notifications/${notificationId}`);
    batch.update(notification, { read: true });
  });
  // once the forEach is done
  batch
    .commit()
    .then(() => {
      return res.json({ message: "Notifications marked read" });
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

// @ TODO:Delete User Account
// TODO: delete user account
// TODO: delete userImg from storage
// TODO: delete user created questions from questions collection
// TODO: delete user created questionID from other users votes array
// TODO: delete user Email from firebase-auth
exports.deleteUserAccount = (req, res) => {}; // return status 204
