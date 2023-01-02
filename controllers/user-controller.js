const User = require("../models/User")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")
const nodemailer = require("nodemailer")
const os = require("os")
const { findOneAndUpdate } = require("../models/User")

exports.get = async (req, res) => {
  res.send({ user: await User.findById(req.body._id) })
  console.log(req.body._id)
}

exports.getAll = async (req, res) => {
  res.send({ users: await User.find() })
}

exports.register = async (req, res) => {
  const { username, email, password, gender, bio } = req.body

  let imageFilename;
  if (req.file) {
    imageFilename = req.file.filename
  }

  if (await User.findOne({ email })) {
    res.status(403).send({ message: "User already exist !" })
  } else {
    let user = await new User({
      username,
      email,
      password: await bcrypt.hash(password, 10),
      gender,
      bio,
      imageFilename,
      isVerified: false,
      role: req.body.role,
    })

    user.save();

    // token creation
    const token = generateUserToken(user)

    await doSendConfirmationEmail(email, token, req.protocol)

    res.status(200).send({
      message: "success",
      user,
      Token: jwt.verify(token, process.env.JWT_SECRET),
    })
  }
}

exports.login = async (req, res) => {
  const { email, password } = req.body

  const user = await User.findOne({ email })

  if (user && ( await bcrypt.compare(password, user.password))) {
    const token = generateUserToken(user)

    if (!user.isVerified) {
      res.status(403).send({ user, message: "email non verifié" })
    } else {
      res.status(200).send({ token, user, message: "success" })
    }
  } else {
    res.status(403).send({ message: "mot de passe ou email incorrect" })
  }
}


exports.loginWithSocial = async (req, res) => {
  const { username, email, role } = req.body

  if (email === "") {
    res.status(403).send({ message: "error please provide an email" })
  } else {
    var user = await User.findOne({ email })
    if (user) {
      console.log("user exists, loging in")
    } else {
      console.log("user does not exists, creating an account")

      user = await new User({
        username,
        email,
        isVerified: true,
        role,
      }).save()
    }

    // token creation
    const token = generateUserToken(user)

    res.status(200).send({ message: "success", user, token: token })
  }
}

exports.sendConfirmationEmail = async (req, res) => {

  const user = await User.findOne({ email: req.body.email })

  if (user) {
    token = generateUserToken(user)

    doSendConfirmationEmail(req.body.email, token, req.protocol)

    res.status(200).send({
      message: "L'email de confirmation a été envoyé a " + user.email,
    })
  } else {
    res.status(404).send({ message: "User innexistant" })
  }
}

exports.confirmation = async (req, res) => {
  if (req.params.token) {
    try {
      token = jwt.verify(req.params.token, process.env.JWT_SECRET)
    } catch (e) {
      return res.render("confirmation.twig", {
        message:
          "The verification link may have expired, please resend the email.",
      })
    }
  } else {
    return res.render("confirmation.twig", {
      message: "no token",
    })
  }

  User.findById(token.user._id, function (err, user) {
    if (!user) {
      return res.render("confirmation.twig", {
        message: "User does not exist, please register.",
      })
    } else if (user.isVerified) {
      return res.render("confirmation.twig", {
        message: "This user has already been verified, please login",
      })
    } else {
      user.isVerified = true
      user.save(function (err) {
        if (err) {
          return res.render("confirmation.twig", {
            message: err.message,
          })
        } else {
          return res.render("confirmation.twig", {
            message: "Your account has been verified",
          })
        }
      })
    }
  })
}

exports.forgotPassword = async (req, res) => {
  const resetCode = req.body.resetCode
  const user = await User.findOne({ email: req.body.email })

  if (user) {
    // token creation
    await sendOTP(req.body.email, resetCode)

    res.status(200).send({
      message: "L'email de reinitialisation a été envoyé a " + user.email,
    })
  } else {
    res.status(404).send({ message: "User does not exist " })
  }
}

exports.updateProfile = async (req, res) => {

  let imageFilename;
  if (req.file) {
    imageFilename = req.file.filename
  }

  let user = await User.findOneAndUpdate(
    { email: req.body.email },
    {
      $set: {
        username: req.body.username,
        email: req.body.email,
        gender: req.body.gender,
        imageFilename,
        role: req.body.role
      },
    }
  )
  user.save();

  return res.send({ message: "Profile updated successfully", user })
}



exports.updatePassword = async (req, res) => {
  const { email, password } = req.body

  if (password) {
    newPasswordEncrypted = await bcrypt.hash(password, 10)

    let user = await User.findOneAndUpdate(
      { email: email },
      {
        $set: {
          password: newPasswordEncrypted,
        },
      }
    )

    return res.send({ message: "Password updated successfully", user })
  } else {
    return res.status(403).send({ message: "Password should not be empty" })
  }


}

exports.delete = async (req, res) => {
  let user = await User.findById(req.body._id)
  if (user) {
    await user.remove()
    return res.send({ message: "Users" + user._id + " have been deleted" })
  } else {
    return res.status(404).send({ message: "User does not exist" })
  }
}

exports.deleteAll = async (req, res) => {
  await User.remove({})
  res.send({ message: "All users have been deleted" })
}

///// FUNCTIONS ---------------------------------------------------------

function generateUserToken(user) {
  return jwt.sign({ user }, process.env.JWT_SECRET, {
    expiresIn: "100000000", // in Milliseconds (3600000 = 1 hour)
  })
}

async function doSendConfirmationEmail(email, token, protocol) {
  let port = process.env.PORT || 5000

  sendEmail({
    from: process.env.GMAIL_USER,
    to: email,
    subject: "Confirm your email",
    html:
      "<h3>Please confirm your email using this </h3><a href='" +
      protocol + "://" + os.hostname() + ":" + port + "/user/confirmation/" + token +
      "'>Link</a>",
  })
}



async function sendOTP(email) {
  let code = Math.floor(Math.random() * (99999 - 10000 + 1) + 10000)
  sendEmail({
    from: process.env.GMAIL_USER,
    to: email,
    subject: "Password reset",
    html:
      "<h3>You have requested to reset your password</h3><p>Your reset code is : <b style='color : blue'>" +
      code +
      "</b></p>",
  })
}

function sendEmail(mailOptions) {
  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASSWORD,
    },
  })

  transporter.verify(function (error, success) {
    if (error) {
      console.log(error)
      console.log("Server not ready")
    } else {
      console.log("Server is ready to take our messages")
    }
  })

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error)
    } else {
      console.log("Email sent: " + info.response)
    }
  })
}