const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'crm-360-super-secret-key-12345';

// 1. Password Hashing Helper
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// 2. Password Verification Helper
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// 3. JWT Sign Helper
function generateToken(userId, role = 'client') {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' });
}

// 4. JWT Authorization Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer <TOKEN>

  if (!token) {
    return res.status(401).json({ error: 'Access token required.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.userId = decoded.userId;
    req.userRole = decoded.role || 'client';
    next();
  });
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  authenticateToken,
  JWT_SECRET,
  jwt
};
