const express = require('express');
const db = require('../models');
const router = express.Router();

router.get('/:playerId', async (req, res) => {
    const player = await db.Player.findByPk(req.params.playerId);

    if (!player) {
        return res.status(404).json({ error: 'Player not found' });
    }

    const playedGames = player.gameHistory;
    const recommendedGames = ['Game A', 'Game B', 'Game C'].filter(game => !playedGames.includes(game));

    res.json(recommendedGames);
});

module.exports = router;
