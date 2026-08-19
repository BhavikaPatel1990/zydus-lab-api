/**
 * HINAI Oracle SQL Queries Template for Future Micro Lab Module
 */

export const getMicroLabHinaiQuery = (serviceCodes = []) => {
  let serviceCodeFilter = "AND 1=0";
  
  if (Array.isArray(serviceCodes) && serviceCodes.length > 0) {
    const formattedCodes = serviceCodes.map(code => `'${String(code).trim().replace(/'/g, "''")}'`).join(', ');
    serviceCodeFilter = `AND sm.service_code IN (${formattedCodes})`;
  }

  return `
    SELECT DISTINCT
        s.id AS SERVICE_ORDER_ID,
        p.mrno AS MRNO,
        p.patientname AS PATIENTNAME,
        sm.service_name AS SERVICE_NAME,
        sm.service_code AS SERVICE_CODE,
        TO_CHAR(lob.sampleaccepted_date, 'yyyy-mm-dd hh24:mi') AS ACCEPTED_DATE
    FROM laborder lob
    LEFT JOIN serviceorder s ON s.id = lob.service_order_id
    LEFT JOIN orders o ON o.order_id = s.orders_id
    LEFT JOIN servicemaster sm ON sm.service_master_id = s.service_id
    LEFT JOIN patient p ON p.patient_id = o.patient_id
    WHERE
        lob.sampleaccepted_date >= TRUNC(SYSDATE) - 7
        AND lob.sampleaccepted_date < TRUNC(SYSDATE) + 1
        ${serviceCodeFilter}
    ORDER BY lob.sample_id DESC
  `;
};
