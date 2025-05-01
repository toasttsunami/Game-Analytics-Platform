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

        // Only validate gameId if it's provided and needed for the action
        if (gameId && ['start_session', 'end_session', 'update_playtime', 'complete_game'].includes(action)) {
            let userGame = await db.UserGame.findOne({
                where: { playerId, gameId }
            });

            if (!userGame) {
                return res.status(404).json({ error: 'Game not found in user library' });
            }
            
            // Process game-specific actions
            if (action === 'start_session') {
                // Store session start time in player object temporarily
                player.sessionStart = Date.now();
                player.sessionGameId = gameId;
                await player.save();
                
                return res.json({ success: true, message: 'Session started' });
            } 
            else if (action === 'end_session' && player.sessionStart) {
                // Verify the game ID matches the started session
                if (player.sessionGameId !== gameId) {
                    return res.status(400).json({ error: 'Game ID mismatch between session start and end' });
                }
                
                // Calculate session time and update total playtime
                const sessionTime = (Date.now() - player.sessionStart) / 3600000; // Convert ms to hours
                
                // Only update if the session time is reasonable (less than 24 hours)
                if (sessionTime < 24) {
                    userGame.playtime += sessionTime;
                    await userGame.save();
                }
                
                player.sessionStart = null;
                player.sessionGameId = null;
                await player.save();
                
                return res.json({ 
                    success: true, 
                    message: 'Session ended', 
                    sessionTime: parseFloat(sessionTime.toFixed(2)) 
                });
            } 
            else if (action === 'update_playtime' && time !== undefined) {
                // Validate time is a positive number
                if (typeof time !== 'number' || time < 0) {
                    return res.status(400).json({ error: 'Invalid playtime value' });
                }
                
                userGame.playtime = time;
                await userGame.save();
                
                return res.json({ 
                    success: true, 
                    message: 'Playtime updated',
                    newPlaytime: time
                });
            } 
            else if (action === 'complete_game') {
                userGame.status = 'completed';
                userGame.completedDate = new Date();
                await userGame.save();
                
                return res.json({ success: true, message: 'Game marked as completed' });
            }
        } 
        else if (action === 'level_complete') {
            player.levelsCompleted++;
            await player.save();
            
            return res.json({ 
                success: true, 
                message: 'Level completion recorded',
                totalLevels: player.levelsCompleted 
            });
        }

        return res.status(400).json({ error: 'Invalid action or missing required parameters' });
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