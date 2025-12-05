const express = require('express');
const axios = require('axios');
const prisma = require('../config/db');
const { authenticateToken } = require('../utils/auth');
const router = express.Router();

const getShopifyHeaders = (accessToken) => ({
    'X-Shopify-Access-Token': accessToken,
    'Content-Type': 'application/json'
});

router.post('/sync', authenticateToken, async (req, res) => {
    const tenantId = req.user.id;
    
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    
    if (!tenant || !tenant.accessToken) {
        return res.status(401).json({ error: 'Shopify store not connected' });
    }
    
    try {
        const headers = getShopifyHeaders(tenant.accessToken);
        const baseUrl = `https://${tenant.shopDomain}/admin/api/2025-01`;
        
        const prodRes = await axios.get(`${baseUrl}/products.json`, { headers });
        for (const p of prodRes.data.products) {
            await prisma.product.upsert({
                where: { shopifyProductId: p.id.toString() },
                update: { title: p.title },
                create: {
                    shopifyProductId: p.id.toString(),
                    title: p.title,
                    tenantId: tenant.id
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
                    tenantId: tenant.id
                }
            });
        }

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
                    tenantId: tenant.id
                }
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Sync complete',
            counts: {
                products: prodRes.data.products.length,
                customers: custRes.data.customers.length,
                orders: ordRes.data.orders.length
            }
        });
    } catch (err) {
        console.error('[ERROR] Sync failed:', err);
        if (err.response?.status === 401) {
            return res.status(401).json({ 
                error: 'Shopify authentication failed. Please reconnect your store.',
                details: err.message 
            });
        }
        res.status(500).json({ error: 'Sync failed', details: err.message });
    }
});

router.get('/stats', authenticateToken, async (req, res) => {
    const tenantId = req.user.id;
    const { startDate, endDate } = req.query;
    
    try {
        const tenant = await prisma.tenant.findUnique({ 
            where: { id: tenantId },
            select: { shopDomain: true, accessToken: true }
        });

        const dateFilter = {};
        if (startDate && endDate) {
            dateFilter.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        const orderWhere = { tenantId, ...dateFilter };

        const prodCount = await prisma.product.count({ where: { tenantId } });
        const custCount = await prisma.customer.count({ where: { tenantId } });
        const ordCount = await prisma.order.count({ where: orderWhere });

        const salesData = await prisma.order.aggregate({ 
            where: orderWhere, 
            _sum: { totalPrice: true } 
        });

        const totalSales = salesData._sum.totalPrice || 0;

        const avgOrderValue = ordCount > 0 ? (totalSales / ordCount) : 0;
        const revPerCustomer = custCount > 0 ? (totalSales / custCount) : 0;

        // Fetch full order history for the table (limited to 50 for performance)
        const allOrders = await prisma.order.findMany({
            where: orderWhere,
            orderBy: { createdAt: 'desc' },
            take: 50, 
            select: { 
                shopifyOrderId: true, 
                createdAt: true, 
                totalPrice: true, 
                currency: true 
            }
        });

        const dailyStats = allOrders.reduce((acc, order) => {
            const date = order.createdAt.toISOString().split('T')[0];
            if (!acc[date]) {
                acc[date] = { sales: 0, orders: 0 };
            }
            acc[date].sales += order.totalPrice;
            acc[date].orders += 1;
            return acc;
        }, {});

        const chartData = Object.keys(dailyStats).sort().map(date => ({
            date,
            sales: dailyStats[date].sales,
            orders: dailyStats[date].orders
        }));

        const topCustomers = await prisma.customer.findMany({
            where: { tenantId },
            orderBy: { totalSpent: 'desc' },
            take: 5
        });

        res.json({
            stats: {
                totalSales,
                orderCount: ordCount,
                productCount: prodCount,
                customerCount: custCount,
                avgOrderValue,
                revPerCustomer
            },
            orders: allOrders, // Sending raw orders to frontend
            chartData,
            topCustomers,
            isConnected: !!tenant?.accessToken,
            shopDomain: tenant?.shopDomain
        });
    } catch (error) {
        console.error('[ERROR] Stats endpoint failed:', error);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

module.exports = router;