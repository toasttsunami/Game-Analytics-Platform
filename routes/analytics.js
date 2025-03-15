const express = require('express');
const router = express.Router();
const db = require('../models');
const auth = require('../middleware/auth');

// Track user actions
router.post('/track', auth, async (req, res) => {
    const { action, gameId, time } = req.body;
    const playerId = req.player.id;

    try {
        let player = await db.Player.findByPk(playerId);

        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }

        let userGame = await db.UserGame.findOne({
            where: { playerId, gameId }
        });

        if (!userGame && gameId) {
            return res.status(404).json({ error: 'Game not found in user library' });
        }

        if (action === 'start_session') {
            // Store session start time in player object temporarily
            player.sessionStart = Date.now();
            await player.save();
        } else if (action === 'end_session' && player.sessionStart) {
            // Calculate session time and update total playtime
            if (gameId && userGame) {
                const sessionTime = (Date.now() - player.sessionStart) / 3600000; // Convert ms to hours
                userGame.playtime += sessionTime;
                await userGame.save();
            }
            player.sessionStart = null;
            await player.save();
        } else if (action === 'update_playtime' && time && gameId && userGame) {
            // Directly update playtime with provided value
            userGame.playtime = time;
            await userGame.save();
        } else if (action === 'complete_game' && gameId && userGame) {
            userGame.status = 'completed';
            userGame.completedDate = new Date();
            await userGame.save();
        } else if (action === 'level_complete') {
            player.levelsCompleted++;
            await player.save();
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Get player analytics
router.get('/:playerId', auth, async (req, res) => {
    try {
        // Check if requested profile is the user's own profile
        if (req.player.id !== req.params.playerId) {
            return res.status(403).json({ error: 'Not authorized to view this profile' });
        }

        const player = await db.Player.findByPk(req.params.playerId);
        
        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }

        // Get player's games
        const userGames = await db.UserGame.findAll({
            where: { playerId: req.params.playerId }
        });

        // Calculate analytics
        const totalGames = userGames.length;
        const completedGames = userGames.filter(game => game.status === 'completed').length;
        const totalPlaytime = userGames.reduce((sum, game) => sum + game.playtime, 0);
        const avgPlaytimePerGame = totalGames > 0 ? totalPlaytime / totalGames : 0;

        // Get completion rate
        const completionRate = totalGames > 0 ? (completedGames / totalGames) * 100 : 0;

        res.json({
            player: {
                id: player.id,
                username: player.username,
                email: player.email,
                levelsCompleted: player.levelsCompleted
            },
            gameStats: {
                totalGames,
                completedGames,
                gamesInProgress: userGames.filter(game => game.status === 'playing').length,
                backlogGames: userGames.filter(game => game.status === 'backlog').length
            },
            playtimeStats: {
                totalPlaytime: parseFloat(totalPlaytime.toFixed(2)),
                avgPlaytimePerGame: parseFloat(avgPlaytimePerGame.toFixed(2)),
                completionRate: parseFloat(completionRate.toFixed(2))
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;