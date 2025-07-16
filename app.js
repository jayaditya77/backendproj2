const express = require('express');
const app = express();
const userModel = require('./models/user');
const postModel = require('./models/post');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const upload = require('./config/multerconfig');
const path = require('path');

// Middleware
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Home page
app.get('/', (req, res) => {
  res.render('index');
});
//upload profile picture
app.get('/profile/upload', (req, res) => {
  res.render('profileupload');
});

//upload page
app.post('/upload', isLoggedIn, upload.single("image"), async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email });
  user.profilepic = req.file.filename;
  await user.save();
  res.redirect('/profile');
});

// Login page
app.get('/login', (req, res) => {
  res.render('login');
});

// Logout
app.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

// Profile page
app.get('/profile', isLoggedIn, async (req, res) => {
  const user = await userModel.findOne({ email: req.user.email }).populate('posts');
  res.render('profile', { user });
});


// Like/unlike a post
app.get('/like/:id', isLoggedIn, async (req, res) => {
  let post = await postModel.findById(req.params.id);
  if (!post) return res.status(404).send("Post not found");

  const index = post.likes.indexOf(req.user.userid);
  if (index === -1) {
    post.likes.push(req.user.userid);
  } else {
    post.likes.splice(index, 1);
  }

  await post.save();
  res.redirect("/profile");
});

//Edit 
app.get('/edit/:id', isLoggedIn, async (req, res) => {
  const post = await postModel.findById(req.params.id);
  const user = await userModel.findOne({ email: req.user.email });

  res.render('edit', { post, user });
});


// Update a post
app.post('/update/:id', isLoggedIn, async (req, res) => {
  let post = await postModel.findOneAndUpdate({ _id: req.params.id }, { content: req.body.content });
  res.redirect('/profile' );
});
// Create a new post
app.post('/posts', isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email });
  let { content } = req.body;

  let post = await postModel.create({
    user: user._id,
    content,
  });

  user.posts.push(post._id);
  await user.save();

  res.redirect('/profile');
});

// Register
app.post('/register', async (req, res) => {
  let { email, password, username, name, age } = req.body;
  let user = await userModel.findOne({ email });
  if (user) return res.status(400).send('Email already exists');

  bcrypt.genSalt(10, async (err, salt) => {
    bcrypt.hash(password, salt, async (err, hash) => {
      const newUser = await userModel.create({
        username,
        name,
        age,
        email,
        password: hash,
      });

      const token = jwt.sign({ email: newUser.email, userid: newUser._id }, "shhhh");
      res.cookie("token", token);
      res.redirect("/profile");
    });
  });
});

// Login
app.post('/login', async (req, res) => {
  let { email, password } = req.body;
  let user = await userModel.findOne({ email });
  if (!user) return res.status(400).send('Invalid credentials');

  bcrypt.compare(password, user.password, function (err, result) {
    if (result) {
      let token = jwt.sign({ email: email, userid: user._id }, "shhhh");
      res.cookie("token", token);
      res.redirect("/profile");
    } else {
      res.redirect('/login');
    }
  });
});

// Auth middleware
function isLoggedIn(req, res, next) {
  const token = req.cookies?.token;

  if (!token || token === "null" || token === "undefined") {
    return res.redirect("/login");
  }

  try {
    const data = jwt.verify(token, "shhhh");
    req.user = data;
    next();
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    return res.redirect("/login");
  }
}

// Start server
app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
