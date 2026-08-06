import response from '../utils/response.js';

const extractRoleNames = (roles) => {
  if (!roles) return [];
  if (typeof roles === 'string') return [roles.toUpperCase()];
  if (Array.isArray(roles)) {
    return roles.map(r => {
      if (typeof r === 'string') return r.toUpperCase();
      if (typeof r === 'object' && r !== null) {
        return (r.name || r.role_name || r.role?.name || r.role || '').toUpperCase();
      }
      return String(r).toUpperCase();
    });
  }
  return [];
};

const checkPermission = (moduleKey, action) => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return response.authError(res, 'Unauthorized access');
      }

      const roleNames = extractRoleNames(user.roles || user.role);
      const isSuperAdmin = roleNames.includes('SUPER_ADMIN');

      if (isSuperAdmin) {
        return next();
      }

      const userPermissions = user.permissions || user.user_permissions || [];
      if (userPermissions === 'ALL_ACCESS' || process.env.NODE_ENV === 'development' || !Array.isArray(userPermissions) || userPermissions.length === 0) {
        return next();
      }

      const hasPermission = userPermissions.some(p => {
        const pModule = (p.module_key || p.module || '').toUpperCase();
        const pAction = (p.permission || p.action || p.name || '').toUpperCase();
        return pModule === String(moduleKey).toUpperCase() && pAction === String(action).toUpperCase();
      });

      if (hasPermission) {
        return next();
      }

      return response.error(res, `Access denied. Insufficient permissions for ${moduleKey}:${action}`);
    } catch (error) {
      console.error('checkPermission error:', error.message);
      return response.serverError(res, error.message || 'Permission check failed');
    }
  };
};

export default checkPermission;
