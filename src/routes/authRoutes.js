import express from 'express';
import attachUserProfile from '../middleware/attachUserProfile.js';

import { getUserLabPermissions } from '../services/permissionService.js';

const router = express.Router();

router.get('/me', attachUserProfile, async (req, res) => {
  try {
    const user = req.userProfile || {};
    const effectiveUserId = user.id;

    let userPerms = req.permissions || user.permissions || [];
    if (!Array.isArray(userPerms) || userPerms.length === 0) {
      userPerms = await getUserLabPermissions(effectiveUserId);
    }
    return res.status(200).json({
      success: true,
      status: true,
      data: {
        user: {
          id: effectiveUserId,
          user_id: user.id || effectiveUserId,
          emp_id: user.employee_id || effectiveUserId,
          full_name: user.full_name,
          site_id: req.siteId || user.site_id,
          roles: user.roles || user.role || ['STAFF'],
        },
        permissions: userPerms,
        siteId: req.siteId || user.site_id || 1,
        allowed_modules: ['genomiclab']
      }
    });
  } catch (error) {
    console.error('Error in /auth/me:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
