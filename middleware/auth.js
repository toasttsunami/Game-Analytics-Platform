const jwt = require('jsonwebtoken');
const db = require('../models');

module.exports = async function(req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if no token
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    // Get JWT secret from environment variable with fallback
    const jwtSecret = process.env.JWT_SECRET || 'gamePlatformSecret';
    
    // Verify token
    const decoded = jwt.verify(token, jwtSecret);
    
    // Add player data to request
    req.player = decoded.player;
    
    // Verify player still exists in database
    const playerExists = await db.Player.findByPk(req.player.id);
    if (!playerExists) {
      return res.status(401).json({ msg: 'Token is not valid' });
    }
    
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};