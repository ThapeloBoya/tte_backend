const COMMON_PASSWORDS = new Set([
  "123456","password","12345678","qwerty","123456789","12345","1234","111111","1234567",
  "sunshine","qwerty123","iloveyou","princess","admin","welcome","666666","abc123",
  "football","123123","monkey","dragon","michael","shadow","master","jennifer",
  "passw0rd","trustno1","ranger","buster","thomas","tigger","robert","samsung",
  "access","loveme","fuckme","batman","andrew","hunter","asshole","ashley","121212",
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

module.exports = { validatePassword, COMMON_PASSWORDS };
