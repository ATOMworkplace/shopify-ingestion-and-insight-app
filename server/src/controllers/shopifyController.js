const axios = require('axios');
const prisma = require('../config/db');
const { SHOPIFY_API_KEY, SHOPIFY_API_SECRET, APP_URL, REDIRECT_URI, FRONTEND_URL } = process.env;
const SCOPES = 'read_products,read_orders,read_customers';

async function registerWebhooks(shop, accessToken) {
    const webhookUrl = `${APP_URL}/api/webhooks/orders/create`;
    const headers = {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
    };

    try {
        await axios.post(`https://${shop}/admin/api/2025-01/webhooks.json`, {
            webhook: {
                topic: 'orders/create',
                address: webhookUrl,
                format: 'json'
            }
        }, { headers });
    } catch (error) {
        if (!error.response?.data?.errors?.address?.includes('taken')) {
            console.error(error);
        }
    }
}

const install = (req, res) => {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    const shop = req.query.shop;
    const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

    if (!shop || !shopRegex.test(shop)) {
        return res.status(400).send('Invalid shop parameter. Must be a valid .myshopify.com domain.');
    }

    const state = req.user.id;
    const redirectUri = REDIRECT_URI || `${APP_URL}/api/shopify/callback`;
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SCOPES}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    res.redirect(installUrl);
};

const callback = async (req, res) => {
    const { shop, code, state, error } = req.query;
    
    if (error) return res.redirect(`${FRONTEND_URL}/dashboard?error=${encodeURIComponent(error)}`);
    if (!shop || !code || !state) return res.status(400).send('Missing parameters');

    try {
        const tokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
            client_id: SHOPIFY_API_KEY,
            client_secret: SHOPIFY_API_SECRET,
            code
        });
        
        const { access_token } = tokenResponse.data;

        await prisma.tenant.update({
            where: { id: state },
            data: { 
                shopDomain: shop, 
                accessToken: access_token,
                installedAt: new Date()
            }
        });

        await registerWebhooks(shop, access_token);

        res.redirect(`${FRONTEND_URL}/dashboard?connected=true&synced=true`);
    } catch (error) {
        console.error(error);
        res.redirect(`${FRONTEND_URL}/dashboard?error=auth_failed`);
    }
};

const disconnect = async (req, res) => {
    const tenantId = req.user.id;
    try {
        await prisma.tenant.update({
            where: { id: tenantId },
            data: { 
                shopDomain: null, 
                accessToken: null,
                installedAt: null
            }
        });
        res.json({ success: true, message: 'Store disconnected' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to disconnect' });
    }
};

module.exports = { install, callback, disconnect };