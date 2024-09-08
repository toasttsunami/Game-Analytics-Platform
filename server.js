const express = require('express');
const bodyParser = require('body-parser');
const db = require('./models');
const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Routes
app.use('/analytics', require('./routes/analytics'));
app.use('/recommendations', require('./routes/recommendations'));
app.use('/reviews', require('./routes/reviews'));

// Sync Sequelize models and start server
db.sequelize.sync().then(() => {
    app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
    });
});
