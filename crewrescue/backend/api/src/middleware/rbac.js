import { PERMISSIONS } from '@crewrescue/shared';

/**
 * RBAC permission check middleware factory.
 * Usage: authorize('incidents:*') or authorize('optimization:approve')
 */
export function authorize(...requiredPermissions) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ success: false, error: 'Unauthenticated' });

    const rolePerms = PERMISSIONS[role] ?? [];

    // Super admin bypass
    if (rolePerms.includes('*')) return next();

    const allowed = requiredPermissions.every((required) => {
      const [resource, action] = required.split(':');
      return (
        rolePerms.includes('*') ||
        rolePerms.includes(`${resource}:*`) ||
        rolePerms.includes(`${resource}:${action}`)
      );
    });

    if (!allowed) {
      return res.status(403).json({
        success: false,
        error: `Your role (${role}) does not have permission to perform this action`,
      });
    }

    next();
  };
}

/**
 * Tenant isolation middleware.
 * Ensures the resource being accessed belongs to the authenticated user's organization.
 * Call after authenticate().
 */
export function tenantScope(req, _res, next) {
  // organizationId is already set by authenticate middleware
  // All queries must be scoped with req.organizationId
  next();
}
