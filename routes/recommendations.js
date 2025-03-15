const express = require('express');
const db = require('../models');
const router = express.Router();
const auth = require('../middleware/auth');
const { Op } = require('sequelize');
const hltb = require('howlongtobeat');
const hltbService = new hltb.HowLongToBeatService();

// Get game recommendations for a player
router.get('/:playerId', auth, async (req, res) => {
    try {
        const requestedPlayerId = req.params.playerId;
        const authenticatedPlayerId = req.player.id;
        
        // Only allow viewing own recommendations
        if (requestedPlayerId !== authenticatedPlayerId) {
            return res.status(403).json({ error: 'Not authorized to view these recommendations' });
        }

        const player = await db.Player.findByPk(requestedPlayerId);

        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }

        // Get player's games
        const userGames = await db.UserGame.findAll({
            where: { playerId: requestedPlayerId }
        });

        // Get list of games already in library
        const playedGameIds = userGames.map(game => game.gameId);

        // Get player's preferences
        const preferences = await getPlayerPreferences(requestedPlayerId, userGames);

        // Generate recommendations based on different strategies
        const recommendations = {
            // Games similar to highly rated ones
            similarToLiked: await getSimilarToLikedGames(preferences.favoriteGenres, preferences.favoritePlatforms, playedGameIds),
            
            // Games based on playtime length
            byPlaytime: await getGamesByPlaytime(preferences.averagePlaytime, playedGameIds),
            
            // Popular games in favorite genres
            popular: await getPopularInGenres(preferences.favoriteGenres, playedGameIds),
            
            // New releases in favorite genres
            newReleases: await getNewReleasesInGenres(preferences.favoriteGenres, playedGameIds)
        };

        res.json({
            preferences,
            recommendations
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Helper function to get player preferences
async function getPlayerPreferences(playerId, userGames) {
    // Get games with ratings
    const ratedGames = userGames.filter(game => game.rating);
    
    // Get completed games
    const completedGames = userGames.filter(game => game.status === 'completed');
    
    // Get all game IDs to fetch detailed info
    const gameIds = userGames.map(game => game.gameId);
    
    // Fetch game details to get genres and platforms
    const games = await db.Game.findAll({
        where: { id: { [Op.in]: gameIds } }
    });
    
    // Identify favorite genres
    const genreCounts = {};
    games.forEach(game => {
        game.genres.forEach(genre => {
            genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        });
    });
    
    // Sort genres by count
    const favoriteGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(entry => entry[0]);
    
    // Identify favorite platforms
    const platformCounts = {};
    games.forEach(game => {
        game.platforms.forEach(platform => {
            platformCounts[platform] = (platformCounts[platform] || 0) + 1;
        });
    });
    
    // Sort platforms by count
    const favoritePlatforms = Object.entries(platformCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(entry => entry[0]);
    
    // Calculate average playtime
    const totalPlaytime = userGames.reduce((sum, game) => sum + game.playtime, 0);
    const averagePlaytime = userGames.length ? totalPlaytime / userGames.length : 0;
    
    // Calculate favorite completion style based on comparison to HLTB times
    let completionStyle = 'balanced';
    let completionistCount = 0;
    let speedrunnerCount = 0;
    
    for (const game of completedGames) {
        const gameDetails = games.find(g => g.id === game.gameId);
        if (gameDetails && gameDetails.mainStoryTime) {
            if (game.playtime > (gameDetails.mainPlusExtrasTime * 1.2)) {
                completionistCount++;
            } else if (game.playtime < (gameDetails.mainStoryTime * 0.8)) {
                speedrunnerCount++;
            }
        }
    }
    
    if (completionistCount > completedGames.length / 3) {
        completionStyle = 'completionist';
    } else if (speedrunnerCount > completedGames.length / 3) {
        completionStyle = 'speedrunner';
    }
    
    return {
        favoriteGenres,
        favoritePlatforms,
        averagePlaytime: parseFloat(averagePlaytime.toFixed(2)),
        completionStyle,
        highestRatedGenres: favoriteGenres, // Simplified for now
        preferredGameLength: getPreferredLength(averagePlaytime)
    };
}

function getPreferredLength(averagePlaytime) {
    if (averagePlaytime < 5) return 'short';
    if (averagePlaytime < 15) return 'medium';
    return 'long';
}

// Helper function to get games similar to liked games
async function getSimilarToLikedGames(genres, platforms, excludeIds, limit = 5) {
    try {
        // Find games that match favorite genres and platforms but aren't in library
        const similarGames = await db.Game.findAll({
            where: {
                id: { [Op.notIn]: excludeIds },
                genres: { [Op.overlap]: genres }
            },
            limit
        });
        
        // If not enough games found, supplement with API call
        if (similarGames.length < limit) {
            const topGenre = genres[0] || '';
            const searchResults = await hltbService.search(topGenre);
            
            // Filter out games already in user library
            const filteredResults = searchResults
                .filter(game => !excludeIds.includes(game.id.toString()))
                .slice(0, limit - similarGames.length);
                
            // Transform API results to match our format
            const additionalGames = filteredResults.map(game => ({
                id: game.id.toString(),
                name: game.name,
                imageUrl: game.imageUrl,
                genres: [topGenre], // We don't have full genre info from search
                mainStoryTime: game.gameplayMain,
                mainPlusExtrasTime: game.gameplayMainExtra,
                completionistTime: game.gameplayCompletionist,
                source: 'api'
            }));
            
            return [...similarGames, ...additionalGames];
        }
        
        return similarGames;
    } catch (err) {
        console.error("Error getting similar games:", err);
        return [];
    }
}

// Helper function to get games based on preferred playtime
async function getGamesByPlaytime(averagePlaytime, excludeIds, limit = 5) {
    try {
        // Determine target playtime range
        const minPlaytime = Math.max(1, averagePlaytime * 0.7);
        const maxPlaytime = averagePlaytime * 1.3;
        
        // Find games with similar playtime
        const games = await db.Game.findAll({
            where: {
                id: { [Op.notIn]: excludeIds },
                [Op.or]: [
                    { mainStoryTime: { [Op.between]: [minPlaytime, maxPlaytime] } },
                    { mainPlusExtrasTime: { [Op.between]: [minPlaytime, maxPlaytime] } }
                ]
            },
            limit
        });
        
        return games;
    } catch (err) {
        console.error("Error getting games by playtime:", err);
        return [];
    }
}

// Helper function to get popular games in favorite genres
async function getPopularInGenres(genres, excludeIds, limit = 5) {
    try {
        // Use popular games from our database first
        const popularGames = await db.Game.findAll({
            where: {
                id: { [Op.notIn]: excludeIds },
                genres: { [Op.overlap]: genres }
            },
            include: [
                {
                    model: db.Review,
                    as: 'reviews',
                    attributes: []
                }
            ],
            attributes: {
                include: [
                    [db.sequelize.fn('COUNT', db.sequelize.col('reviews.id')), 'reviewCount'],
                    [db.sequelize.fn('AVG', db.sequelize.col('reviews.rating')), 'avgRating']
                ]
            },
            group: ['Game.id'],
            order: [
                [db.sequelize.literal('avgRating'), 'DESC'],
                [db.sequelize.literal('reviewCount'), 'DESC']
            ],
            limit
        });
        
        // Supplement with API call if needed
        if (popularGames.length < limit) {
            const topGenre = genres[0] || '';
            let searchResults = [];
            
            try {
                // Try to search for popular games in the genre
                searchResults = await hltbService.search(`${topGenre} popular`);
            } catch (err) {
                console.error("API search error:", err);
            }
            
            // Filter out games already in user library
            const filteredResults = searchResults
                .filter(game => !excludeIds.includes(game.id.toString()))
                .slice(0, limit - popularGames.length);
                
            // Transform API results to match our format
            const additionalGames = filteredResults.map(game => ({
                id: game.id.toString(),
                name: game.name,
                imageUrl: game.imageUrl,
                genres: [topGenre], // We don't have full genre info from search
                mainStoryTime: game.gameplayMain,
                mainPlusExtrasTime: game.gameplayMainExtra,
                completionistTime: game.gameplayCompletionist,
                source: 'api'
            }));
            
            return [...popularGames, ...additionalGames];
        }
        
        return popularGames;
    } catch (err) {
        console.error("Error getting popular games:", err);
        return [];
    }
}

// Helper function to get new releases in favorite genres
async function getNewReleasesInGenres(genres, excludeIds, limit = 5) {
    try {
        const currentYear = new Date().getFullYear();
        const lastYearStart = new Date(`${currentYear-1}-01-01`);
        
        // Find games released in the last year
        const newGames = await db.Game.findAll({
            where: {
                id: { [Op.notIn]: excludeIds },
                genres: { [Op.overlap]: genres },
                releaseDate: { [Op.gte]: lastYearStart }
            },
            order: [['releaseDate', 'DESC']],
            limit
        });
        
        // Supplement with API call if needed
        if (newGames.length < limit) {
            const topGenre = genres[0] || '';
            let searchResults = [];
            
            try {
                // Try to search for new games in the genre
                searchResults = await hltbService.search(`${topGenre} ${currentYear}`);
            } catch (err) {
                console.error("API search error:", err);
            }
            
            // Filter out games already in user library
            const filteredResults = searchResults
                .filter(game => !excludeIds.includes(game.id.toString()))
                .slice(0, limit - newGames.length);
                
            // Transform API results to match our format
            const additionalGames = filteredResults.map(game => ({
                id: game.id.toString(),
                name: game.name,
                imageUrl: game.imageUrl,
                genres: [topGenre], // We don't have full genre info from search
                mainStoryTime: game.gameplayMain,
                mainPlusExtrasTime: game.gameplayMainExtra,
                completionistTime: game.gameplayCompletionist,
                releaseDate: currentYear, // We don't have exact date from search
                source: 'api'
            }));
            
            return [...newGames, ...additionalGames];
        }
        
        return newGames;
    } catch (err) {
        console.error("Error getting new releases:", err);
        return [];
    }
}

module.exports = router;