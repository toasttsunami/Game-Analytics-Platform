const express = require('express');
const router = express.Router();
const db = require('../models');
const auth = require('../middleware/auth');
const hltb = require('howlongtobeat-js');
const hltbService = new hltb.HowLongToBeat();

// Helper function to handle HLTB API calls with timeout and retries
async function callHltbApi(method, param, retries = 2, timeout = 5000) {
    return new Promise(async (resolve, reject) => {
        let attempts = 0;
        let lastError;
        
        // Set a timeout to fail if the API takes too long
        const timeoutId = setTimeout(() => {
            reject(new Error('HLTB API timeout'));
        }, timeout);
        
        while (attempts <= retries) {
            try {
                let result;
                if (method === 'search') {
                    result = await hltbService.search(param);
                } else if (method === 'detail') {
                    result = await hltbService.detail(param);
                }
                
                clearTimeout(timeoutId);
                return resolve(result);
            } catch (err) {
                lastError = err;
                attempts++;
                // Wait briefly before retry
                if (attempts <= retries) {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }
        
        clearTimeout(timeoutId);
        reject(lastError || new Error('HLTB API failed'));
    });
}

// Search for games in HLTB database
router.get('/search/:query', auth, async (req, res) => {
    try {
        const results = await callHltbApi('search', req.params.query);
        
        if (!results || results.length === 0) {
            return res.json({ message: 'No games found', results: [] });
        }
        
        res.json(results);
    } catch (err) {
        console.error('HLTB Search Error:', err.message);
        res.status(503).json({ 
            error: 'Game search service temporarily unavailable',
            message: 'Unable to search for games at this time. Please try again later.'
        });
    }
});

// Get game details from HLTB and save to database
router.get('/details/:gameId', auth, async (req, res) => {
    try {
        const gameId = req.params.gameId;
        
        // First check if game exists in our database
        let game = await db.Game.findByPk(gameId);
        
        if (!game) {
            try {
                // Get game details from HLTB
                const gameDetail = await callHltbApi('detail', gameId);
                
                if (!gameDetail) {
                    return res.status(404).json({ error: 'Game not found in database' });
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
            } catch (apiErr) {
                console.error('HLTB API Error:', apiErr.message);
                return res.status(503).json({ 
                    error: 'Game details service temporarily unavailable',
                    message: 'Unable to fetch game details at this time. Please try again later.'
                });
            }
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
        
        if (!gameId) {
            return res.status(400).json({ error: 'Game ID is required' });
        }
        
        // Check if valid status
        const validStatuses = ['not_played', 'playing', 'completed', 'backlog'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status value' });
        }
        
        // Get game details
        let game = await db.Game.findByPk(gameId);
        
        if (!game) {
            // Try to fetch from HLTB if not in database
            try {
                const gameDetail = await callHltbApi('detail', gameId);
                
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
                    return res.status(404).json({ error: 'Game not found' });
                }
            } catch (error) {
                console.error('HLTB API Error:', error.message);
                return res.status(503).json({ 
                    error: 'Game details service temporarily unavailable',
                    message: 'Unable to fetch game details at this time. Please try again later.'
                });
            }
        }
        
        // Check if game already in library
        const existingGame = await db.UserGame.findOne({
            where: { playerId, gameId }
        });
        
        if (existingGame) {
            return res.status(400).json({ error: 'Game already in library' });
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
        
        // Validate inputs
        if (status) {
            const validStatuses = ['not_played', 'playing', 'completed', 'backlog'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ error: 'Invalid status value' });
            }
        }
        
        if (playtime !== undefined) {
            if (typeof playtime !== 'number' || playtime < 0) {
                return res.status(400).json({ error: 'Playtime must be a positive number' });
            }
        }
        
        if (rating !== undefined) {
            if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
                return res.status(400).json({ error: 'Rating must be an integer between 1 and 10' });
            }
        }
        
        // Find game in user library
        const userGame = await db.UserGame.findOne({
            where: { playerId, gameId }
        });
        
        if (!userGame) {
            return res.status(404).json({ error: 'Game not found in library' });
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
            return res.status(404).json({ error: 'Game not found in library' });
        }
        
        await userGame.destroy();
        
        res.json({ message: 'Game removed from library' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;