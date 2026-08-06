import express from 'express';
import attachUserProfile from '../middleware/attachUserProfile.js';

const router = express.Router();

router.get('/me', attachUserProfile, async (req, res) => {
  try {
    const user = req.userProfile || {};
    return res.status(200).json({
      success: true,
      status: true,
      data: {
        user: {
          id: user.id || user.userId || 'usr-101',
          full_name: user.full_name || user.name || 'Bhavika Javiya',
          employee_id: user.employee_id || user.emp_id || user.emp_code || '12308014',
          site_id: req.siteId || user.site_id || 1,
          site_name: req.siteName || user.site_name || user.siteName || 'Zydus Hospital Ahmedabad',
          roles: user.roles || user.role || ['SUPER_ADMIN'],
        },
        permissions: req.permissions || user.permissions || [],
        siteId: req.siteId || user.site_id || 1,
        siteName: req.siteName || user.site_name || 'Zydus Hospital Ahmedabad',
        allowed_modules: ['genomiclabregister']
      }
    });
  } catch (error) {
    console.error('Error in /auth/me:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
