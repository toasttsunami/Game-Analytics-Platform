module.exports = (sequelize, DataTypes) => {
  const Review = sequelize.define('Review', {
      gameId: {
          type: DataTypes.STRING,
          allowNull: false
      },
      playerId: {
          type: DataTypes.STRING,
          allowNull: false
      },
      review: {
          type: DataTypes.TEXT,
          allowNull: false
      },
      sentimentScore: {
          type: DataTypes.INTEGER,  // Positive, Negative, or Neutral sentiment score
          allowNull: false
      }
  });

  return Review;
};
