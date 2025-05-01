const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models');
const auth = require('../middleware/auth');

// Register a new player
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if player already exists
    let playerExists = await db.Player.findOne({ where: { email } });
    if (playerExists) {
      return res.status(400).json({ msg: 'Player with this email already exists' });
    }

    playerExists = await db.Player.findOne({ where: { username } });
    if (playerExists) {
      return res.status(400).json({ msg: 'Player with this username already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create player
    const player = await db.Player.create({
      username,
      email,
      password: hashedPassword
    });

    // Create JWT payload
    const payload = {
      player: {
        id: player.id,
        username: player.username
      }
    };

    // Get JWT secret from environment variable with fallback
    const jwtSecret = process.env.JWT_SECRET || 'gamePlatformSecret';

    // Sign token
    jwt.sign(
      payload,
      jwtSecret,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Login a player
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if player exists
    const player = await db.Player.findOne({ where: { email } });
    if (!player) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, player.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Create JWT payload
    const payload = {
      player: {
        id: player.id,
        username: player.username
      }
    };

    // Get JWT secret from environment variable with fallback
    const jwtSecret = process.env.JWT_SECRET || 'gamePlatformSecret';

    // Sign token
    jwt.sign(
      payload,
      jwtSecret,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get authenticated player data
router.get('/me', auth, async (req, res) => {
  try {
    // Get player from database (exclude password)
    const player = await db.Player.findByPk(req.player.id, {
      attributes: { exclude: ['password'] }
    });

    if (!player) {
      return res.status(404).json({ msg: 'Player not found' });
    }

    res.json(player);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;