import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/index.js';
import { seedDatabase } from './utils/seedDb.js';

const app = express();
const PORT = process.env.PORT || 10000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadPath = path.resolve(__dirname, '../uploads');
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be set to a random string of at least 32 characters.');
  process.exit(1);
}
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean).length ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : true }));
app.use(morgan('combined'));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
// Verify webhook signature against the raw payload before the normal JSON parser.
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || !signature) return res.status(400).send('Webhook not configured');
    const expected = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
    const a = Buffer.from(expected), b = Buffer.from(String(signature));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(400).send('Invalid signature');
    const event = JSON.parse(req.body.toString('utf8'));
    const payment = event.payload?.payment?.entity;
    const rzpOrderId = payment?.order_id || event.payload?.order?.entity?.id;
    if (rzpOrderId && ['payment.captured', 'order.paid'].includes(event.event)) {
      const { Order } = await import('./models/index.js');
      const order = await Order.findOne({ razorpayOrderId: rzpOrderId });
      if (order) {
        if (payment?.id) order.razorpayPaymentId = payment.id;
        order.paymentStatus = 'Completed';
        order.orderStatus = 'confirmed';
        order.paidAt = new Date();
        if (!order.stockAdjusted) {
          const { Product } = await import('./models/index.js');
          for (const item of order.items) await Product.updateOne({ _id: item.productId, 'variants.sku': item.sku, 'variants.stock': { $gte: item.quantity } }, { $inc: { 'variants.$.stock': -item.quantity } });
          order.stockAdjusted = true;
        }
        await order.save();
      }
    }
    res.json({ received: true });
  } catch { res.status(400).send('Webhook processing failed'); }
});
app.use(express.json({ limit: '2mb' }));
app.use('/api', apiRoutes);
app.use('/uploads', express.static(uploadPath));
app.get('/', (_req, res) => res.json({ service: 'AgrivaFoods API', status: 'running', health: '/api/health' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || (err.name === 'ValidationError' ? 400 : 500);
  res.status(status).json({ message: status === 500 ? 'Server error. Please try again later.' : err.message, ...(process.env.NODE_ENV !== 'production' ? { detail: err.message } : {}) });
});

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connected.');
    await seedDatabase();
    app.listen(PORT, () => console.log(`AgrivaFoods server running on port ${PORT}`));
  })
  .catch(err => { console.error('MongoDB connection failed:', err.message); process.exit(1); });
