module.exports = (sequelize, DataTypes) => {
    const UserGame = sequelize.define('UserGame', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      playerId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Players',
          key: 'id'
        }
      },
      gameId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      gameName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      gameImage: {
        type: DataTypes.STRING,
        allowNull: true
      },
      playtime: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
        comment: 'User\'s actual playtime in hours'
      },
      status: {
        type: DataTypes.ENUM('not_played', 'playing', 'completed', 'backlog'),
        defaultValue: 'not_played'
      },
      completedDate: {
        type: DataTypes.DATE,
        allowNull: true
      },
      rating: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 10
        }
      }
    });
  
    UserGame.associate = function(models) {
      UserGame.belongsTo(models.Player, {
        foreignKey: 'playerId',
        as: 'player'
      });
    };
  
    return UserGame;
  };