import prisma from '../config/prisma.js';

const SITE_NAMES = {
  1: 'Zydus Hospital Ahmedabad',
  2: 'Zydus Hospital Anand',
  3: 'Zydus Hospital Vadodara',
  4: 'Zydus Medical College Dahod',
  5: 'Zydus Cancer Hospital'
};

const formatRecordWithSite = (record) => {
  if (!record) return null;
  return {
    ...record,
    site: {
      id: record.mst_siteid,
      site_name: SITE_NAMES[record.mst_siteid] || `Site ${record.mst_siteid}`
    }
  };
};

export const getAllGenomicLabRecords = async (req) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    siteId,
    emailedFilter,
    uploadedFilter,
    printFilter,
    fromDate,
    toDate
  } = req.query;

  const userSiteId = req.user?.siteId || req.user?.site_id || req.user?.emp_site_id || req.user?.mst_siteid || req.userProfile?.site_id || req.userProfile?.emp_site_id;
  const effectiveSiteId = siteId || userSiteId;

  let where = {
    deleted_at: null,
  };

  if (effectiveSiteId && !isNaN(Number(effectiveSiteId))) {
    where.mst_siteid = Number(effectiveSiteId);
  }

  if (fromDate || toDate) {
    where.created_at = {};
    if (fromDate) {
      where.created_at.gte = new Date(`${fromDate}T00:00:00.000Z`);
    }
    if (toDate) {
      where.created_at.lte = new Date(`${toDate}T23:59:59.999Z`);
    }
  }

  if (emailedFilter === 'true' || emailedFilter === '1') {
    where.emailed_status = true;
  } else if (emailedFilter === 'false' || emailedFilter === '0') {
    where.emailed_status = false;
  }

  if (uploadedFilter === 'true' || uploadedFilter === '1') {
    where.uploaded_report_status = true;
  } else if (uploadedFilter === 'false' || uploadedFilter === '0') {
    where.uploaded_report_status = false;
  }

  if (printFilter === 'true' || printFilter === '1') {
    where.print_report_status = true;
  } else if (printFilter === 'false' || printFilter === '0') {
    where.print_report_status = false;
  }

  if (search && search.trim() !== "") {
    const trimmed = search.trim();
    where.OR = [
      { mrn: { contains: trimmed, mode: "insensitive" } },
      { patient_name: { contains: trimmed, mode: "insensitive" } },
      { diagnosis: { contains: trimmed, mode: "insensitive" } },
      { block_no: { contains: trimmed, mode: "insensitive" } },
      { cellularity: { contains: trimmed, mode: "insensitive" } },
      { received_items: { contains: trimmed, mode: "insensitive" } },
    ];
  }

  const p = Math.max(1, parseInt(page));
  const l = Math.max(1, parseInt(limit));
  const skip = (p - 1) * l;

  const [total, rawData] = await Promise.all([
    prisma.genomicLabRegister.count({ where }),
    prisma.genomicLabRegister.findMany({
      where,
      skip,
      take: l,
      orderBy: { created_at: "desc" }
    })
  ]);

  const data = rawData.map(formatRecordWithSite);

  return {
    data,
    pagination: {
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l) || 1
    }
  };
};

export const getGenomicLabById = async (id) => {
  const record = await prisma.genomicLabRegister.findFirst({
    where: { id, deleted_at: null }
  });
  return formatRecordWithSite(record);
};

export const createGenomicLabRecord = async (data, userId, userName) => {
  const {
    mrn,
    patient_name,
    age_gender,
    received_items,
    block_no,
    cellularity,
    diagnosis,
    emailed_status,
    emailed_date,
    uploaded_report_status,
    uploaded_report_date,
    print_report_status,
    print_report_date,
    others,
    mst_siteid
  } = data;

  const created = await prisma.genomicLabRegister.create({
    data: {
      mrn,
      patient_name,
      age_gender,
      received_items: received_items || null,
      block_no: block_no || null,
      cellularity: cellularity || null,
      diagnosis: diagnosis || null,
      emailed_status: Boolean(emailed_status),
      emailed_date: emailed_date ? new Date(emailed_date) : null,
      uploaded_report_status: Boolean(uploaded_report_status),
      uploaded_report_date: uploaded_report_date ? new Date(uploaded_report_date) : null,
      print_report_status: Boolean(print_report_status),
      print_report_date: print_report_date ? new Date(print_report_date) : null,
      others: others || null,
      mst_siteid: Number(mst_siteid || 1),
      created_by: userId || null,
      created_by_name: userName || null
    }
  });

  return formatRecordWithSite(created);
};

export const updateGenomicLabRecord = async (id, data, userId, userName) => {
  const {
    mrn,
    patient_name,
    age_gender,
    received_items,
    block_no,
    cellularity,
    diagnosis,
    emailed_status,
    emailed_date,
    uploaded_report_status,
    uploaded_report_date,
    print_report_status,
    print_report_date,
    others,
    mst_siteid
  } = data;

  const updated = await prisma.genomicLabRegister.update({
    where: { id },
    data: {
      mrn,
      patient_name,
      age_gender,
      received_items: received_items || null,
      block_no: block_no || null,
      cellularity: cellularity || null,
      diagnosis: diagnosis || null,
      emailed_status: Boolean(emailed_status),
      emailed_date: emailed_date ? new Date(emailed_date) : null,
      uploaded_report_status: Boolean(uploaded_report_status),
      uploaded_report_date: uploaded_report_date ? new Date(uploaded_report_date) : null,
      print_report_status: Boolean(print_report_status),
      print_report_date: print_report_date ? new Date(print_report_date) : null,
      others: others || null,
      mst_siteid: Number(mst_siteid || 1),
      updated_by: userId || null,
      updated_by_name: userName || null
    }
  });

  return formatRecordWithSite(updated);
};

export const deleteGenomicLabRecord = async (id, userId, userName) => {
  const deleted = await prisma.genomicLabRegister.update({
    where: { id },
    data: {
      deleted_at: new Date(),
      deleted_by: userId || null,
      deleted_by_name: userName || null
    }
  });

  return formatRecordWithSite(deleted);
};

export const exportGenomicLabModel = async (req) => {
  const {
    search = "",
    siteId,
    emailedFilter,
    uploadedFilter,
    printFilter,
    fromDate,
    toDate
  } = req.query;

  const userSiteId = req.user?.siteId || req.user?.site_id || req.user?.emp_site_id || req.user?.mst_siteid || req.userProfile?.site_id || req.userProfile?.emp_site_id;
  const effectiveSiteId = siteId || userSiteId;

  let where = { deleted_at: null };

  if (effectiveSiteId && !isNaN(Number(effectiveSiteId))) {
    where.mst_siteid = Number(effectiveSiteId);
  }

  if (fromDate || toDate) {
    where.created_at = {};
    if (fromDate) {
      where.created_at.gte = new Date(`${fromDate}T00:00:00.000Z`);
    }
    if (toDate) {
      where.created_at.lte = new Date(`${toDate}T23:59:59.999Z`);
    }
  }

  if (emailedFilter === 'true' || emailedFilter === '1') {
    where.emailed_status = true;
  } else if (emailedFilter === 'false' || emailedFilter === '0') {
    where.emailed_status = false;
  }

  if (uploadedFilter === 'true' || uploadedFilter === '1') {
    where.uploaded_report_status = true;
  } else if (uploadedFilter === 'false' || uploadedFilter === '0') {
    where.uploaded_report_status = false;
  }

  if (printFilter === 'true' || printFilter === '1') {
    where.print_report_status = true;
  } else if (printFilter === 'false' || printFilter === '0') {
    where.print_report_status = false;
  }

  if (search && search.trim() !== "") {
    const trimmed = search.trim();
    where.OR = [
      { mrn: { contains: trimmed, mode: "insensitive" } },
      { patient_name: { contains: trimmed, mode: "insensitive" } },
      { diagnosis: { contains: trimmed, mode: "insensitive" } },
      { block_no: { contains: trimmed, mode: "insensitive" } },
    ];
  }

  const raw = await prisma.genomicLabRegister.findMany({
    where,
    orderBy: { created_at: "desc" }
  });

  return raw.map(formatRecordWithSite);
};
