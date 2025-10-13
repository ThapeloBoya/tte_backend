// roleMiddleware.js
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Role not authorized" });
  }
  next();
};

module.exports = { authorize };