
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const QRCode = require("qrcode");
const { ensureDriverProfile } = require("../utils/driverProfile");
const { sendEmail } = require("../utils/email");
const { logAction } = require("../utils/auditLogger");
const { notifyAdmins } = require("../utils/notify");

const SALT_ROUNDS = 12;

// Common password blocklist (top 1000 most common)
const COMMON_PASSWORDS = new Set([
  "123456","password","12345678","qwerty","123456789","12345","1234","111111","1234567",
  "sunshine","qwerty123","iloveyou","princess","admin","welcome","666666","abc123",
  "football","123123","monkey","dragon","michael","shadow","master","jennifer",
  "passw0rd","trustno1","ranger","buster","thomas","tigger","robert","samsung",
  "access","loveme","fuckme","batman","andrew","hunter","asshole","ashley","121212",
  "chelsea","michelle","jordan","superman","maggie","jessica","pepper","joshua",
  "matthew","andrea","james","jessie","fender","flash","marley","sparky","jake",
  "sophie","midnight","thunder","harley","fishing","orlando","compaq","dallas",
  "maxwell","tracey","desiree","ncc1701","slayer","scarface","qwertyuiop","123321",
  "passion","jordan23","buffalo","diablo","tinkle","tanker","thx1138","rhonda",
  "zxcvbn","starwars","killer","hockey","george","andrea","matthew","jessica",
  "charlie","silver","thunder","midnight","martin","buster","merlin","marina",
  "alexis","scorpio","napoleon","hotdog","cookie","johnson","crystal","charlie",
  "fender","cowboy","dakota","midnight","thunder","compton","scooter","winter",
  "spider","miller","cameron","snapper","samson","raymond","richard","gabriel",
  "jaguar","johanna","william","julian","brandon","anthony","alexander","daniel",
  "david","george","jason","james","joseph","kyle","matthew","nicholas","robert",
  "ryan","samuel","stephen","thomas","timothy","tyler","william","amber","andrea",
  "angela","anna","ashley","brittany","christina","courtney","danielle","elizabeth",
  "emily","heather","jacqueline","jennifer","jessica","kimberly","lauren","lindsay",
  "lisa","mary","megan","michelle","nicole","rachel","rebecca","samantha","sarah",
  "stephanie","taylor","victoria","amanda","april","bridget","carolyn","catherine",
  "christine","diana","elaine","gail","heidi","irene","janet","jill","joan","judy",
  "karen","kathy","kristen","laura","linda","lori","lynn","marcia","maria","marie",
  "martha","nancy","nina","pamela","patricia","paula","phyllis","robin","sandra",
  "sharon","sherry","susan","tammy","tracy","valerie","veronica","vicki","vicky",
  "wendy","yvonne","aaron","adam","adrian","alan","albert","alex","allen","andre",
  "arthur","barry","benjamin","billy","bobby","brad","brett","brian","bruce",
  "bryan","byron","caleb","calvin","carl","carlos","casey","cedric","chad","chris",
  "clarence","clayton","clifford","clyde","colin","corey","cornelius","craig",
  "curtis","dale","damian","damien","dana","darren","darryl","daryl","dean","dennis",
  "derek","derrick","dewayne","don","donald","douglas","dustin","dwayne","earl",
  "eddie","edgar","edward","edwin","elijah","elliot","elmer","emanuel","eric","erik",
  "ernest","eugene","evan","everett","felipe","felix","fernando","floyd","francis",
  "frank","franklin","fred","freddie","frederick","gabriel","garrett","gary","gavin",
  "gene","geoffrey","gerald","gerard","gilbert","glen","glenn","gonzalo","gordon",
  "graham","grant","greg","gregory","guillermo","gustavo","hans","harold","harry",
  "harvey","hector","henry","herbert","herman","homer","horace","howard","hugh",
  "hugo","ian","ignacio","ivan","jack","jackie","jacob","jaime","jake","jalen",
  "jamal","jamaal","jamel","jamie","jamison","jan","jarred","jarrod","jarvis",
  "javier","jay","jaymes","jaylen","jean","jedidiah","jeff","jeffery","jeffrey",
  "jeremiah","jeremy","jermaine","jerome","jerry","jesse","jesus","jim","jimmy",
  "joaquin","jody","joe","joel","johnathan","johnathon","johnny","jon","jonah",
  "jonas","jonathan","jonathon","jordan","jordyn","jorge","jose","josef","joseph",
  "josh","joshua","juan","julian","julio","julius","justin","kareem","karl",
  "kasey","keith","kelvin","ken","kendall","kendrick","kenneth","kenny","keon",
  "kevin","khalil","kirk","kristian","kristofer","kristopher","kurt","kyle",
  "lamar","lance","larry","laurence","lawrence","leandro","lee","leo","leon",
  "leonard","leonardo","leonel","leroy","leslie","lester","levi","lewis","lionel",
  "lloyd","logan","lonnie","loren","lorenzo","louie","louis","lowell","lucas",
  "luke","marc","marcus","marion","mark","markus","marquis","marshall","martin",
  "marty","marvin","mason","mateo","mathew","matt","matthew","maurice","mauricio",
  "max","maxwell","maynard","mckinley","melvin","michael","michal","miguel",
  "mike","milton","mitchell","mohammad","mohammed","moises","monte","monty",
  "morgan","morris","moses","muhammad","myles","nathan","nathaniel","neal",
  "nelson","nestor","neville","nick","nickolas","nicolas","nigel","noah","noel",
  "nolan","norman","norris","oliver","omar","orlando","orville","oscar","owen",
  "pablo","patrick","paul","pedro","percy","perry","pete","peter","philip",
  "phillip","pierre","preston","quinton","rafael","raleigh","ralph","ramiro",
  "ramon","randal","randall","randolph","randy","raphael","rashad","raul","ray",
  "raymon","raymond","reggie","reginald","reid","reuben","rex","reyes","reynaldo",
  "rhett","ricardo","rich","richard","ricky","rico","riley","rob","robbie",
  "robert","roberto","rodney","rodolfo","rodrigo","rogelio","roger","roland",
  "rolando","roman","ron","ronald","ronnie","rosa","roscoe","ross","roy","royal",
  "ruben","rudy","russell","ryan","salvador","salvatore","sam","sammy","samuel",
  "sandy","santiago","santos","saul","scot","scott","sean","sebastian","sedrick",
  "serge","sergio","seth","seymour","shane","shannon","shaun","shawn","shayne",
  "shelby","sheldon","sherman","sidney","silas","simon","solomon","spencer",
  "stan","stanley","stefan","stephan","stephen","sterling","steve","steven",
  "stewart","stuart","sylvester","tad","talbot","tanner","tate","taylor","ted",
  "teddy","terence","terrance","terrell","terrence","terry","tevin","thad",
  "theo","theodore","thomas","tim","timmy","timothy","tobias","toby","tod",
  "todd","tom","tomas","tommy","tony","tracy","travis","trent","trenton",
  "trevor","trey","tristan","troy","truman","tucker","ty","tyler","tyree",
  "tyrell","tyrone","tyshawn","tyson","ulysses","vance","vernon","vicente",
  "victor","vincent","vince","virgil","virgilio","vito","vladimir","wade",
  "walker","wallace","walter","ward","warren","wayne","weldon","wendell",
  "wesley","weston","wilbert","wilbur","wilfred","wilfredo","wilhelm","will",
  "willard","william","willie","willis","winston","wyatt","xavier","zachary",
  "zachery","zack","zackary","zackery","zane","zollie","pass","pass123","pass1234",
  "qwerty1","qwerty12","qwerty1234","qwerty12345","abc1234","abc12345","abc123456",
  "letmein","welcome1","admin123","test123","test","temp123","changeme","default",
  "123qwe","qwe123","1q2w3e4r","12qwaszx","zaqxsw","xsw2zaq1","qawsedrf",
  "password1","password12","password123","password1234","passw0rd","p@ssword",
  "p@ssw0rd","qwerty12345","Qwerty123","Password1","Password123",
]);

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1d" });
};

const validatePassword = (password) => {
  if (!password || password.length < 9) return "Password must be at least 9 characters.";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
  if (!/[^a-zA-Z0-9]/.test(password)) return "Password must contain at least one special character.";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "Password is too common. Please choose a different one.";
  return null;
};

// Register new user
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }

    const pwdError = validatePassword(password);
    if (pwdError) return res.status(400).json({ message: pwdError });

    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: "User already exists" });

    // Unauthenticated requests can only register as "driver"
    const assignedRole = (!req.user && role !== "driver") ? "driver" : (role || "driver");

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: assignedRole
    });

    if (user.role === "driver") {
      await ensureDriverProfile(user);
    }

    await logAction({
      action: "register", entity: "User", entityId: user._id, req,
      details: `User ${user.email} registered as ${user.role}`,
    });

    if (user.role === "driver") {
      await notifyAdmins({
        title: "New Driver Registered",
        message: `Driver ${user.name} (${user.email}) has signed up.`,
        entity: "User", entityId: user._id, action: "register",
      });
    }

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id)
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Registration failed. Please try again." });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    if (!user.isActive) return res.status(403).json({ message: "Account is deactivated. Contact your administrator." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    await logAction({
      action: "login", entity: "User", entityId: user._id, req,
      details: `User ${user.email} logged in as ${user.role}`,
    });

    if (user.mfaEnabled) {
      const mfaSessionToken = crypto.randomBytes(32).toString("hex");
      const hashedSessionToken = crypto.createHash("sha256").update(mfaSessionToken).digest("hex");
      user.mfaSessionToken = hashedSessionToken;
      user.mfaVerified = false;
      await user.save();

      return res.json({
        mfaRequired: true,
        mfaSessionToken,
        _id: user._id,
        email: user.email,
        name: user.name,
      });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id)
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed. Please try again." });
  }
};

// Forgot password — sends reset link via email
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(200).json({ message: "If that email exists, a reset link has been sent." });

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password/${resetToken}`;

    await logAction({
      action: "forgot_password", entity: "User", entityId: user._id, req,
      details: `Password reset requested for ${user.email}`,
    });

    await sendEmail({
      to: user.email,
      subject: "TMS — Password Reset Request",
      html: `<p>Hi ${user.name},</p>
<p>You requested a password reset for your TMS account.</p>
<p>Click the link below to reset your password. This link expires in 1 hour.</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>If you did not request this, please ignore this email.</p>`,
    });

    res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

// Reset password — validates token and updates password
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const pwdErr = validatePassword(password);
    if (pwdErr) return res.status(400).json({ message: pwdErr });

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired reset token." });

    user.password = await bcrypt.hash(password, SALT_ROUNDS);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    await logAction({
      action: "reset_password", entity: "User", entityId: user._id, req,
      details: `Password reset completed for ${user.email}`,
    });

    res.json({ message: "Password reset successful. You can now log in." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

// Change password — authenticated user changes their own password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required." });
    }

    const pwdErr = validatePassword(newPassword);
    if (pwdErr) return res.status(400).json({ message: pwdErr });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(401).json({ message: "Current password is incorrect." });

    user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await user.save();

    await logAction({
      action: "change_password", entity: "User", entityId: user._id, req,
      details: `User ${user.email} changed their password`,
    });

    res.json({ message: "Password changed successfully." });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


