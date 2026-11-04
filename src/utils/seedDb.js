import bcrypt from 'bcryptjs';
import { Product, Admin, Category } from '../models/index.js';
import { mockProducts } from '../data/mockProducts.js';

export async function seedDatabase() {
  const count = await Product.countDocuments();
  if (!count) {
    await Product.insertMany(mockProducts.map(({ id, ...p }) => ({ ...p, legacyId: id, status: 'published', isActive: true })));
    console.log(`Seeded ${mockProducts.length} AgrivaFoods products.`);
  }
  if (await Category.countDocuments() === 0) {
    const names = await Product.distinct('category');
    if (names.length) await Category.insertMany(names.map((name, i) => ({ name, slug: String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-'), order: i + 1 })));
  }
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (email && password) {
    const existing = await Admin.findOne({ email });
    if (!existing) {
      const passwordHash = await bcrypt.hash(password, 12);
      await Admin.create({ name: process.env.ADMIN_NAME || 'AgrivaFoods Admin', email, passwordHash, role: 'admin' });
      console.log(`Initial administrator created for ${email}.`);
    }
  }
}
