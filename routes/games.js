const express = require('express');
const router = express.Router();
const db = require('../models');
const auth = require('../middleware/auth');
const hltb = require('howlongtobeat-js');
const hltbService = new hltb.HowLongToBeat();

// Search for games in HLTB database
router.get('/search/:query', auth, async (req, res) => {
    try {
        const results = await hltbService.search(req.params.query);
        res.json(results);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Get game details from HLTB and save to database
router.get('/details/:gameId', auth, async (req, res) => {
    try {
        const gameId = req.params.gameId;
        
        // First check if game exists in our database
        let game = await db.Game.findByPk(gameId);
        
        if (!game) {
            // Get game details from HLTB
            const gameDetail = await hltbService.detail(gameId);
            
            if (!gameDetail) {
                return res.status(404).json({ msg: 'Game not found in HLTB database' });
            }
            
            // Save game to database
            game = await db.Game.create({
                id: gameId,
                name: gameDetail.name,
                imageUrl: gameDetail.imageUrl,
                description: gameDetail.description || '',
                platforms: gameDetail.platforms || [],
                genres: gameDetail.genres || [],
                developer: gameDetail.developer || '',
                publisher: gameDetail.publisher || '',
                releaseDate: gameDetail.releaseDate ? new Date(gameDetail.releaseDate) : null,
                mainStoryTime: gameDetail.gameplayMain || null,
                mainPlusExtrasTime: gameDetail.gameplayMainExtra || null,
                completionistTime: gameDetail.gameplayCompletionist || null
            });
        }
        res.json(game);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Add game to user library
router.post('/add-to-library', auth, async (req, res) => {
    try {
        const playerId = req.player.id;
        const { gameId, status = 'not_played' } = req.body;
        
        // Get game details
        let game = await db.Game.findByPk(gameId);
        
        if (!game) {
            // Try to fetch from HLTB if not in database
            try {
                const gameDetail = await hltbService.detail(gameId);
                
                if (gameDetail) {
                    game = await db.Game.create({
                        id: gameId,
                        name: gameDetail.name,
                        imageUrl: gameDetail.imageUrl,
                        description: gameDetail.description || '',
                        platforms: gameDetail.platforms || [],
                        genres: gameDetail.genres || [],
                        developer: gameDetail.developer || '',
                        publisher: gameDetail.publisher || '',
                        releaseDate: gameDetail.releaseDate ? new Date(gameDetail.releaseDate) : null,
                        mainStoryTime: gameDetail.gameplayMain || null,
                        mainPlusExtrasTime: gameDetail.gameplayMainExtra || null,
                        completionistTime: gameDetail.gameplayCompletionist || null
                    });
                } else {
                    return res.status(404).json({ msg: 'Game not found' });
                }
            } catch (error) {
                return res.status(404).json({ msg: 'Game not found' });
            }
        }
        
        // Check if game already in library
        const existingGame = await db.UserGame.findOne({
            where: { playerId, gameId }
        });
        
        if (existingGame) {
            return res.status(400).json({ msg: 'Game already in library' });
        }
        
        // Add to user library
        const userGame = await db.UserGame.create({
            playerId,
            gameId,
            gameName: game.name,
            gameImage: game.imageUrl,
            status,
            playtime: 0
        });
        
        res.json(userGame);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Update game in user library
router.put('/update-library/:gameId', auth, async (req, res) => {
    try {
        const playerId = req.player.id;
        const { gameId } = req.params;
        const { status, playtime, rating } = req.body;
        
        // Find game in user library
        const userGame = await db.UserGame.findOne({
            where: { playerId, gameId }
        });
        
        if (!userGame) {
            return res.status(404).json({ msg: 'Game not found in library' });
        }
        
        // Update fields
        if (status) userGame.status = status;
        if (playtime !== undefined) userGame.playtime = playtime;
        if (rating) userGame.rating = rating;
        
        // If status changed to completed, update completed date
        if (status === 'completed' && userGame.status !== 'completed') {
            userGame.completedDate = new Date();
        }
        
        await userGame.save();
        
        res.json(userGame);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Get user library
router.get('/library', auth, async (req, res) => {
    try {
        const playerId = req.player.id;
        
        const userGames = await db.UserGame.findAll({
            where: { playerId },
            include: [
                {
                    model: db.Player,
                    as: 'player',
                    attributes: ['username']
                }
            ]
        });
        
        res.json(userGames);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Remove game from library
router.delete('/library/:gameId', auth, async (req, res) => {
    try {
        const playerId = req.player.id;
        const { gameId } = req.params;
        
        const userGame = await db.UserGame.findOne({
            where: { playerId, gameId }
        });
        
        if (!userGame) {
            return res.status(404).json({ msg: 'Game not found in library' });
        }
        
        await userGame.destroy();
        
        res.json({ msg: 'Game removed from library' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;