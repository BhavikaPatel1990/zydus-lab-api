const HIMS_PATIENT_SEARCH_URL = process.env.HIMS_PATIENT_SEARCH_URL || 'https://hims.zhhrpl.in/live/solr/patientsearch/select';
const HIMS_PATIENT_DETAILS_URL = process.env.HIMS_PATIENT_DETAILS_URL || 'https://hims.zhhrpl.in/live/portal/patient/details';

export const searchPatients = async (queryStr) => {
  if (!queryStr || !queryStr.trim()) return [];

  try {
    console.log(`[HIMS Service] Searching Solr with query: ${queryStr}`);
    const url = new URL(HIMS_PATIENT_SEARCH_URL);
    url.searchParams.set('wt', 'json');
    url.searchParams.set('rows', '15');
    url.searchParams.set('q', queryStr.trim());

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
    const data = await response.json();
    const docs = data?.response?.docs ?? [];

    return docs.map(doc => {
      const mrn = String(doc.mrno ?? doc.MRNO ?? doc.uhid ?? '').trim();
      const patient_name = String(doc.patient_name ?? doc.patientname ?? doc.name ?? doc.NAME ?? '').trim();
      const age = doc.age ?? doc.AGE ?? doc.pat_age ?? '';
      const gender = doc.gender ?? doc.gender_name ?? doc.GENDER ?? doc.sex ?? '';
      
      let age_gender = '';
      if (age && gender) {
        age_gender = `${age} / ${gender}`;
      } else if (age) {
        age_gender = `${age}`;
      } else if (gender) {
        age_gender = `${gender}`;
      }

      const mobile_no = String(doc.mobilenumber ?? doc.mobile_no ?? doc.mobile ?? doc.contact_no ?? '').trim();

      return {
        mrn,
        patient_name,
        age_gender,
        mobile_no
      };
    }).filter(p => p.mrn || p.patient_name);
  } catch (err) {
    console.warn('[HIMS Service] Solr search failed:', err.message);
    return [];
  }
};

export const getPatientByMrn = async (mrn) => {
  if (!mrn) return null;

  try {
    console.log(`[HIMS Service] Fetching patient details for MRN: ${mrn}`);
    const url = new URL(HIMS_PATIENT_DETAILS_URL);
    url.searchParams.set('mrno', mrn);

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
    const data = await response.json();
    const patientData = data?.data;

    if (patientData) {
      const age = patientData.age ?? patientData.patientAge ?? '';
      const gender = patientData.gender ?? patientData.gender_name ?? patientData.sex ?? '';
      let age_gender = '';
      if (age && gender) {
        age_gender = `${age} / ${gender}`;
      } else if (age) {
        age_gender = `${age}`;
      } else if (gender) {
        age_gender = `${gender}`;
      }

      return {
        mrn: String(patientData.mrn || mrn),
        patient_name: String(patientData.patientName || patientData.name || ''),
        age_gender,
        mobile_no: String(patientData.phone || patientData.mobile_no || '')
      };
    }
  } catch (err) {
    console.warn('[HIMS Service] Patient details fetch failed:', err.message);
  }
  return null;
};
