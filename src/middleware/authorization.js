import jwt from 'jsonwebtoken';
import response from '../utils/response.js';
import dotenv from 'dotenv';
dotenv.config();

export const authorize = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization || req.header("Authorization");

    if (!authHeader) {
      return response.authError(res, "Unauthorized: No token provided");
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return response.authError(res, "Unauthorized: Invalid token format");
    }

    const token = parts[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload?.id && !payload?.userId) {
      return response.authError(res, "Unauthorized: Invalid or expired token");
    }

    req.user = {
      id: payload.id || payload.userId,
      username: payload.username || payload.emp_id || '',
      full_name: payload.full_name || payload.name || '',
      roles: payload.roles || payload.role || [],
      permissions: payload?.permissions || {},
      siteId: payload.siteId || payload.site_id || null,
      site_id: payload.site_id || payload.siteId || null
    };

    next();
  } catch (err) {
    console.error('Authorization error:', err.message);
    return response.authError(res, "Unauthorized: Invalid or expired token");
  }
};
