import prisma from '../config/prisma.js';

const formatRecordWithSite = (record) => {
  if (!record) return null;
  return {
    ...record,
    site: {
      id: record.mst_siteid,
      site_name: `Site ${record.mst_siteid}`
    }
  };
};

export const calculateTatCategory = (rec) => {
  if (!rec) return null;

  // If entry is Processed or Report is Uploaded / Emailed, TAT is not considered
  const isProcessed = rec.process_status === 'Processed' || Boolean(rec.uploaded_report_status) || Boolean(rec.emailed_status);
  if (isProcessed) return null;

  if (!rec.expected_date) return 'within';

  const expDateStr = String(rec.expected_date).trim();
  const expTime = new Date(expDateStr.includes('T') ? expDateStr : `${expDateStr}T23:59:59.999Z`).getTime();
  if (isNaN(expTime)) return 'within';

  const recDateStr = rec.received_date || rec.order_date || rec.created_at;
  let recTime = recDateStr ? new Date(recDateStr).getTime() : NaN;
  if (isNaN(recTime)) {
    recTime = expTime - (7 * 24 * 60 * 60 * 1000);
  }

  const now = Date.now();
  const totalDuration = Math.max(expTime - recTime, 24 * 60 * 60 * 1000);

  if (now > expTime) return 'outlier';

  const remainingTime = expTime - now;

  if (remainingTime >= 0 && (remainingTime / totalDuration) <= 0.20) {
    return 'near';
  }

  return 'within';
};

export const buildWhereClause = (query = {}) => {
  const {
    search = "",
    siteId,
    allowedSiteIds,
    allowed_site_ids,
    statusFilter,
    process_status,
    serviceFilter,
    emailedFilter,
    uploadedFilter,
    printFilter,
    fromDate,
    toDate
  } = query;

  const andConditions = [{ deleted_at: null }];

  const rawAllowed = allowedSiteIds || allowed_site_ids;
  let parsedAllowedSiteIds = [];
  if (Array.isArray(rawAllowed)) {
    parsedAllowedSiteIds = rawAllowed.map(Number).filter(n => !isNaN(n) && n > 0);
  } else if (typeof rawAllowed === 'string' && rawAllowed.trim() !== '') {
    parsedAllowedSiteIds = rawAllowed.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0);
  }

  if (siteId && siteId !== 'all' && siteId !== 'ALL' && !isNaN(Number(siteId))) {
    const targetSite = Number(siteId);
    if (parsedAllowedSiteIds.length > 0 && !parsedAllowedSiteIds.includes(targetSite)) {
      andConditions.push({ mst_siteid: -1 });
    } else {
      andConditions.push({ mst_siteid: targetSite });
    }
  } else if (parsedAllowedSiteIds.length > 0) {
    andConditions.push({ mst_siteid: { in: parsedAllowedSiteIds } });
  }

  const statusVal = statusFilter || process_status;
  if (statusVal && statusVal !== 'all' && statusVal !== 'ALL') {
    andConditions.push({ process_status: String(statusVal).trim() });
  }

  if (serviceFilter && serviceFilter !== 'all' && serviceFilter !== 'ALL') {
    const trimmedSvc = String(serviceFilter).trim();
    andConditions.push({
      OR: [
        { genomic_services: { contains: trimmedSvc, mode: 'insensitive' } },
        { service_name: { contains: trimmedSvc, mode: 'insensitive' } },
        { service_code: { contains: trimmedSvc, mode: 'insensitive' } }
      ]
    });
  }

  if (fromDate || toDate) {
    andConditions.push({
      OR: [
        {
          order_date: {
            ...(fromDate && { gte: String(fromDate) }),
            ...(toDate && { lte: `${toDate} 23:59:59` }),
          }
        },
        {
          created_at: {
            ...(fromDate && { gte: new Date(`${fromDate}T00:00:00.000Z`) }),
            ...(toDate && { lte: new Date(`${toDate}T23:59:59.999Z`) }),
          }
        }
      ]
    });
  }

  if (emailedFilter === 'true' || emailedFilter === '1') {
    andConditions.push({ emailed_status: true });
  } else if (emailedFilter === 'false' || emailedFilter === '0') {
    andConditions.push({ emailed_status: false });
  }

  if (uploadedFilter === 'true' || uploadedFilter === '1') {
    andConditions.push({ uploaded_report_status: true });
  } else if (uploadedFilter === 'false' || uploadedFilter === '0') {
    andConditions.push({ uploaded_report_status: false });
  }

  if (printFilter === 'true' || printFilter === '1') {
    andConditions.push({ print_report_status: true });
  } else if (printFilter === 'false' || printFilter === '0') {
    andConditions.push({ print_report_status: false });
  }

  if (search && search.trim() !== "") {
    const trimmed = search.trim();
    andConditions.push({
      OR: [
        { mrn: { contains: trimmed, mode: "insensitive" } },
        { patient_name: { contains: trimmed, mode: "insensitive" } },
        { patient_email: { contains: trimmed, mode: "insensitive" } },
        { doctor_name: { contains: trimmed, mode: "insensitive" } },
        { age: { contains: trimmed, mode: "insensitive" } },
        { gender: { contains: trimmed, mode: "insensitive" } },
        { diagnosis: { contains: trimmed, mode: "insensitive" } },
        { block_no: { contains: trimmed, mode: "insensitive" } },
        { cellularity: { contains: trimmed, mode: "insensitive" } },
        { received_items: { contains: trimmed, mode: "insensitive" } },
        { zygene_number: { contains: trimmed, mode: "insensitive" } },
        { genomic_services: { contains: trimmed, mode: "insensitive" } },
        { service_name: { contains: trimmed, mode: "insensitive" } },
        { service_code: { contains: trimmed, mode: "insensitive" } },
        { service_order_id: { contains: trimmed, mode: "insensitive" } },
        { process_status: { contains: trimmed, mode: "insensitive" } },
      ]
    });
  }

  return { AND: andConditions };
};

export const getAllGenomicLabRecords = async (req) => {
  const {
    page = 1,
    limit = 10,
    tatFilter
  } = req.query;

  const where = buildWhereClause(req.query);

  const p = Math.max(1, parseInt(page));
  const l = Math.max(1, parseInt(limit));
  const skip = (p - 1) * l;

  if (tatFilter && tatFilter !== 'all' && tatFilter !== 'ALL') {
    const rawData = await prisma.genomicLabRegister.findMany({
      where,
      orderBy: [
        { order_date: 'desc' },
        { created_at: 'desc' }
      ]
    });

    let finalData = rawData.map(formatRecordWithSite);
    finalData = finalData.filter(rec => calculateTatCategory(rec) === tatFilter);

    const total = finalData.length;
    const emailedReports = finalData.filter(r => r.emailed_status).length;
    const uploadedReports = finalData.filter(r => r.uploaded_report_status).length;
    const printedReports = finalData.filter(r => r.print_report_status).length;

    const paginated = finalData.slice(skip, skip + l);

    return {
      data: paginated,
      pagination: {
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l) || 1,
        stats: {
          totalRecords: total,
          emailedReports,
          uploadedReports,
          printedReports
        }
      }
    };
  }

  const baseAnd = where.AND || [];

  const [total, emailedReports, uploadedReports, printedReports, rawData] = await Promise.all([
    prisma.genomicLabRegister.count({ where }),
    prisma.genomicLabRegister.count({ where: { AND: [...baseAnd, { emailed_status: true }] } }),
    prisma.genomicLabRegister.count({ where: { AND: [...baseAnd, { uploaded_report_status: true }] } }),
    prisma.genomicLabRegister.count({ where: { AND: [...baseAnd, { print_report_status: true }] } }),
    prisma.genomicLabRegister.findMany({
      where,
      orderBy: [
        { order_date: 'desc' },
        { created_at: 'desc' }
      ],
      skip,
      take: l
    })
  ]);

  const finalData = rawData.map(formatRecordWithSite);

  return {
    data: finalData,
    pagination: {
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l) || 1,
      stats: {
        totalRecords: total,
        emailedReports,
        uploadedReports,
        printedReports
      }
    }
  };
};

export const getGenomicLabById = async (id) => {
  const record = await prisma.genomicLabRegister.findFirst({
    where: { id, deleted_at: null }
  });
  return formatRecordWithSite(record);
};

export const findExistingHinaiRecord = async (serviceOrderId, mrn, serviceCode, genomicServices) => {
  if (serviceOrderId && String(serviceOrderId).trim() !== '') {
    const byOrder = await prisma.genomicLabRegister.findFirst({
      where: { service_order_id: String(serviceOrderId).trim(), deleted_at: null }
    });
    if (byOrder) return byOrder;
  }

  if (mrn && String(mrn).trim() !== '') {
    const trimmedMrn = String(mrn).trim();
    const whereConditions = [];
    if (serviceCode && String(serviceCode).trim() !== '') {
      whereConditions.push({ service_code: String(serviceCode).trim() });
    }
    if (genomicServices && String(genomicServices).trim() !== '') {
      whereConditions.push({ genomic_services: String(genomicServices).trim() });
    }

    if (whereConditions.length > 0) {
      const byMrnAndService = await prisma.genomicLabRegister.findFirst({
        where: {
          mrn: trimmedMrn,
          deleted_at: null,
          OR: whereConditions
        }
      });
      if (byMrnAndService) return byMrnAndService;
    }
  }

  return null;
};

export const createGenomicLabRecord = async (data, userId, userName) => {
  const {
    service_order_id,
    mrn,
    patient_name,
    patient_email,
    mobile_no,
    doctor_name,
    age,
    gender,
    age_gender,
    visit_id,
    specimen,
    service_name,
    service_code,
    bed_no,
    service_center_name,
    order_date,
    order_status,
    accepted_date,
    sample_accepted_by,
    sam_accepted_by,
    sample_collected_date,
    lb_id,
    certified_by,
    sample_send_date,
    sample_send_by,
    received_items,
    block_no,
    cellularity,
    diagnosis,
    received_date,
    expected_date,
    process_status,
    zygene_number,
    genomic_services,
    emailed_status,
    emailed_date,
    uploaded_report_status,
    uploaded_report_date,
    print_report_status,
    print_report_date,
    others,
    mst_siteid
  } = data;

  const effectiveUploadedStatus = Boolean(uploaded_report_status || uploaded_report_date);
  const effectiveReceivedDate = received_date || (uploaded_report_date ? new Date(uploaded_report_date).toISOString().split('T')[0] : null);
  const effectiveProcessStatus = process_status || (effectiveUploadedStatus || effectiveReceivedDate ? 'Processed' : 'In-Progress');

  const created = await prisma.genomicLabRegister.create({
    data: {
      service_order_id: service_order_id || null,
      mrn,
      patient_name,
      patient_email: patient_email || null,
      mobile_no: mobile_no || null,
      doctor_name: doctor_name || null,
      age: age ? String(age) : null,
      gender: gender ? String(gender) : null,
      age_gender: age_gender || (age || gender ? `${age || ''} / ${gender || ''}`.trim() : null),
      visit_id: visit_id || null,
      specimen: specimen || null,
      service_name: service_name || null,
      service_code: service_code || null,
      bed_no: bed_no || null,
      service_center_name: service_center_name || null,
      order_date: order_date || null,
      order_status: order_status || null,
      accepted_date: accepted_date || null,
      sample_accepted_by: sample_accepted_by || null,
      sam_accepted_by: sam_accepted_by || null,
      sample_collected_date: sample_collected_date || null,
      lb_id: lb_id || null,
      certified_by: certified_by || null,
      sample_send_date: sample_send_date || null,
      sample_send_by: sample_send_by || null,
      received_items: received_items || null,
      block_no: block_no || null,
      cellularity: cellularity || null,
      diagnosis: diagnosis || null,
      received_date: effectiveReceivedDate,
      expected_date: expected_date || null,
      process_status: effectiveProcessStatus,
      zygene_number: zygene_number || null,
      genomic_services: genomic_services || null,
      emailed_status: Boolean(emailed_status),
      emailed_date: emailed_date ? new Date(emailed_date) : null,
      uploaded_report_status: effectiveUploadedStatus,
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
    service_order_id,
    mrn,
    patient_name,
    patient_email,
    mobile_no,
    doctor_name,
    age,
    gender,
    age_gender,
    visit_id,
    specimen,
    service_name,
    service_code,
    bed_no,
    service_center_name,
    order_date,
    order_status,
    accepted_date,
    sample_accepted_by,
    sam_accepted_by,
    sample_collected_date,
    lb_id,
    certified_by,
    sample_send_date,
    sample_send_by,
    received_items,
    block_no,
    cellularity,
    diagnosis,
    received_date,
    expected_date,
    process_status,
    zygene_number,
    genomic_services,
    emailed_status,
    emailed_date,
    uploaded_report_status,
    uploaded_report_date,
    print_report_status,
    print_report_date,
    others,
    mst_siteid
  } = data;

  const effectiveUploadedStatus = uploaded_report_status !== undefined
    ? Boolean(uploaded_report_status || uploaded_report_date)
    : undefined;

  const effectiveReceivedDate = received_date !== undefined
    ? received_date
    : (uploaded_report_date ? new Date(uploaded_report_date).toISOString().split('T')[0] : undefined);

  const effectiveProcessStatus = process_status || (
    (effectiveUploadedStatus || effectiveReceivedDate || uploaded_report_date) ? 'Processed' : 'In-Progress'
  );

  const updated = await prisma.genomicLabRegister.update({
    where: { id },
    data: {
      ...(service_order_id !== undefined && { service_order_id: service_order_id || null }),
      ...(mrn !== undefined && { mrn }),
      ...(patient_name !== undefined && { patient_name }),
      ...(patient_email !== undefined && { patient_email: patient_email || null }),
      ...(mobile_no !== undefined && { mobile_no: mobile_no || null }),
      ...(doctor_name !== undefined && { doctor_name: doctor_name || null }),
      ...(age !== undefined && { age: age ? String(age) : null }),
      ...(gender !== undefined && { gender: gender ? String(gender) : null }),
      ...(age_gender !== undefined && { age_gender }),
      ...(visit_id !== undefined && { visit_id: visit_id || null }),
      ...(specimen !== undefined && { specimen: specimen || null }),
      ...(service_name !== undefined && { service_name: service_name || null }),
      ...(service_code !== undefined && { service_code: service_code || null }),
      ...(bed_no !== undefined && { bed_no: bed_no || null }),
      ...(service_center_name !== undefined && { service_center_name: service_center_name || null }),
      ...(order_date !== undefined && { order_date: order_date || null }),
      ...(order_status !== undefined && { order_status: order_status || null }),
      ...(accepted_date !== undefined && { accepted_date: accepted_date || null }),
      ...(sample_accepted_by !== undefined && { sample_accepted_by: sample_accepted_by || null }),
      ...(sam_accepted_by !== undefined && { sam_accepted_by: sam_accepted_by || null }),
      ...(sample_collected_date !== undefined && { sample_collected_date: sample_collected_date || null }),
      ...(lb_id !== undefined && { lb_id: lb_id || null }),
      ...(certified_by !== undefined && { certified_by: certified_by || null }),
      ...(sample_send_date !== undefined && { sample_send_date: sample_send_date || null }),
      ...(sample_send_by !== undefined && { sample_send_by: sample_send_by || null }),
      ...(received_items !== undefined && { received_items: received_items || null }),
      ...(block_no !== undefined && { block_no: block_no || null }),
      ...(cellularity !== undefined && { cellularity: cellularity || null }),
      ...(diagnosis !== undefined && { diagnosis: diagnosis || null }),
      ...(effectiveReceivedDate !== undefined && { received_date: effectiveReceivedDate || null }),
      ...(expected_date !== undefined && { expected_date: expected_date || null }),
      process_status: effectiveProcessStatus,
      ...(zygene_number !== undefined && { zygene_number: zygene_number || null }),
      ...(genomic_services !== undefined && { genomic_services: genomic_services || null }),
      ...(emailed_status !== undefined && { emailed_status: Boolean(emailed_status) }),
      ...(emailed_date !== undefined && { emailed_date: emailed_date ? new Date(emailed_date) : null }),
      ...(effectiveUploadedStatus !== undefined && { uploaded_report_status: effectiveUploadedStatus }),
      ...(uploaded_report_date !== undefined && { uploaded_report_date: uploaded_report_date ? new Date(uploaded_report_date) : null }),
      ...(print_report_status !== undefined && { print_report_status: Boolean(print_report_status) }),
      ...(print_report_date !== undefined && { print_report_date: print_report_date ? new Date(print_report_date) : null }),
      ...(others !== undefined && { others: others || null }),
      ...(mst_siteid !== undefined && { mst_siteid: Number(mst_siteid) }),
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
  const where = buildWhereClause(req.query);
  const { tatFilter } = req.query;

  const raw = await prisma.genomicLabRegister.findMany({
    where,
    orderBy: [
      { order_date: 'desc' },
      { created_at: 'desc' }
    ]
  });

  let formatted = raw.map(formatRecordWithSite);
  if (tatFilter && tatFilter !== 'all' && tatFilter !== 'ALL') {
    formatted = formatted.filter(rec => calculateTatCategory(rec) === tatFilter);
  }

  return formatted;
};
