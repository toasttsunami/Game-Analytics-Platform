module.exports = {
    host: process.env.DB_HOST || '127.0.0.1',
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'conturna',
    database: process.env.DB_NAME || 'game_platform',
    dialect: 'postgres',
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
};