import prisma from '../config/prisma.js';
import jwt from 'jsonwebtoken';
import masterPool from '../config/masterDb.js';

export const getUserLabPermissions = async (userId) => {
  if (!userId) return [];
  const targetId = String(userId);

  const records = await prisma.userLabPermission.findMany({
    where: {
      OR: [
        { user_id: targetId },
        { emp_id: targetId }
      ]
    }
  });

  if (Array.isArray(records) && records.length > 0) {
    return records;
  }

  // Cross-reference public.users in zydusapp DB to find emp_id and id
  try {
    const userRes = await masterPool.query(`
      SELECT emp_id, id::text AS id_str
      FROM public.users
      WHERE emp_id = $1 OR id::text = $1;
    `, [targetId]);

    if (userRes.rows && userRes.rows.length > 0) {
      const { emp_id, id_str } = userRes.rows[0];
      const matchIds = [emp_id, id_str].filter(Boolean);
      const crossRecords = await prisma.userLabPermission.findMany({
        where: {
          OR: [
            { user_id: { in: matchIds } },
            { emp_id: { in: matchIds } }
          ]
        }
      });
      if (Array.isArray(crossRecords) && crossRecords.length > 0) {
        return crossRecords;
      }
    }
  } catch (e) {
    console.warn('[permissionService] User cross-reference lookup notice:', e.message);
  }

  return [];
};

export const saveUserLabPermissions = async (userId, userName, userEmail, modulePermissions = [], empId = null) => {
  if (!userId || !Array.isArray(modulePermissions)) {
    throw new Error('User ID and module permissions array are required.');
  }

  const effectiveEmpId = empId ? String(empId) : String(userId);

  const results = [];
  for (const item of modulePermissions) {
    let { module_key, can_read, can_create, can_update, can_delete, can_export, allowed_site_ids } = item;
    if (!module_key) continue;

    let keyUpper = String(module_key).toUpperCase();
    if (keyUpper === 'GENOMIC_LAB_REGISTER') {
      keyUpper = 'GENOMIC_LAB';
    }

    const siteIds = Array.isArray(allowed_site_ids) ? allowed_site_ids.map(Number).filter(n => !isNaN(n) && n > 0) : [1];

    const record = await prisma.userLabPermission.upsert({
      where: {
        user_id_module_key: {
          user_id: String(userId),
          module_key: keyUpper
        }
      },
      update: {
        emp_id: effectiveEmpId,
        user_name: userName || undefined,
        user_email: userEmail || undefined,
        can_read: Boolean(can_read),
        can_create: Boolean(can_create),
        can_update: Boolean(can_update),
        can_delete: Boolean(can_delete),
        can_export: Boolean(can_export),
        allowed_site_ids: siteIds
      },
      create: {
        user_id: String(userId),
        emp_id: effectiveEmpId,
        user_name: userName || 'Portal User',
        user_email: userEmail || '',
        module_key: keyUpper,
        can_read: Boolean(can_read),
        can_create: Boolean(can_create),
        can_update: Boolean(can_update),
        can_delete: Boolean(can_delete),
        can_export: Boolean(can_export),
        allowed_site_ids: siteIds
      }
    });
    results.push(record);
  }

  return results;
};

export const getConfiguredUsers = async () => {
  const allRecords = await prisma.userLabPermission.findMany({
    orderBy: { updated_at: 'desc' }
  });

  const userMap = {};
  allRecords.forEach(rec => {
    if (!userMap[rec.user_id]) {
      userMap[rec.user_id] = {
        user_id: rec.user_id,
        user_name: rec.user_name || 'Portal User',
        user_email: rec.user_email || '',
        updated_at: rec.updated_at,
        modules: []
      };
    }
    userMap[rec.user_id].modules.push({
      module_key: rec.module_key,
      can_read: rec.can_read,
      can_create: rec.can_create,
      can_update: rec.can_update,
      can_delete: rec.can_delete,
      can_export: rec.can_export,
      allowed_site_ids: rec.allowed_site_ids
    });
  });

  return Object.values(userMap);
};

const AUTH_SERVICE_URL = (process.env.AUTH_SERVICE_URL || 'http://localhost:7000/sampark-api').replace(/\/$/, '');

export const fetchCentralRoleList = async () => {
  try {
    const res = await masterPool.query(`
      SELECT DISTINCT name
      FROM public.roles
      WHERE status = true OR status IS NULL
      ORDER BY name;
    `);
    if (res.rows && Array.isArray(res.rows)) {
      return res.rows.map(r => String(r.name).toUpperCase()).filter(Boolean);
    }
  } catch (err) {
    console.warn('[permissionService] Master DB role query notice:', err.message);
  }
  return [];
};

export const fetchCentralUserList = async (authHeader, role, search) => {
  let masterUsers = [];

  // 1. Decode logged-in token session user dynamically if authorization header is provided
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.decode(token);
      if (decoded) {
        const tokenEmpId = String(decoded.employee_id || decoded.emp_id || decoded.emp_code || decoded.empCode || decoded.id || decoded.userId || decoded.user_id || '12308014');
        const tokenUserName = decoded.full_name || decoded.name || decoded.userName || decoded.user_name || 'Ms BHAVIKA JAVIYA';
        const tokenEmail = decoded.email || decoded.user_email || 'bhavikajaviya@zydushospitals.com';
        const tokenRole = String(decoded.role || decoded.roles?.[0] || 'SUPER_ADMIN').toUpperCase();
        const tokenSite = decoded.site_name || decoded.siteName || 'Zydus Hospital Ahmedabad';

        masterUsers.push({
          user_id: tokenEmpId,
          user_name: tokenUserName,
          user_email: tokenEmail,
          department: 'Laboratory',
          role: tokenRole,
          primary_site: tokenSite
        });
      }
    } catch (e) {
      console.warn('[permissionService] JWT token decode warning:', e.message);
    }
  }

  try {
    const listUrl = AUTH_SERVICE_URL.endsWith('/api')
      ? `${AUTH_SERVICE_URL}/user/list`
      : `${AUTH_SERVICE_URL}/api/user/list`;

    const queryParams = new URLSearchParams();
    if (role && role !== 'ALL') queryParams.append('role', role);
    if (search) queryParams.append('search', search);

    const fullUrl = `${listUrl}?${queryParams.toString()}`;
    const headers = authHeader ? { Authorization: authHeader } : {};

    const res = await fetch(fullUrl, {
      headers,
      signal: AbortSignal.timeout(3000)
    });

    if (res.ok) {
      const json = await res.json();
      const rawUsers = json?.data || json?.users || json;
      if (Array.isArray(rawUsers) && rawUsers.length > 0) {
        const fetched = rawUsers.map(u => ({
          user_id: String(u.emp_id || u.employeeID || u.id || u.user_id || u.employee_id || u.emp_code || u.code || ''),
          user_name: u.full_name || u.name || u.username || u.user_name || u.userName || 'Portal Employee',
          user_email: u.email || u.user_email || '',
          department: u.department || u.dept || u.department_name || 'Laboratory',
          role: String(u.role || u.role_name || u.roles?.[0] || 'USER').toUpperCase(),
          primary_site: u.site_name || u.siteName || 'Zydus Hospital Ahmedabad'
        })).filter(u => u.user_id);
        masterUsers.push(...fetched);
      }
    }
  } catch (err) {
    console.warn('[permissionService] Central user list fetch warning:', err.message);
  }

  // 100% Dynamic Master DB SQL query for labportal users (connecting to zydusapp DB):
  try {
    const queryResult = await masterPool.query(`
      SELECT
        COALESCE(u.emp_id, u.id::text) AS user_id,
        COALESCE(u.full_name, u.username, 'Portal Employee') AS user_name,
        COALESCE(u.email, '') AS user_email,
        COALESCE(hd.his_dept_name, u.emp_dept, 'Laboratory') AS department,
        UPPER(COALESCE(r.name, 'USER')) AS role,
        COALESCE(s.site_name, 'Zydus Hospital Ahmedabad') AS primary_site,
        u.emp_site_id AS primary_site_id,
        COALESCE(
          (
            SELECT ARRAY_AGG(us.site_id)
            FROM public.user_sites us
            WHERE us.user_id = u.id
          ),
          ARRAY[u.emp_site_id]
        ) AS master_allocated_site_ids
      FROM public.users u
      JOIN public.user_roles ur
        ON ur.user_id = u.id
      JOIN public.roles r
        ON r.id = ur.role_id
      JOIN public.role_permissions rp
        ON rp.role_id = ur.role_id
      JOIN public.modules m
        ON m.id = rp.module_id
      LEFT JOIN public.his_dept hd
        ON hd.id = u.his_dept
      LEFT JOIN public.mst_sites s
        ON s.id = u.emp_site_id
      WHERE m.url LIKE '%labportal/%'
      GROUP BY u.id, u.emp_id, u.full_name, u.username, u.email, hd.his_dept_name, u.emp_dept, r.name, s.site_name, u.emp_site_id;
    `);
    const rawSqlUsers = queryResult.rows || [];
    if (Array.isArray(rawSqlUsers) && rawSqlUsers.length > 0) {
      const sqlMapped = rawSqlUsers.map(u => ({
        user_id: String(u.user_id || ''),
        user_name: String(u.user_name || 'Portal Employee'),
        user_email: String(u.user_email || ''),
        department: String(u.department || 'Laboratory'),
        role: String(u.role || 'USER').toUpperCase(),
        primary_site: String(u.primary_site || 'Zydus Hospital Ahmedabad'),
        primary_site_id: u.primary_site_id ? Number(u.primary_site_id) : null,
        master_allocated_site_ids: Array.isArray(u.master_allocated_site_ids)
          ? u.master_allocated_site_ids.map(Number).filter(Boolean)
          : (u.primary_site_id ? [Number(u.primary_site_id)] : [])
      })).filter(u => u.user_id);
      masterUsers.push(...sqlMapped);
    }
  } catch (sqlErr) {
    console.warn('[permissionService] Master DB zydusapp query notice:', sqlErr.message);
  }

  const dbUsers = await getConfiguredUsers();
  const dbMapped = dbUsers.map(u => ({
    user_id: u.user_id,
    user_name: u.user_name || 'Portal Employee',
    user_email: u.user_email || '',
    department: 'Laboratory',
    role: 'USER',
    primary_site: 'Zydus Hospital Ahmedabad'
  }));

  // Combine and deduplicate users by user_id dynamically from Central Auth API + PostgreSQL DB
  const userMap = new Map();
  [...masterUsers, ...dbMapped].forEach(u => {
    if (u.user_id && !userMap.has(u.user_id)) {
      userMap.set(u.user_id, u);
    }
  });

  let combinedList = Array.from(userMap.values());

  // Apply Role Filter
  if (role && role !== 'ALL') {
    combinedList = combinedList.filter(u => u.role.toUpperCase() === String(role).toUpperCase());
  }

  // Apply Search Filter (matches Employee ID, Name, Email, or Department)
  if (search && String(search).trim() !== '') {
    const q = String(search).trim().toLowerCase();
    combinedList = combinedList.filter(u =>
      u.user_id.toLowerCase().includes(q) ||
      u.user_name.toLowerCase().includes(q) ||
      u.user_email.toLowerCase().includes(q) ||
      u.department.toLowerCase().includes(q)
    );
  }

  return combinedList;
};

export const getDynamicPortalUsers = async (authHeader, roleFilter, search) => {
  const centralUsers = await fetchCentralUserList(authHeader, roleFilter, search);
  const dbRecords = await prisma.userLabPermission.findMany();

  const dbUserMap = {};
  dbRecords.forEach(rec => {
    if (!dbUserMap[rec.user_id]) {
      dbUserMap[rec.user_id] = [];
    }
    dbUserMap[rec.user_id].push(rec);
  });

  return centralUsers.map(u => ({
    ...u,
    lab_permissions: dbUserMap[u.user_id] || []
  }));
};

export const getSites = async () => {
  try {
    const res = await masterPool.query(`
      SELECT id, site_name
      FROM public.mst_sites
      WHERE status = true OR status IS NULL
      ORDER BY id;
    `);
    if (res.rows && Array.isArray(res.rows)) {
      return res.rows.map(s => ({
        id: Number(s.id),
        site_name: String(s.site_name || `Site ${s.id}`)
      }));
    }
  } catch (e) {
    console.warn('[permissionService] Dynamic DB site fetch notice:', e.message);
  }
  return [];
};

export const getModules = async () => {
  try {
    const res = await masterPool.query(`
      SELECT id, module_name, module_key, url, icon, icon_desc
      FROM public.modules
      WHERE (url LIKE '%labportal/%' OR url LIKE '%/labportal%')
        AND (status = true OR status IS NULL)
      ORDER BY order_no, module_name;
    `);
    if (res.rows && Array.isArray(res.rows)) {
      return res.rows.map(m => ({
        key: String(m.module_key).toUpperCase(),
        name: String(m.module_name),
        icon: m.icon || 'bi-flask',
        color: m.module_key === 'GENOMIC_LAB' ? '#0d9488' : m.module_key === 'HISTO_LAB' ? '#0284c7' : m.module_key === 'MICRO_LAB' ? '#7c3aed' : '#c026d3'
      }));
    }
  } catch (e) {
    console.warn('[permissionService] Dynamic DB module fetch notice:', e.message);
  }
  return [];
};
