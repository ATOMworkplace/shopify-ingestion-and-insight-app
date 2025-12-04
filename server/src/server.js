require('dotenv').config();
const express = require('express');
const cors = require('cors');

const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const dataRoutes = require('./routes/dataRoutes');
const webhookRoutes = require('./routes/webhookRoutes'); 

const app = express();

app.use(cors());

app.use('/api/webhooks', webhookRoutes);

app.use(express.json());

app.use((req, res, next) => {
    next();
});

app.use('/api/user', userRoutes);
app.use('/api/shopify', authRoutes);
app.use('/api/data', dataRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});