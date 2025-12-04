const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_change_me';

const authenticateToken = (req, res, next) => {
    //console.log('[DEBUG] authenticateToken called');
    //console.log('[DEBUG] Headers:', req.headers);
    //console.log('[DEBUG] Query Params:', req.query);

    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

    //console.log('[DEBUG] Extracted Token:', token);

    if (!token) {
        //console.log('[DEBUG] No token found -> 401');
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            //console.log('[DEBUG] Token verification failed:', err.message);
            return res.status(403).json({ error: 'Invalid token' });
        }
        //console.log('[DEBUG] Token verified. User:', user);
        req.user = user;
        next();
    });
};

module.exports = { authenticateToken, JWT_SECRET };