module.exports = (sequelize, DataTypes) => {
    const Player = sequelize.define('Player', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true
        }
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false
      },
      playtime: {
        type: DataTypes.FLOAT, // in seconds
        defaultValue: 0
      },
      levelsCompleted: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      }
    });
  
    Player.associate = function(models) {
      Player.hasMany(models.UserGame, {
        foreignKey: 'playerId',
        as: 'games'
      });
      Player.hasMany(models.Review, {
        foreignKey: 'playerId',
        as: 'reviews'
      });
    };
  
    return Player;
  };