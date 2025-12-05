const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { JWT_SECRET } = require('../utils/auth');

const register = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const tenant = await prisma.tenant.create({
            data: { email, password: hashedPassword }
        });
        res.json({ message: 'User registered successfully', userId: tenant.id });
    } catch (error) {
        console.error('[DEBUG] Register error:', error);
        if (error.code === 'P2002') return res.status(400).json({ error: 'Email already exists' });
        res.status(500).json({ error: 'Registration failed', details: error.message });
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const tenant = await prisma.tenant.findUnique({ where: { email } });
        if (!tenant) return res.status(400).json({ error: 'Invalid credentials' });
        
        const validPassword = await bcrypt.compare(password, tenant.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });
        
        const token = jwt.sign(
            { id: tenant.id, email: tenant.email }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );
        res.json({ 
            token, 
            user: { id: tenant.id, email: tenant.email, shopDomain: tenant.shopDomain } 
        });
    } catch (error) {
        console.error('[DEBUG] Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
};

module.exports = { register, login };