module.exports = (sequelize, DataTypes) => {
  const Player = sequelize.define('Player', {
      name: {
          type: DataTypes.STRING,
          allowNull: false,
      },
      playtime: {
          type: DataTypes.FLOAT, // in seconds
          defaultValue: 0
      },
      levelsCompleted: {
          type: DataTypes.INTEGER,
          defaultValue: 0
      },
      gameHistory: {
          type: DataTypes.ARRAY(DataTypes.STRING), // Array of game IDs
          defaultValue: []
      }
  });

  return Player;
};
