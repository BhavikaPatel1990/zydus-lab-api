import jwt from 'jsonwebtoken';

const AUTH_SERVICE_URL = (process.env.AUTH_SERVICE_URL || 'http://localhost:7000/sampark-api').replace(/\/$/, '');

let siteCache = {
    data: [],
    lastFetched: 0
};

const getSiteListUrl = () => {
    return AUTH_SERVICE_URL.endsWith('/api')
        ? `${AUTH_SERVICE_URL}/site/list`
        : `${AUTH_SERVICE_URL}/api/site/list`;
};

const getUserProfileApiUrl = () => {
    return AUTH_SERVICE_URL.endsWith('/api')
        ? `${AUTH_SERVICE_URL}/user/profile`
        : `${AUTH_SERVICE_URL}/api/user/profile`;
};

const fetchCentralSiteList = async (authHeader) => {
    const now = Date.now();
    if (siteCache.data.length > 0 && (now - siteCache.lastFetched) < 300000) {
        return siteCache.data;
    }

    try {
        const siteUrl = getSiteListUrl();
        const headers = authHeader ? { Authorization: authHeader } : {};
        const res = await fetch(siteUrl, {
            headers,
            signal: AbortSignal.timeout(3000)
        });

        if (res.ok) {
            const json = await res.json();
            const rawSites = json?.data || json?.sites || json;
            if (Array.isArray(rawSites)) {
                siteCache.data = rawSites;
                siteCache.lastFetched = now;
                return rawSites;
            }
        }
    } catch (err) {
        console.warn('[attachUserProfile] Central site list API fetch warning:', err.message);
    }
    return siteCache.data;
};

const resolveDynamicSiteName = (sites, siteId, fallbackName) => {
    if (fallbackName && String(fallbackName).trim()) {
        return String(fallbackName).trim();
    }

    if (sites && Array.isArray(sites) && siteId) {
        const sId = Number(siteId) || siteId;
        const matched = sites.find(s =>
            (s.id && (s.id === sId || String(s.id) === String(siteId))) ||
            (s.site_id && (s.site_id === sId || String(s.site_id) === String(siteId))) ||
            (s.code && String(s.code).toLowerCase() === String(siteId).toLowerCase())
        );

        if (matched && (matched.site_name || matched.name)) {
            return matched.site_name || matched.name;
        }
    }

    return 'Zydus Hospital';
};

const attachUserProfile = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const reqSiteId = req.headers['x-site-id'] || req.query.siteId || req.query.site_id;
        
        const centralSites = await fetchCentralSiteList(authHeader);
        let tokenUser = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = jwt.decode(token);
                if (decoded) {
                    const extractedSiteId = reqSiteId || decoded.site_id || decoded.siteId || decoded.site || 1;
                    const extractedSiteName = resolveDynamicSiteName(centralSites, extractedSiteId, decoded.site_name || decoded.siteName);

                    tokenUser = {
                        id: decoded.id || decoded.userId || decoded.user_id || 'usr-101',
                        full_name: decoded.full_name || decoded.name || decoded.userName || 'Logged-in User',
                        employee_id: decoded.employee_id || decoded.emp_id || decoded.emp_code || decoded.empCode || 'N/A',
                        site_id: Number(extractedSiteId) || extractedSiteId,
                        site_name: extractedSiteName,
                        roles: decoded.roles || decoded.role || ['STAFF']
                    };
                }
            } catch (e) {
                console.warn('[attachUserProfile] JWT decode warning:', e.message);
            }
        }

        if (authHeader) {
            try {
                const profileUrl = getUserProfileApiUrl();
                const apiRes = await fetch(profileUrl, {
                    headers: { Authorization: authHeader },
                    signal: AbortSignal.timeout(3000)
                });

                if (apiRes.ok) {
                    const result = await apiRes.json();
                    const data = result?.data || {};

                    const fetchedUser = data.userProfile || data.user || data;
                    const finalSiteId = Number(data.siteId || fetchedUser.site_id || reqSiteId || tokenUser?.site_id) || 1;
                    const finalSiteName = resolveDynamicSiteName(centralSites, finalSiteId, data.siteName || fetchedUser.site_name || tokenUser?.site_name);

                    req.userProfile = {
                        id: fetchedUser.id || fetchedUser.userId || tokenUser?.id || 'usr-101',
                        full_name: fetchedUser.full_name || fetchedUser.name || tokenUser?.full_name || 'Logged-in User',
                        employee_id: fetchedUser.employee_id || fetchedUser.emp_id || fetchedUser.emp_code || tokenUser?.employee_id || 'N/A',
                        site_id: finalSiteId,
                        site_name: finalSiteName,
                        roles: fetchedUser.roles || fetchedUser.role || tokenUser?.roles || ['STAFF']
                    };
                    req.permissions = data.permissions || [];
                    req.siteId = finalSiteId;
                    req.siteName = finalSiteName;
                    return next();
                }
            } catch (err) {
                console.warn('[attachUserProfile] Central auth profile call warning:', err.message);
            }
        }

        if (tokenUser) {
            req.userProfile = tokenUser;
            req.permissions = [];
            req.siteId = tokenUser.site_id;
            req.siteName = tokenUser.site_name;
            return next();
        }

        const fallbackSiteId = Number(reqSiteId) || 1;
        const fallbackSiteName = resolveDynamicSiteName(centralSites, fallbackSiteId, null);

        req.userProfile = {
            id: 'usr-guest',
            full_name: 'Logged-in User',
            employee_id: 'N/A',
            site_id: fallbackSiteId,
            site_name: fallbackSiteName,
            roles: ['STAFF']
        };
        req.permissions = [];
        req.siteId = fallbackSiteId;
        req.siteName = fallbackSiteName;
        next();
    } catch (err) {
        console.error('[attachUserProfile] Unexpected error:', err.message);
        next();
    }
};

export default attachUserProfile;
