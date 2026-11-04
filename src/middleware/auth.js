import jwt from 'jsonwebtoken';
import { Admin } from '../models/index.js';

export async function requireAdmin(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ message: 'Administrator login required.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(payload.sub).select('_id name email role');
    if (!admin || admin.role !== 'admin') return res.status(401).json({ message: 'Invalid administrator session.' });
    req.admin = admin;
    next();
  } catch {
    return res.status(401).json({ message: 'Session expired. Please log in again.' });
  }
}
