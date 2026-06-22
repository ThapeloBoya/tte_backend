<<<<<<< HEAD
const Driver = require("../models/Driver");
const { getIO } = require("../utils/socket");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { ensureDriverProfile } = require("../utils/driverProfile");
const { logAction } = require("../utils/auditLogger");
const { notifyAdmins } = require("../utils/notify");

// Password policy matching authController
const COMMON_PASSWORDS = new Set([
  "123456","password","12345678","qwerty","123456789","12345","1234","111111","1234567","sunshine","qwerty123","iloveyou","princess","admin","welcome","666666","abc123","football","123123","monkey","dragon","michael","shadow","master","jennifer","passw0rd","trustno1","ranger","buster","thomas","tigger","robert","samsung","access","loveme","batman","andrew","hunter","ashley","121212","chelsea","michelle","jordan","superman","maggie","jessica","pepper","joshua","matthew","andrea","james","jessie","fender","flash","marley","sparky","jake","sophie","midnight","thunder","harley","fishing","orlando","compaq","dallas","maxwell","tracey","desiree","ncc1701","slayer","scarface","qwertyuiop","123321","passion","jordan23","buffalo","diablo","tinkle","tanker","thx1138","rhonda","zxcvbn","starwars","killer","hockey","george","charlie","silver","thunder","midnight","martin","buster","merlin","marina","alexis","scorpio","napoleon","hotdog","cookie","johnson","crystal","charlie","fender","cowboy","dakota","midnight","thunder","compton","scooter","winter","spider","miller","cameron","snapper","samson","raymond","richard","gabriel","jaguar","johanna","william","julian","brandon","anthony","alexander","daniel","david","george","jason","james","joseph","kyle","matthew","nicholas","robert","ryan","samuel","stephen","thomas","timothy","tyler","william","amber","andrea","angela","anna","ashley","brittany","christina","courtney","danielle","elizabeth","emily","heather","jacqueline","jennifer","jessica","kimberly","lauren","lindsay","lisa","mary","megan","michelle","nicole","rachel","rebecca","samantha","sarah","stephanie","taylor","victoria","amanda","april","bridget","carolyn","catherine","christine","diana","elaine","gail","heidi","irene","janet","jill","joan","judy","karen","kathy","kristen","laura","linda","lori","lynn","marcia","maria","marie","martha","nancy","nina","pamela","patricia","paula","phyllis","robin","sandra","sharon","sherry","susan","tammy","tracy","valerie","veronica","vicki","vicky","wendy","yvonne","aaron","adam","adrian","alan","albert","alex","allen","andre","arthur","barry","benjamin","billy","bobby","brad","brett","brian","bruce","bryan","byron","caleb","calvin","carl","carlos","casey","cedric","chad","chris","clarence","clayton","clifford","clyde","colin","corey","cornelius","craig","curtis","dale","damian","damien","dana","darren","darryl","daryl","dean","dennis","derek","derrick","dewayne","don","donald","douglas","dustin","dwayne","earl","eddie","edgar","edward","edwin","elijah","elliot","elmer","emanuel","eric","erik","ernest","eugene","evan","everett","felipe","felix","fernando","floyd","francis","frank","franklin","fred","freddie","frederick","gabriel","garrett","gary","gavin","gene","geoffrey","gerald","gerard","gilbert","glen","glenn","gonzalo","gordon","graham","grant","greg","gregory","guillermo","gustavo","hans","harold","harry","harvey","hector","henry","herbert","herman","homer","horace","howard","hugh","hugo","ian","ignacio","ivan","jack","jackie","jacob","jaime","jake","jalen","jamal","jamaal","jamel","jamie","jamison","jan","jarred","jarrod","jarvis","javier","jay","jaymes","jaylen","jean","jedidiah","jeff","jeffery","jeffrey","jeremiah","jeremy","jermaine","jerome","jerry","jesse","jesus","jim","jimmy","joaquin","jody","joe","joel","johnathan","johnathon","johnny","jon","jonah","jonas","jonathan","jonathon","jordan","jordyn","jorge","jose","josef","joseph","josh","joshua","juan","julian","julio","julius","justin","kareem","karl","kasey","keith","kelvin","ken","kendall","kendrick","kenneth","kenny","keon","kevin","khalil","kirk","kristian","kristofer","kristopher","kurt","kyle","lamar","lance","larry","laurence","lawrence","leandro","lee","leo","leon","leonard","leonardo","leonel","leroy","leslie","lester","levi","lewis","lionel","lloyd","logan","lonnie","loren","lorenzo","louie","louis","lowell","lucas","luke","marc","marcus","marion","mark","markus","marquis","marshall","martin","marty","marvin","mason","mateo","mathew","matt","matthew","maurice","mauricio","max","maxwell","maynard","mckinley","melvin","michael","michal","miguel","mike","milton","mitchell","mohammad","mohammed","moises","monte","monty","morgan","morris","moses","muhammad","myles","nathan","nathaniel","neal","nelson","nestor","neville","nick","nickolas","nicolas","nigel","noah","noel","nolan","norman","norris","oliver","omar","orlando","orville","oscar","owen","pablo","patrick","paul","pedro","percy","perry","pete","peter","philip","phillip","pierre","preston","quinton","rafael","raleigh","ralph","ramiro","ramon","randal","randall","randolph","randy","raphael","rashad","raul","ray","raymon","raymond","reggie","reginald","reid","reuben","rex","reyes","reynaldo","rhett","ricardo","rich","richard","ricky","rico","riley","rob","robbie","robert","roberto","rodney","rodolfo","rodrigo","rogelio","roger","roland","rolando","roman","ron","ronald","ronnie","rosa","roscoe","ross","roy","royal","ruben","rudy","russell","ryan","salvador","salvatore","sam","sammy","samuel","sandy","santiago","santos","saul","scot","scott","sean","sebastian","sedrick","serge","sergio","seth","seymour","shane","shannon","shaun","shawn","shayne","shelby","sheldon","sherman","sidney","silas","simon","solomon","spencer","stan","stanley","stefan","stephan","stephen","sterling","steve","steven","stewart","stuart","sylvester","tad","talbot","tanner","tate","taylor","ted","teddy","terence","terrance","terrell","terrence","terry","tevin","thad","theo","theodore","thomas","tim","timmy","timothy","tobias","toby","tod","todd","tom","tomas","tommy","tony","tracy","travis","trent","trenton","trevor","trey","tristan","troy","truman","tucker","ty","tyler","tyree","tyrell","tyrone","tyshawn","tyson","ulysses","vance","vernon","vicente","victor","vincent","vince","virgil","virgilio","vito","vladimir","wade","walker","wallace","walter","ward","warren","wayne","weldon","wendell","wesley","weston","wilbert","wilbur","wilfred","wilfredo","wilhelm","will","willard","william","willie","willis","winston","wyatt","xavier","zachary","zachery","zack","zackary","zackery","zane","pass","pass123","pass1234","qwerty1","qwerty12","qwerty1234","qwerty12345","abc1234","abc12345","abc123456","letmein","welcome1","admin123","test123","test","temp123","changeme","default","123qwe","qwe123","1q2w3e4r","12qwaszx","zaqxsw","xsw2zaq1","qawsedrf","password1","password12","password123","password1234","passw0rd","p@ssword","p@ssw0rd","qwerty12345","Qwerty123","Password1","Password123",
]);

const validatePassword = (password) => {
  if (!password || password.length < 9) return "Password must be at least 9 characters.";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
  if (!/[^a-zA-Z0-9]/.test(password)) return "Password must contain at least one special character.";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "Password is too common. Please choose a different one.";
  return null;
};

// 🔧 Normalize location
const formatLocation = (loc) => {
  if (!loc) return null;

  if (
    loc.type === "Point" &&
    Array.isArray(loc.coordinates) &&
    loc.coordinates.length === 2
  ) {
    return loc;
  }

  if (typeof loc.lat === "number" && typeof loc.lng === "number") {
    return {
      type: "Point",
      coordinates: [loc.lng, loc.lat],
    };
  }

  return null;
};

// --- CREATE DRIVER ---
exports.createDriver = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      licenseNumber,
      status,
      location,
      password,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    const pwdErr = validatePassword(password);
    if (pwdErr) {
      return res.status(400).json({ message: pwdErr });
    }

    // check existing user
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "driver",
    });

    // driver data
    const driverData = {
      user: user._id,
      name,
      email,
      phone,
      licenseNumber,
      status: status || "available",
      role: "driver",
    };

    const formattedLocation = formatLocation(location);

    if (formattedLocation) {
      driverData.location = formattedLocation;
    }

    // create driver
    const driver = await Driver.create(driverData);

    await logAction({
      action: "created", entity: "Driver", entityId: driver._id, req,
      details: `Created driver ${name} (${email})`,
    });

    await notifyAdmins({
      title: "New Driver Created",
      message: `Driver ${name} (${email}) was created by ${req.user?.name || "admin"}`,
      entity: "Driver", entityId: driver._id, action: "created",
    });

    const io = getIO();
    if (io) io.emit("driverCreated", driver);

    res.status(201).json({
      message: "Driver created successfully",
      driver,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// --- GET ALL DRIVERS ---
exports.getDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find();
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// --- UPDATE DRIVER ---
exports.updateDriver = async (req, res) => {
  try {
    const { name, email, phone, licenseNumber, status, location } = req.body;

    const updateData = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (licenseNumber) updateData.licenseNumber = licenseNumber;
    if (status) updateData.status = status;

const driver = await Driver.findByIdAndUpdate(
  req.params.id,
  updateData,
  { new: true }
);

    if (!driver) return res.status(404).json({ message: "Driver not found" });

    await logAction({
      action: "updated", entity: "Driver", entityId: req.params.id, req,
      details: `Updated driver ${driver.name} (${driver.email})`,
      metadata: { changes: Object.keys(req.body) },
    });

    const io = getIO();
    if (io) io.emit("driverUpdated", driver);

    res.json(driver);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// --- UPDATE LOCATION ONLY ---
exports.updateDriverLocation = async (req, res) => {
  try {
    const { location } = req.body;

    const profile = await ensureDriverProfile(req.user);

    if (!profile) {
      return res.status(404).json({ message: "Driver not found" });
    }

const driver = await Driver.findByIdAndUpdate(
  profile._id,
  { location, lastUpdated: new Date() },
  { new: true }
);

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

const io = req.app.get("io");

if (io) {
  io.emit("driverLocationUpdate", {
    driverId: driver._id,
    name: driver.name,
    location: driver.location,
    status: driver.status,
  });
}

    res.json(driver);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
// --- DELETE ---
exports.deleteDriver = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    await driver.softDelete(req.user?.email);

    await logAction({
      action: "deleted", entity: "Driver", entityId: req.params.id, req,
      details: `Deleted driver ${driver.name}`,
    });

    const io = getIO();
    if (io) io.emit("driverDeleted", { id: req.params.id });

    res.json({ message: "Driver deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// --- UPDATE DRIVER PROFILE (self-service) ---
exports.updateDriverProfile = async (req, res) => {
  try {
    const { name, phone, licenseNumber } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (licenseNumber) updateData.licenseNumber = licenseNumber;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const driver = await ensureDriverProfile(req.user);

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    const updated = await Driver.findByIdAndUpdate(driver._id, updateData, { new: true });

    const io = getIO();
    if (io) io.emit("driverUpdated", updated);

    res.json({ message: "Profile updated", driver: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getDriverProfile = async (req, res) => {
  try {
    const driver = await ensureDriverProfile(req.user);

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    res.json(driver);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
=======
const Driver = require("../models/Driver");

exports.createDriver = async (req, res) => {
  try {
    const driver = await Driver.create(req.body);
    res.status(201).json(driver);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getDrivers = async (req, res) => {
  const drivers = await Driver.find();
  res.json(drivers);
};

exports.getDriverById = async (req, res) => {
  const driver = await Driver.findById(req.params.id);
  if (!driver) return res.status(404).json({ message: "Driver not found" });
  res.json(driver);
};

exports.updateDriver = async (req, res) => {
  const driver = await Driver.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!driver) return res.status(404).json({ message: "Driver not found" });
  res.json(driver);
};

// DELETE DRIVER
exports.deleteDriver = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    await driver.deleteOne();
    res.json({ message: "Driver removed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
>>>>>>> 55959f3276306c10d1f85d755c132fda848ed0a1
