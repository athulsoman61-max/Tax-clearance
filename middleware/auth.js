const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const token = req.cookies?.admin_token;
  if (!token) return res.redirect('/admin/login');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    res.clearCookie('admin_token');
    return res.redirect('/admin/login');
  }
}

function apiAuthMiddleware(req, res, next) {
  const token = req.cookies?.admin_token || req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function userAuthMiddleware(req, res, next) {
  const token = req.cookies?.user_token;
  if (!token) {
    req.session = req.session || {};
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.clearCookie('user_token');
    return res.redirect('/login');
  }
}

function optionalUserAuthMiddleware(req, res, next) {
  const token = req.cookies?.user_token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      res.clearCookie('user_token');
    }
  }
  next();
}

module.exports = { authMiddleware, apiAuthMiddleware, userAuthMiddleware, optionalUserAuthMiddleware };
