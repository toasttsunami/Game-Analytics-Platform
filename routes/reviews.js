const express = require('express');
const Sentiment = require('sentiment');
const db = require('../models');
const router = express.Router();
const sentiment = new Sentiment();

router.post('/analyze-review', async (req, res) => {
    const { gameId, playerId, review } = req.body;

    const sentimentResult = sentiment.analyze(review);
    const score = sentimentResult.score;

    const newReview = await db.Review.create({
        gameId,
        playerId,
        review,
        sentimentScore: score
    });

    res.json({ sentiment: score });
});

router.get('/:gameId', async (req, res) => {
    const reviews = await db.Review.findAll({ where: { gameId: req.params.gameId } });
    res.json(reviews);
});

module.exports = router;
