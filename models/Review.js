module.exports = (sequelize, DataTypes) => {
    const Review = sequelize.define('Review', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      gameId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
          model: 'Games',
          key: 'id'
        }
      },
      playerId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Players',
          key: 'id'
        }
      },
      review: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      sentimentScore: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      rating: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 10
        }
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    });
  
    Review.associate = function(models) {
      Review.belongsTo(models.Player, {
        foreignKey: 'playerId',
        as: 'player'
      });
      Review.belongsTo(models.Game, {
        foreignKey: 'gameId',
        as: 'game'
      });
    };
  
    return Review;
  };