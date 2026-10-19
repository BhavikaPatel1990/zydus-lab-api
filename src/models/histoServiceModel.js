import prisma from '../config/prisma.js';

const formatServiceRecord = (record) => {
  if (!record) return null;
  let price = 0;
  if (record.price !== null && record.price !== undefined) {
    if (typeof record.price === 'number') {
      price = isNaN(record.price) ? 0 : record.price;
    } else if (typeof record.price === 'string') {
      price = parseFloat(record.price.replace(/,/g, '')) || 0;
    } else if (typeof record.price === 'object') {
      if (typeof record.price.toNumber === 'function') {
        price = record.price.toNumber();
      } else if (typeof record.price.toString === 'function') {
        price = parseFloat(record.price.toString()) || 0;
      }
    } else {
      price = Number(record.price) || 0;
    }
  }
  return {
    ...record,
    price
  };
};

export const getAllHistoServices = async (req) => {
  const { page = 1, limit = 10, search = "", status } = req.query;

  let where = {
    deleted_at: null,
  };

  if (status === 'true' || status === '1') {
    where.status = true;
  } else if (status === 'false' || status === '0') {
    where.status = false;
  }

  if (search && search.trim() !== "") {
    const trimmed = search.trim();
    where.OR = [
      { service_name: { contains: trimmed, mode: "insensitive" } },
      { service_code: { contains: trimmed, mode: "insensitive" } },
      { sample: { contains: trimmed, mode: "insensitive" } },
      { tat_time: { contains: trimmed, mode: "insensitive" } },
    ];
  }

  const p = Math.max(1, parseInt(page));
  const l = Math.max(1, parseInt(limit));
  const skip = (p - 1) * l;

  const [total, rawData] = await Promise.all([
    prisma.histoServiceMaster.count({ where }),
    prisma.histoServiceMaster.findMany({
      where,
      skip,
      take: l,
      orderBy: { created_at: "asc" }
    })
  ]);

  const data = rawData.map(formatServiceRecord);

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

export const getHistoServiceById = async (id) => {
  const record = await prisma.histoServiceMaster.findFirst({
    where: { id, deleted_at: null }
  });
  return formatServiceRecord(record);
};

export const createHistoService = async (data, userId, userName) => {
  const {
    service_name,
    service_code,
    price,
    sample,
    tat_time,
    status,
    mst_siteid
  } = data;

  const record = await prisma.histoServiceMaster.create({
    data: {
      service_name,
      service_code,
      price: price ? Number(price) : 0.00,
      sample: sample || 'INHOUSE',
      tat_time: tat_time || '72 Hours',
      status: status !== undefined ? Boolean(status) : true,
      mst_siteid: mst_siteid ? Number(mst_siteid) : 1,
      created_by: userId || null,
      created_by_name: userName || 'Portal User'
    }
  });

  return formatServiceRecord(record);
};

export const updateHistoService = async (id, data, userId, userName) => {
  const {
    service_name,
    service_code,
    price,
    sample,
    tat_time,
    status,
    mst_siteid
  } = data;

  const record = await prisma.histoServiceMaster.update({
    where: { id },
    data: {
      ...(service_name !== undefined && { service_name }),
      ...(service_code !== undefined && { service_code }),
      ...(price !== undefined && { price: Number(price) }),
      ...(sample !== undefined && { sample }),
      ...(tat_time !== undefined && { tat_time }),
      ...(status !== undefined && { status: Boolean(status) }),
      ...(mst_siteid !== undefined && { mst_siteid: Number(mst_siteid) }),
      updated_by: userId || null,
      updated_by_name: userName || 'Portal User'
    }
  });

  return formatServiceRecord(record);
};

export const deleteHistoService = async (id, userId, userName) => {
  const record = await prisma.histoServiceMaster.update({
    where: { id },
    data: {
      deleted_at: new Date(),
      deleted_by: userId || null,
      deleted_by_name: userName || 'Portal User'
    }
  });

  return formatServiceRecord(record);
};
