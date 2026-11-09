import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Razorpay from 'razorpay';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { Product, Order, Admin, Category, StoreSetting } from '../models/index.js';
import { requireAdmin } from '../middleware/auth.js';
import { getShippingQuote, checkPincode, buildParcel } from '../services/ithinkService.js';

const router = express.Router();
const uploadDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const uploader = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 12 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|svg\+xml)$/.test(file.mimetype))
});
const razorpayReady = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
const razorpay = () => new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
const orderNo = () => `AGR-${Date.now().toString().slice(-8)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

async function priceCart(items = []) {
  if (!Array.isArray(items) || !items.length) throw new Error('Your cart is empty.');
  const priced = [];
  for (const item of items) {
    const product = await Product.findOne({ 'variants.sku': item.sku, isActive: true });
    if (!product) throw new Error(`Product not available: ${item.name || item.sku}`);
    const variant = product.variants.find(v => v.sku === item.sku);
    const qty = Math.max(1, Math.min(99, Number(item.quantity || 1)));
    if (!variant || variant.stock < qty) throw new Error(`${product.name} (${variant?.weight || ''}) is out of stock or has insufficient stock.`);
    priced.push({
      productId: String(product._id), sku: variant.sku, name: product.name, weight: variant.weight,
      quantity: qty, price: Number(variant.price), image: product.images?.[0] || ''
    });
  }
  return priced;
}

async function decrementStock(order) {
  if (order.stockAdjusted) return;
  for (const item of order.items) {
    await Product.updateOne({ _id: item.productId, 'variants.sku': item.sku, 'variants.stock': { $gte: item.quantity } }, { $inc: { 'variants.$.stock': -item.quantity } });
  }
  order.stockAdjusted = true;
}
function subtotalFor(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// Public storefront APIs
router.get('/health', (_req, res) => res.json({ success: true, data: { uptime: process.uptime(), database: 'connected' }, service: 'AgrivaFoods API' }));
router.get('/products', async (_req, res, next) => {
  try { const products = await Product.find({ isActive: true, status: 'published' }).sort({ legacyId: 1 }); res.json({ success: true, data: products }); }
  catch (e) { next(e); }
});
router.get('/products/slug/:slug', async (req, res, next) => {
  try { const p = await Product.findOne({ slug: req.params.slug, isActive: true }); if (!p) return res.status(404).json({ message: 'Product not found' }); res.json({ success: true, data: p }); }
  catch (e) { next(e); }
});
router.get('/products/:id', async (req, res, next) => {
  try { const p = await Product.findById(req.params.id); if (!p) return res.status(404).json({ message: 'Product not found' }); res.json({ success: true, data: p }); }
  catch (e) { next(e); }
});
// iThink Logistics: quotes are always calculated on the server; never accept a client shipping price.
router.post('/logistics/quote', async (req, res, next) => {
  try {
    const pinCode = String(req.body.pinCode || '').trim();
    if (!/^\d{6}$/.test(pinCode)) return res.status(400).json({ message: 'Enter a valid 6-digit delivery PIN code.' });
    const items = await priceCart(req.body.items);
    const subtotal = subtotalFor(items);
    const paymentMethod = String(req.body.paymentMethod || 'Prepaid').toLowerCase() === 'cod' ? 'COD' : 'Prepaid';
    const parcel = buildParcel(items);
    const serviceability = await checkPincode(pinCode);
    if (!serviceability.serviceable) return res.status(422).json({ message: 'Delivery is not available for this PIN code.' });
    const quote = await getShippingQuote({ pinCode, parcel, paymentMethod, productMrp: subtotal });
    res.json({ success: true, data: { shippingFee: quote.shippingFee, courier: quote.courier, estimatedDays: quote.estimatedDays, parcel } });
  } catch (e) { next(e); }
});

router.get('/payment/config', (_req, res) => res.json({ success: true, data: { onlinePaymentEnabled: razorpayReady(), keyId: process.env.RAZORPAY_KEY_ID || '' } }));

router.post('/payment/create-order', async (req, res, next) => {
  try {
    if (!razorpayReady()) return res.status(503).json({ message: 'Online payments are not configured. Add Razorpay keys in Hostinger environment variables.' });
    const items = await priceCart(req.body.items);
    const subtotal = subtotalFor(items);
    const pinCode = String((req.body.shippingAddress || {}).pinCode || '').trim();
    if (!/^\d{6}$/.test(pinCode)) return res.status(400).json({ message: 'Please enter a valid 6-digit delivery PIN code.' });
    const paymentMethod = 'Prepaid';
    const parcel = buildParcel(items);
    const serviceability = await checkPincode(pinCode);
    if (!serviceability.serviceable) return res.status(422).json({ message: 'Delivery is not available for this PIN code.' });
    const shipping = await getShippingQuote({ pinCode, parcel, paymentMethod, productMrp: subtotal });
    const shippingFee = shipping.shippingFee;
    const total = subtotal + shippingFee;
    const customer = req.body.customer || {};
    const shippingAddress = req.body.shippingAddress || {};
    if (!customer.fullName || !customer.email || !customer.phone || !shippingAddress.address || !shippingAddress.city || !shippingAddress.state || !shippingAddress.pinCode) {
      return res.status(400).json({ message: 'Please provide complete customer and delivery details.' });
    }
    const order = await Order.create({
      orderNumber: orderNo(), customer, shippingAddress, items, subtotal, shippingFee, total,
      paymentMethod: 'Razorpay', paymentStatus: 'Pending', orderStatus: 'awaiting_payment'
    });
    const rzpOrder = await razorpay().orders.create({
      amount: Math.round(total * 100), currency: 'INR', receipt: order.orderNumber,
      notes: { agrivaOrderId: String(order._id), orderNumber: order.orderNumber }
    });
    order.razorpayOrderId = rzpOrder.id;
    await order.save();
    res.json({ success: true, data: { order, razorpayOrder: rzpOrder, keyId: process.env.RAZORPAY_KEY_ID } });
  } catch (e) { next(e); }
});

router.post('/payment/verify', async (req, res, next) => {
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const order = await Order.findById(orderId);
    if (!order || order.razorpayOrderId !== razorpay_order_id) return res.status(404).json({ message: 'Order/payment reference not found.' });
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    const a = Buffer.from(expected); const b = Buffer.from(String(razorpay_signature || ''));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(400).json({ message: 'Payment verification failed. Order remains unpaid.' });
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;
    order.paymentStatus = 'Completed';
    order.orderStatus = 'confirmed';
    order.paidAt = new Date();
    await decrementStock(order);
    await order.save();
    res.json({ success: true, data: { order } });
  } catch (e) { next(e); }
});

router.post('/orders', async (req, res, next) => {
  try {
    const items = await priceCart(req.body.items);
    const subtotal = subtotalFor(items);
    const pinCode = String((req.body.shippingAddress || {}).pinCode || '').trim();
    if (!/^\d{6}$/.test(pinCode)) return res.status(400).json({ message: 'Please enter a valid 6-digit delivery PIN code.' });
    const parcel = buildParcel(items);
    const serviceability = await checkPincode(pinCode);
    if (!serviceability.serviceable) return res.status(422).json({ message: 'Delivery is not available for this PIN code.' });
    const shipping = await getShippingQuote({ pinCode, parcel, paymentMethod: 'COD', productMrp: subtotal });
    const shippingFee = shipping.shippingFee;
    const total = subtotal + shippingFee;
    const customer = req.body.customer || {};
    const shippingAddress = req.body.shippingAddress || {};
    if (!customer.fullName || !customer.email || !customer.phone || !shippingAddress.address || !shippingAddress.city || !shippingAddress.state || !shippingAddress.pinCode) {
      return res.status(400).json({ message: 'Please provide complete customer and delivery details.' });
    }
    const order = await Order.create({
      orderNumber: orderNo(), customer, shippingAddress, items, subtotal, shippingFee, total,
      paymentMethod: 'COD', paymentStatus: 'Pending', orderStatus: 'placed'
    });
    await decrementStock(order);
    await order.save();
    res.status(201).json({ success: true, data: { order } });
  } catch (e) { next(e); }
});
router.get('/orders/track/:orderNumber', async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber }).select('orderNumber orderStatus paymentStatus trackingNumber createdAt');
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    res.json({ success: true, data: order });
  } catch (e) { next(e); }
});

// Admin authentication
router.post('/admin/auth/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const admin = await Admin.findOne({ email });
    if (!admin || !(await bcrypt.compare(String(req.body.password || ''), admin.passwordHash))) return res.status(401).json({ message: 'Invalid email or password.' });
    const token = jwt.sign({ sub: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
    res.json({ success: true, data: { token, user: { _id: admin._id, name: admin.name, email: admin.email, role: admin.role } } });
  } catch (e) { next(e); }
});
router.get('/admin/auth/me', requireAdmin, (req, res) => res.json({ success: true, data: { user: req.admin } }));
router.post('/admin/auth/logout', requireAdmin, (_req, res) => res.json({ success: true }));

// Admin dashboard, orders and customer CRM
router.get('/admin/dashboard', requireAdmin, async (_req, res, next) => {
  try {
    const [totalOrders, paidOrders, pendingOrders, revenue, totalProducts, lowStock, recentOrders, recentProducts] = await Promise.all([
      Order.countDocuments(), Order.countDocuments({ paymentStatus: 'Completed' }), Order.countDocuments({ paymentStatus: 'Pending' }),
      Order.aggregate([{ $match: { paymentStatus: 'Completed' } }, { $group: { _id: null, value: { $sum: '$total' } } }]),
      Product.countDocuments({ isActive: true }), Product.aggregate([{ $unwind: '$variants' }, { $match: { 'variants.stock': { $lte: 10 } } }, { $count: 'count' }]),
      Order.find().sort({ createdAt: -1 }).limit(8), Product.find().sort({ createdAt: -1 }).limit(6)
    ]);
    res.json({ success: true, data: { overview: { totalOrders, paidOrders, pendingOrders, totalRevenue: revenue[0]?.value || 0, totalProducts, activeProducts: totalProducts, outOfStockProducts: 0, lowStockProducts: lowStock[0]?.count || 0, totalReviews: 0, avgRating: '5.0' }, recentOrders, recentProducts } });
  } catch (e) { next(e); }
});
router.get('/admin/orders', requireAdmin, async (req, res, next) => {
  try { const filter = {}; if (req.query.status && req.query.status !== 'All') filter.orderStatus = req.query.status; const orders = await Order.find(filter).sort({ createdAt: -1 }); res.json({ success: true, data: orders }); }
  catch (e) { next(e); }
});
router.put('/admin/orders/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const update = {};
    if (req.body.orderStatus) update.orderStatus = req.body.orderStatus;
    if (req.body.trackingNumber !== undefined) update.trackingNumber = req.body.trackingNumber;
    // Online Razorpay payments cannot be manually marked paid unless a verified payment ID exists.
    if (req.body.paymentStatus === 'Completed') {
      const current = await Order.findById(req.params.id);
      if (!current) return res.status(404).json({ message: 'Order not found.' });
      if (current.paymentMethod === 'Razorpay' && !current.razorpayPaymentId) return res.status(400).json({ message: 'Razorpay payment must be verified before marking it paid.' });
      update.paymentStatus = 'Completed';
      if (current.paymentMethod === 'COD') update.paidAt = new Date();
    } else if (req.body.paymentStatus) update.paymentStatus = req.body.paymentStatus;
    const order = await Order.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    res.json({ success: true, data: order });
  } catch (e) { next(e); }
});
router.get('/admin/customers', requireAdmin, async (_req, res, next) => {
  try {
    const customers = await Order.aggregate([
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$customer.email', fullName: { $first: '$customer.fullName' }, email: { $first: '$customer.email' }, phone: { $first: '$customer.phone' }, shippingAddress: { $first: '$shippingAddress' }, orders: { $sum: 1 }, totalSpend: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'Completed'] }, '$total', 0] } }, lastOrderAt: { $first: '$createdAt' } } },
      { $sort: { lastOrderAt: -1 } }
    ]);
    res.json({ success: true, data: customers });
  } catch (e) { next(e); }
});

// Products and inventory administration
router.get('/admin/products', requireAdmin, async (_req, res, next) => { try { res.json({ success: true, data: await Product.find().sort({ legacyId: 1 }) }); } catch (e) { next(e); } });
router.get('/admin/products/:id', requireAdmin, async (req, res, next) => { try { const p = await Product.findById(req.params.id); if (!p) return res.status(404).json({ message: 'Product not found.' }); res.json({ success: true, data: p }); } catch (e) { next(e); } });
router.post('/admin/products', requireAdmin, async (req, res, next) => { try { const p = await Product.create(req.body); res.status(201).json({ success: true, data: p }); } catch (e) { next(e); } });
router.put('/admin/products/:id', requireAdmin, async (req, res, next) => { try { const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); if (!p) return res.status(404).json({ message: 'Product not found.' }); res.json({ success: true, data: p }); } catch (e) { next(e); } });
router.delete('/admin/products/:id', requireAdmin, async (req, res, next) => { try { await Product.findByIdAndUpdate(req.params.id, { isActive: false, status: 'draft' }); res.json({ success: true }); } catch (e) { next(e); } });
router.patch('/admin/products/:id/toggle-publish', requireAdmin, async (req, res, next) => { try { const p = await Product.findById(req.params.id); if (!p) return res.status(404).json({ message: 'Product not found.' }); p.status = p.status === 'published' ? 'draft' : 'published'; p.isActive = p.status === 'published'; await p.save(); res.json({ success: true, data: p }); } catch (e) { next(e); } });
router.patch('/admin/products/:id/featured', requireAdmin, async (req, res, next) => { try { const p = await Product.findById(req.params.id); if (!p) return res.status(404).json({ message: 'Product not found.' }); p.featured = !p.featured; await p.save(); res.json({ success: true, data: p }); } catch (e) { next(e); } });
router.get('/admin/inventory', requireAdmin, async (_req, res, next) => { try { const p = await Product.find(); res.json({ success: true, data: p.flatMap(x => x.variants.map(v => ({ productId: x._id, productName: x.name, ...v.toObject() }))) }); } catch (e) { next(e); } });
router.patch('/admin/inventory/:productId/variant/:sku', requireAdmin, async (req, res, next) => { try { const p = await Product.findOneAndUpdate({ _id: req.params.productId, 'variants.sku': req.params.sku }, { $set: { 'variants.$.stock': Math.max(0, Number(req.body.stock || 0)) } }, { new: true }); if (!p) return res.status(404).json({ message: 'Inventory item not found.' }); res.json({ success: true, data: p }); } catch (e) { next(e); } });



router.get('/admin/media', requireAdmin, (_req, res) => {
  const files = fs.readdirSync(uploadDir).filter(f => /\.(png|jpe?g|webp|svg)$/i.test(f));
  res.json({ success: true, data: files.map(filename => ({ filename, url: `/uploads/${filename}`, size: fs.statSync(path.join(uploadDir, filename)).size })) });
});
router.post('/admin/media/upload', requireAdmin, uploader.array('images', 12), (req, res) => {
  res.status(201).json({ success: true, data: (req.files || []).map(f => ({ filename: f.filename, url: `/uploads/${f.filename}` })) });
});
router.delete('/admin/media/:filename', requireAdmin, (req, res) => {
  const filename = path.basename(req.params.filename);
  const target = path.join(uploadDir, filename);
  if (fs.existsSync(target)) fs.unlinkSync(target);
  res.json({ success: true });
});

// Categories
router.get('/categories', async (_req, res, next) => {
  try { const categories = await Category.find().sort({ order: 1 }); res.json({ success: true, data: categories.length ? categories : await Product.distinct('category') }); }
  catch (e) { next(e); }
});
router.get('/admin/categories', requireAdmin, async (_req, res, next) => {
  try {
    let categories = await Category.find().sort({ order: 1 });
    if (!categories.length) {
      const names = await Product.distinct('category');
      categories = names.map((name, i) => ({ _id: `generated-${i}`, name, slug: String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-'), order: i+1 }));
    }
    res.json({ success: true, data: categories });
  } catch (e) { next(e); }
});
router.post('/admin/categories', requireAdmin, async (req, res, next) => { try { const c = await Category.create(req.body); res.status(201).json({ success: true, data: c }); } catch (e) { next(e); } });
router.put('/admin/categories/:id', requireAdmin, async (req, res, next) => { try { const c = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true }); if (!c) return res.status(404).json({ message: 'Category not found' }); res.json({ success: true, data: c }); } catch (e) { next(e); } });
router.delete('/admin/categories/:id', requireAdmin, async (req, res, next) => { try { await Category.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (e) { next(e); } });

// Homepage settings
router.get('/admin/homepage', requireAdmin, async (_req, res, next) => {
  try { const s = await StoreSetting.findOne({ key: 'homepage' }); res.json({ success: true, data: s?.value || {} }); } catch (e) { next(e); }
});
router.put('/admin/homepage', requireAdmin, async (req, res, next) => {
  try { const s = await StoreSetting.findOneAndUpdate({ key: 'homepage' }, { value: req.body }, { upsert: true, new: true }); res.json({ success: true, data: s.value }); } catch (e) { next(e); }
});

// Reviews currently start empty; these endpoints keep the moderation screen functional.
router.get('/admin/reviews', requireAdmin, (_req, res) => res.json({ success: true, data: [] }));
router.patch('/admin/reviews/:id/status', requireAdmin, (_req, res) => res.status(404).json({ message: 'Review not found.' }));
router.delete('/admin/reviews/:id', requireAdmin, (_req, res) => res.status(404).json({ message: 'Review not found.' }));

// Admin health, backup and notification status
router.get('/admin/backup', requireAdmin, async (_req, res, next) => {
  try {
    const [products, orders, categories, settings] = await Promise.all([Product.find().lean(), Order.find().lean(), Category.find().lean(), StoreSetting.find().lean()]);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="agrivafoods-backup.json"');
    res.send(JSON.stringify({ generatedAt: new Date().toISOString(), products, orders, categories, settings }, null, 2));
  } catch (e) { next(e); }
});
router.get('/admin/notifications/status', requireAdmin, (_req, res) => res.json({ success: true, data: { enabled: false, adminEmail: process.env.ADMIN_EMAIL || '' } }));
router.post('/admin/notifications/test', requireAdmin, (_req, res) => res.status(503).json({ message: 'Email notifications are not configured. Add SMTP settings before using this feature.' }));
router.post('/admin/auth/change-password', requireAdmin, async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.admin._id);
    if (!await bcrypt.compare(String(req.body.currentPassword || ''), admin.passwordHash)) return res.status(400).json({ message: 'Current password is incorrect.' });
    if (String(req.body.newPassword || '').length < 10) return res.status(400).json({ message: 'New password must contain at least 10 characters.' });
    admin.passwordHash = await bcrypt.hash(req.body.newPassword, 12); await admin.save();
    res.json({ success: true, message: 'Password updated.' });
  } catch (e) { next(e); }
});

export default router;
