const axios = require('axios');
const prisma = require('../config/db');
const { SHOPIFY_API_KEY, SHOPIFY_API_SECRET, APP_URL, REDIRECT_URI } = process.env;
const SCOPES = 'read_products,read_orders,read_customers';

const install = (req, res) => {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    const shop = req.query.shop;
    if (!shop) {
        return res.status(400).send('Missing shop parameter');
    }

    if (!shop.includes('.myshopify.com')) {
        return res.status(400).send('Invalid shop domain. Must be in format: storename.myshopify.com');
    }

    const state = req.user.id;
    const redirectUri = REDIRECT_URI || `${APP_URL}/api/shopify/callback`;
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SCOPES}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    res.redirect(installUrl);
};

const callback = async (req, res) => {
    const { shop, code, state, error } = req.query;
    
    if (error) {
        return res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=${encodeURIComponent(error)}`);
    }
    
    if (!shop || !code || !state) {
        return res.status(400).send('Missing shop, code, or state');
    }

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

        try {
            await syncShopifyData(state, shop, access_token);
            res.redirect(`${process.env.FRONTEND_URL}/dashboard?connected=true&synced=true`);
        } catch (syncError) {
            console.error(syncError);
            res.redirect(`${process.env.FRONTEND_URL}/dashboard?connected=true&syncError=true`);
        }
    } catch (error) {
        res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=auth_failed`);
    }
};

async function syncShopifyData(tenantId, shopDomain, accessToken) {
    const headers = {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
    };
    const baseUrl = `https://${shopDomain}/admin/api/2025-01`;

    const prodRes = await axios.get(`${baseUrl}/products.json`, { headers });
    for (const p of prodRes.data.products) {
        await prisma.product.upsert({
            where: { shopifyProductId: p.id.toString() },
            update: { title: p.title },
            create: {
                shopifyProductId: p.id.toString(),
                title: p.title,
                tenantId: tenantId
            }
        });
    }

    const ordRes = await axios.get(`${baseUrl}/orders.json?status=any`, { headers });
    for (const o of ordRes.data.orders) {
        await prisma.order.upsert({
            where: { shopifyOrderId: o.id.toString() },
            update: { totalPrice: parseFloat(o.total_price) },
            create: {
                shopifyOrderId: o.id.toString(),
                totalPrice: parseFloat(o.total_price),
                currency: o.currency,
                createdAt: new Date(o.created_at),
                tenantId: tenantId
            }
        });
    }

    // UPDATED: Sync orders_count
    const custRes = await axios.get(`${baseUrl}/customers.json`, { headers });
    for (const c of custRes.data.customers) {
        await prisma.customer.upsert({
            where: { shopifyCustomerId: c.id.toString() },
            update: { 
                totalSpent: parseFloat(c.total_spent || 0),
                ordersCount: c.orders_count || 0
            },
            create: {
                shopifyCustomerId: c.id.toString(),
                email: c.email,
                totalSpent: parseFloat(c.total_spent || 0),
                ordersCount: c.orders_count || 0,
                tenantId: tenantId
            }
        });
    }
}

module.exports = { install, callback };