const { Sequelize } = require('sequelize');

// Initialize Sequelize with PostgreSQL
const sequelize = new Sequelize('game_platform', 'username', 'password', {
    host: 'localhost',
    dialect: 'postgres'
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import models
db.Player = require('./Player')(sequelize, Sequelize);
db.Review = require('./Review')(sequelize, Sequelize);

module.exports = db;
