const express = require('express');
const Sentiment = require('sentiment');
const db = require('../models');
const router = express.Router();
const sentiment = new Sentiment();
const auth = require('../middleware/auth');

// Analyze and submit a review
router.post('/analyze-review', auth, async (req, res) => {
    try {
        const { gameId, review, rating } = req.body;
        const playerId = req.player.id;

        // Check if game exists
        const game = await db.Game.findByPk(gameId);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        // Check if user has the game in their library
        const userGame = await db.UserGame.findOne({
            where: { playerId, gameId }
        });

        if (!userGame) {
            return res.status(400).json({ error: 'You must have the game in your library to review it' });
        }

        // Analyze sentiment
        const sentimentResult = sentiment.analyze(review);
        const score = sentimentResult.score;

        // Create new review
        const newReview = await db.Review.create({
            gameId,
            playerId,
            review,
            sentimentScore: score,
            rating: rating || null
        });

        // If rating is provided, update in UserGame as well
        if (rating) {
            userGame.rating = rating;
            await userGame.save();
        }

        res.json({
            review: newReview,
            sentiment: {
                score,
                comparative: sentimentResult.comparative,
                tokens: sentimentResult.tokens,
                words: sentimentResult.words,
                positive: sentimentResult.positive,
                negative: sentimentResult.negative
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Get reviews for a game
router.get('/game/:gameId', async (req, res) => {
    try {
        const reviews = await db.Review.findAll({
            where: { gameId: req.params.gameId },
            include: [
                {
                    model: db.Player,
                    as: 'player',
                    attributes: ['username']
                }
            ],
            order: [['createdAt', 'DESC']]
        });
        
        // Calculate average ratings and sentiment
        const totalRatings = reviews.filter(review => review.rating !== null).length;
        const averageRating = totalRatings > 0 
            ? reviews.reduce((sum, review) => sum + (review.rating || 0), 0) / totalRatings 
            : null;

        const averageSentiment = reviews.length > 0
            ? reviews.reduce((sum, review) => sum + review.sentimentScore, 0) / reviews.length
            : 0;

        res.json({
            reviews,
            meta: {
                count: reviews.length,
                averageRating: averageRating ? parseFloat(averageRating.toFixed(1)) : null,
                averageSentiment: parseFloat(averageSentiment.toFixed(1))
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Get reviews by a player
router.get('/player/:playerId', auth, async (req, res) => {
    try {
        const requestedPlayerId = req.params.playerId;
        const authenticatedPlayerId = req.player.id;

        // Only allow viewing of own reviews or public profiles
        if (requestedPlayerId !== authenticatedPlayerId) {
            return res.status(403).json({ error: 'Not authorized to view these reviews' });
        }

        const reviews = await db.Review.findAll({
            where: { playerId: requestedPlayerId },
            include: [
                {
                    model: db.Game,
                    as: 'game',
                    attributes: ['name', 'imageUrl']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json(reviews);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Delete a review
router.delete('/:reviewId', auth, async (req, res) => {
    try {
        const review = await db.Review.findByPk(req.params.reviewId);
        
        if (!review) {
            return res.status(404).json({ error: 'Review not found' });
        }
        
        // Ensure user can only delete their own reviews
        if (review.playerId !== req.player.id) {
            return res.status(403).json({ error: 'Not authorized to delete this review' });
        }
        
        await review.destroy();
        
        res.json({ msg: 'Review deleted' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;