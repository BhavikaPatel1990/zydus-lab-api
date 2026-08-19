/**
 * HINAI Oracle SQL Queries for Genomic Lab Module
 */

export const getGenomicLabHinaiQuery = (serviceCodes = [], daysBack = 30) => {
  let serviceCodeFilter = "AND 1=0";
  
  if (Array.isArray(serviceCodes) && serviceCodes.length > 0) {
    const formattedCodes = serviceCodes.map(code => `'${String(code).trim().replace(/'/g, "''")}'`).join(', ');
    serviceCodeFilter = `AND sm.service_code IN (${formattedCodes})`;
  }

  const days = Math.max(1, parseInt(daysBack, 10) || 30);

  return `
    SELECT DISTINCT
        s.id AS SERVICE_ORDER_ID,
        p.mrno AS MRNO,
        p.email AS PATIENT_EMAIL,
        p.mobileno AS MOBILENO,
        p.age AS AGE,
        p.genderid AS GENDER_ID,
        o.site_id AS SITE_ID,
        p.patientname AS PATIENTNAME,
        SUBSTR(v.patient_visit_id, 0, 2) AS VISIT_ID,
        pm.prefix || ' ' || e.employee_name AS DOCTOR,
        NULL AS SPECIMEN,
        sm.service_name AS SERVICE_NAME,
        sm.service_code AS SERVICE_CODE,
        bed.bed_no AS BED_NO,
        sc.service_center_name AS SERVICE_CENTER_NAME,
        TO_CHAR(o.order_confirmed_date, 'yyyy-mm-dd hh24:mi') AS ORDERDATE,
        s.order_status AS ORDER_STATUS,
        TO_CHAR(lob.sampleaccepted_date, 'yyyy-mm-dd hh24:mi') AS ACCEPTED_DATE,
        lob.sampleacceptedby AS SAMPLEACCEPTEDBY,
        ee.employee_name AS CERTIFY_BY,
        TO_CHAR(lb.certified_date, 'yyyy-mm-dd hh24:mi') AS CERTIFIED_DATE,
        lob.samplecollected_date AS SAMPLECOLLECTED_DATE,
        lob.sample_id AS LBID,
        TO_CHAR(lob.samplesend_date, 'yyyy-mm-dd hh24:mi') AS SAMPLESEND_DATE,
        lob.samplesendby AS SAMPLESENDBY,
        sm.service_name AS GENOMIC_SERVICES,
        TO_CHAR(labrlt.createddatetime, 'yyyy-mm-dd hh24:mi') AS UPLOADED_DATE
    FROM laborder lob
    LEFT JOIN serviceorder s ON s.id = lob.service_order_id
    LEFT JOIN orders o ON o.order_id = s.orders_id
    LEFT JOIN servicemaster sm ON sm.service_master_id = s.service_id
    LEFT JOIN patient p ON p.patient_id = o.patient_id
    LEFT JOIN visit v ON v.visitid = o.visit_id
    LEFT JOIN INPATIENTS inpatient ON inpatient.visitid = v.visitid
    LEFT JOIN employee e ON e.employee_id = s.consultantid
    LEFT JOIN prefix_master pm ON pm.id = e.emp_prefix
    LEFT JOIN BED bed ON bed.BED_ID = inpatient.BED
    LEFT JOIN servicecenter sc ON sc.service_center_id = bed.servicecenter
    LEFT JOIN labservicemaster lsm ON lsm.service_id = sm.service_master_id
    LEFT JOIN labservice_specimen_map lsmm ON lsmm.lab_service_id = lsm.lab_service_id
    LEFT JOIN hisuser hu ON lob.sampleacceptedby = hu.id
    LEFT JOIN labresult lb ON s.id = lb.service_order_id
    LEFT JOIN labresult_upload labrlt ON lb.lab_result_id = labrlt.labresultid
    LEFT JOIN employee ee ON ee.employee_id = lb.certifiedempid
    WHERE (
        lob.sampleaccepted_date >= TRUNC(SYSDATE) - ${days}
        OR labrlt.createddatetime >= TRUNC(SYSDATE) - ${days}
        OR lb.certified_date >= TRUNC(SYSDATE) - ${days}
        OR o.order_confirmed_date >= TRUNC(SYSDATE) - ${days}
    )
    ${serviceCodeFilter}
    ORDER BY lob.sample_id DESC
  `;
};
