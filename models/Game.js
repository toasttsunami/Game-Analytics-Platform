module.exports = (sequelize, DataTypes) => {
    const Game = sequelize.define('Game', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      imageUrl: {
        type: DataTypes.STRING,
        allowNull: true
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      genres: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
      },
      platforms: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
      },
      developer: {
        type: DataTypes.STRING,
        allowNull: true
      },
      publisher: {
        type: DataTypes.STRING,
        allowNull: true
      },
      releaseDate: {
        type: DataTypes.DATE,
        allowNull: true
      },
      mainStoryTime: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: 'Average time to complete main story in hours'
      },
      mainPlusExtrasTime: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: 'Average time to complete main story + extras in hours'
      },
      completionistTime: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: 'Average time to complete 100% in hours'
      }
    });
  
    Game.associate = function(models) {
      Game.hasMany(models.Review, {
        foreignKey: 'gameId',
        as: 'reviews'
      });
    };
  
    return Game;
  };