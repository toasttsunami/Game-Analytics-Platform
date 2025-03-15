const { Sequelize } = require('sequelize');
const config = require('../config/db.config.js');

// Initialize Sequelize with PostgreSQL
const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    dialect: config.dialect,
    operatorsAliases: 0,
    pool: {
      max: config.pool.max,
      min: config.pool.min,
      acquire: config.pool.acquire,
      idle: config.pool.idle
    }
  }
);

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import models
db.Player = require('./Player')(sequelize, Sequelize);
db.Game = require('./Game')(sequelize, Sequelize);
db.UserGame = require('./UserGame')(sequelize, Sequelize);
db.Review = require('./Review')(sequelize, Sequelize);

// Initialize associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

module.exports = db;