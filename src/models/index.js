import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
  id: String, weight: String, price: Number, originalPrice: Number, stock: { type: Number, default: 0 }, sku: { type: String, index: true }, isPopular: Boolean
}, { _id: false });

const productSchema = new mongoose.Schema({
  legacyId: Number, slug: { type: String, unique: true, index: true }, name: String, tagline: String,
  category: String, description: String, shortDescription: String, rating: Number, reviewCount: Number,
  badge: String, featured: Boolean, currency: { type: String, default: 'INR' }, origin: String,
  shelfLife: String, storageInstructions: String, usageInstructions: String, ingredients: [String],
  benefits: [String], nutrition: mongoose.Schema.Types.Mixed, images: [String], variants: [variantSchema],
  status: { type: String, default: 'published' }, isActive: { type: Boolean, default: true }
}, { timestamps: true, strict: false });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true, index: true },
  customer: { fullName: String, email: String, phone: String },
  shippingAddress: { address: String, apartment: String, city: String, state: String, pinCode: String, country: String },
  items: [{ productId: String, sku: String, name: String, weight: String, quantity: Number, price: Number, image: String }],
  subtotal: Number, shippingFee: Number, total: Number,
  paymentMethod: { type: String, enum: ['Razorpay', 'COD'] },
  paymentStatus: { type: String, default: 'Pending' },
  orderStatus: { type: String, default: 'placed' },
  razorpayOrderId: String, razorpayPaymentId: String, razorpaySignature: String,
  trackingNumber: String, paidAt: Date, stockAdjusted: { type: Boolean, default: false }
}, { timestamps: true });

const adminSchema = new mongoose.Schema({
  name: String, email: { type: String, unique: true, lowercase: true }, passwordHash: String, role: { type: String, default: 'admin' }
}, { timestamps: true });

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

const categorySchema = new mongoose.Schema({ name: String, slug: { type: String, unique: true }, description: String, image: String, order: Number }, { timestamps: true });
const settingSchema = new mongoose.Schema({ key: { type: String, unique: true }, value: mongoose.Schema.Types.Mixed }, { timestamps: true });
export const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
export const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);
export const StoreSetting = mongoose.models.StoreSetting || mongoose.model('StoreSetting', settingSchema);

