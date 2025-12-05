const express = require('express');
const crypto = require('crypto');
const getRawBody = require('raw-body'); 
const prisma = require('../config/db'); 
const Pusher = require('pusher');

const router = express.Router();

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

const rawBodyMiddleware = async (req, res, next) => {
  try {
    req.rawBody = await getRawBody(req);
    next();
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
};

router.post('/orders/create', rawBodyMiddleware, async (req, res) => {
  try {
    const hmac = req.get('X-Shopify-Hmac-Sha256');
    const secret = process.env.SHOPIFY_API_SECRET; 

    const hash = crypto
      .createHmac('sha256', secret)
      .update(req.rawBody)
      .digest('base64');

    if (hash !== hmac) {
      return res.status(401).send('Invalid Signature');
    }

    const orderData = JSON.parse(req.rawBody.toString());
    const shopDomain = req.get('X-Shopify-Shop-Domain');

    const tenant = await prisma.tenant.findUnique({ where: { shopDomain } });
    if (!tenant) return res.status(404).send('Tenant not found');

    await prisma.order.upsert({
      where: { shopifyOrderId: String(orderData.id) },
      update: {
        totalPrice: parseFloat(orderData.total_price),
        currency: orderData.currency,
      },
      create: {
        shopifyOrderId: String(orderData.id),
        totalPrice: parseFloat(orderData.total_price),
        currency: orderData.currency,
        createdAt: new Date(orderData.created_at),
        tenantId: tenant.id,
      }
    });

    if (orderData.customer) {
        await prisma.customer.upsert({
            where: { shopifyCustomerId: String(orderData.customer.id) },
            update: {
                totalSpent: { increment: parseFloat(orderData.total_price) },
                ordersCount: { increment: 1 },
                email: orderData.customer.email
            },
            create: {
                shopifyCustomerId: String(orderData.customer.id),
                email: orderData.customer.email,
                totalSpent: parseFloat(orderData.total_price),
                ordersCount: 1,
                tenantId: tenant.id
            }
        });
    }

    await pusher.trigger('shop-updates', 'order-synced', {
      message: 'New order received',
      orderId: orderData.id
    });

    res.status(200).send('Webhook processed');

  } catch (error) {
    console.error(error);
    res.status(200).send('Error processed'); 
  }
});

module.exports = router;