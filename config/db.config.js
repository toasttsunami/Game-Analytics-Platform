module.exports = {
    // host: String(process.env.DB_HOST) || '127.0.0.1',
    host: '127.0.0.1',
    username: 'postgres',
    // password: process.env.DB_PASSWORD,
    password: 'conturna',
    // database: process.env.DB_NAME,
    database: 'game_platform',
    dialect: 'postgres',
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
};