const express = require('express');
const db = require('../models');
const router = express.Router();

router.post('/track', async (req, res) => {
    const { playerId, action, level } = req.body;

    let player = await db.Player.findByPk(playerId);

    if (!player) {
        return res.status(404).json({ error: 'Player not found' });
    }

    if (action === 'start') {
        player.playtime = Date.now();
    } else if (action === 'end') {
        const sessionTime = (Date.now() - player.playtime) / 1000;
        player.playtime += sessionTime;
    } else if (action === 'levelComplete') {
        player.levelsCompleted++;
    }

    await player.save();
    res.json({ success: true });
});

router.get('/:playerId', async (req, res) => {
    const player = await db.Player.findByPk(req.params.playerId);
    if (!player) {
        return res.status(404).json({ error: 'Player not found' });
    }
    res.json(player);
});

module.exports = router;
