import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import { getJobPostings } from "../services/jobService";
import '../styles/BrowseJobsPage.css';
import { CalendarColoredIcon, ApplicantCheckboxIcon, BasiconsInfoIcon, BasiconsFolderIcon, BasiconsDocumentIcon, BasiconsBriefcaseIcon } from "../components/icons/CustomIcons";
import calendarLogo from '../assets/icon-calendar.png'

import calendarminimalLogo from '../assets/calendar-minimal-icon.png';
import Loader from '../components/Loader';
;
// =========================
// PYTHON API URL
// =========================
const API_URL = "http://127.0.0.1:8000";

export default function BrowseJobsPage() {
  const [applicantProfile, setApplicantProfile] = useState(null);
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("All");
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobDetailsModal, setShowJobDetailsModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applicant, setApplicant] = useState(null);
  const [appliedJobs, setAppliedJobs] = useState({});
  const [screeningResult, setScreeningResult] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successData, setSuccessData] = useState(null);
  
  const [application, setApplication] = useState({
    coverLetter: "",
    documents: {}
  });

  // =========================
  // EDUCATION & ELIGIBILITY LABELS
  // =========================
  const EDUCATION_LABELS = {
    0: "None Required",
    1: "Elementary Graduate",
    2: "High School Graduate",
    3: "2-Year College / Associate",
    4: "Bachelor's Degree",
    5: "Master's Degree"
  };

  const ELIGIBILITY_LABELS = {
    "none": "None Required",
    "subprofessional": "Career Service Subprofessional",
    "professional": "Career Service Professional"
  };

  const getEducationLabel = (value) => {
    if (value === undefined || value === null) return 'None Required';
    return EDUCATION_LABELS[value] || `Level ${value}`;
  };

  const getEligibilityLabel = (value) => {
    if (!value || value === 'none') return 'None Required';
    return ELIGIBILITY_LABELS[value] || value;
  };

  const getExperienceLabel = (value) => {
    if (!value || value === 0 || value === 'None Required') return 'None Required';
    const years = parseInt(value) || 0;
    if (years === 0) return 'None Required';
    return years === 1 ? `${years} year` : `${years} years`;
  };

  const getTrainingLabel = (value) => {
    if (!value || value === 'None Required' || value === 0) return 'None Required';
    const hours = parseInt(value) || 0;
    if (hours === 0) return 'None Required';
    return hours === 1 ? `${hours} hour` : `${hours} hours`;
  };

 // ─── EFFECT #1: Get applicant + load profile docs ───
useEffect(() => {
  const getApplicant = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setApplicant(user);
      await loadAppliedJobs(user.id);
      
      // Load profile docs
      const { data: profile } = await supabase
        .from('applicants')
        .select('pds_file_url, tor_file_url, performance_rating_file_url, application_letter_file_url, parsed_pds_raw')
        .eq('id', user.id)
        .maybeSingle();
      
      setApplicantProfile(profile || null);
    } else {
      navigate('/login');
    }
  };
  getApplicant();
}, [navigate]);



// ─── EFFECT #2: Load jobs 
  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    const result = await getJobPostings();
    if (result.success) {
      setJobs(result.data);
    }
    setLoading(false);
  };

  const loadAppliedJobs = async (applicantId) => {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('job_id, status')
        .eq('applicant_id', applicantId)
        .neq('status', 'WITHDRAWN');
      
      if (error) {
        console.error('Error loading applied jobs:', error);
        return;
      }
      
      if (data) {
        const appliedMap = {};
        data.forEach(app => {
          appliedMap[app.job_id] = true;
        });
        setAppliedJobs(appliedMap);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // =========================
  // DETECT JOB CATEGORY
  // =========================
  const detectJobCategory = (positionTitle) => {
  const title = (positionTitle || '').toLowerCase();

  if (/\b(it|information technology|developer|tech support)\b/.test(title)) return 'it';
  if (/\bengineer\b/.test(title)) return 'engineering';
  if (/\b(account|accounting|budget|finance|cashier|treasury)\b/.test(title)) return 'finance';
  if (/\b(building inspector|construction|foreman|inspector)\b/.test(title)) return 'construction';
  if (/\b(mechanic|technician|technical|automotive)\b/.test(title)) return 'technical';
  if (/\b(agriculture|veterinary|veterinarian|slaughterhouse|agriculturist)\b/.test(title)) return 'agriculture';
  if (/\b(sports|recreation)\b/.test(title)) return 'sports';
  if (/\b(planning|development officer|urban planner)\b/.test(title)) return 'planning';
  if (/\b(social worker|community affairs|social welfare)\b/.test(title)) return 'social_services';
  if (/\b(information officer|media|communication|journalism)\b/.test(title)) return 'communications';
  if (/\b(administrative|admin|clerk|secretary|office staff|administrative aide|administrative officer)\b/.test(title)) return 'administrative';

  return 'administrative';
};

  // =========================
  // SCREEN PDS WITH PYTHON API
  // =========================
  const screenPDSWithAPI = async (pdsFile, job, applicationId = null) => {
    let educationValue = job.qualifications?.education || 3;
    let experienceValue = job.qualifications?.workExperience || 1;
    let trainingValue = job.qualifications?.training || 4;
    const eligibilityValue = job.qualifications?.eligibility || "professional";

    if (educationValue === "None Required" || educationValue === "" || educationValue === null) {
      educationValue = 0;
    } else {
      educationValue = parseInt(educationValue) || 0;
    }

    if (experienceValue === "None Required" || experienceValue === "" || experienceValue === null) {
      experienceValue = 0;
    } else {
      experienceValue = parseInt(experienceValue) || 0;
    }

    if (trainingValue === "None Required" || trainingValue === "" || trainingValue === null) {
      trainingValue = 0;
    } else {
      trainingValue = parseInt(trainingValue) || 0;
    }

    const formData = new FormData();
    formData.append('file', pdsFile);

        const params = new URLSearchParams({
      position_title: job.position_title || "Position",
      job_category: detectJobCategory(job.position_title),
      education: educationValue,
      experience: experienceValue,
      training_hours: trainingValue,
      eligibility_level: eligibilityValue,
    });
    if (applicationId) {
      params.append('application_id', applicationId);
    }

    console.log('📤 Sending to API:', {
      url: `${API_URL}/upload-pds?${params}`,
      education: educationValue,
      experience: experienceValue,
      training_hours: trainingValue,
      eligibility_level: eligibilityValue
    });

    try {
      const response = await fetch(`${API_URL}/upload-pds?${params}`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      console.log('📥 API Response:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error screening PDS:', error);
      throw error;
    }
  };

  const handleViewDetails = (job) => {
    setSelectedJob(job);
    setScreeningResult(null);
    setShowResults(false);
    setShowSuccessPopup(false);
    
    const requiredDocs = job.required_docs || {};
    const initialDocs = {};
    
    // Always include PDS
    initialDocs.pds = null;
    
    // Check each required document type
    if (requiredDocs.transcriptRecords) initialDocs.transcript = null;
    if (requiredDocs.performanceRating) initialDocs.performanceRating = null;
    if (requiredDocs.applicationLetter) initialDocs.applicationLetter = null;

    
    setApplication({
      coverLetter: "",
      documents: initialDocs
    });
    setShowJobDetailsModal(true);
  };

  const handleFileChange = (e, docType) => {
    const file = e.target.files[0];
    if (file) {
      setApplication({
        ...application,
        documents: {
          ...application.documents,
          [docType]: file
        }
      });
    }
  };

  const handleRemoveFile = (docType) => {
    setApplication({
      ...application,
      documents: {
        ...application.documents,
        [docType]: null
      }
    });
  };

  // =============================================
  // UPLOAD FILE - RETURNS BOTH URL AND FILENAME
  // =============================================
  const uploadFile = async (file, folder, docType) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${docType}_${Date.now()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;
    
    const { error } = await supabase.storage
      .from('applicant_docs')
      .upload(filePath, file);
    
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from('applicant_docs')
      .getPublicUrl(filePath);
    
    return { publicUrl, fileName };
  };

  const getOrCreateApplicant = async (user) => {
    const { data: existing } = await supabase
      .from('applicants')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (existing) return existing;
    
    const { data: newApplicant, error } = await supabase
      .from('applicants')
      .insert([{
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email,
        email: user.email,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) throw error;
    return newApplicant;
  };

  // =========================
  // HANDLE SUBMIT APPLICATION WITH API INTEGRATION
  // =========================
  // =========================
const handleSubmitApplication = async () => {
  if (!applicant) {
    alert("Please login to apply");
    return;
  }

  setSubmitting(true);

  try {
    // ═══ FAST SYNC CHECK (only what MUST be validated before popup) ═══
    const { data: profileDocs } = await supabase
      .from('applicants')
         .select(`pds_file_url, tor_file_url, performance_rating_file_url, application_letter_file_url`)
      .eq('id', applicant.id)
      .maybeSingle();

    const hasPds = !!profileDocs?.pds_file_url || !!application.documents?.pds;
    if (!hasPds) {
      const confirmed = window.confirm(
        `You need a Personal Data Sheet (PDS) to apply. Go to your Profile to upload one?`
      );
      if (confirmed) {
        setShowJobDetailsModal(false);
        navigate('/applicant/profile');
      }
      setSubmitting(false);
      return;
    }

    // ═══ POPUP APPEARS NOW — ~400ms after click ═══
    setSuccessData({ positionTitle: selectedJob.position_title });
    setShowSuccessPopup(true);
    setShowJobDetailsModal(false);
    setScreeningResult(null);
    setShowResults(false);
    setSubmitting(false);

    // ═══ BACKGROUND WORK — user never sees this ═══
    processApplicationInBackground(selectedJob, applicant, application, profileDocs);

  } catch (error) {
    console.error("Error submitting application:", error);
    alert("Error submitting application: " + error.message);
    setSubmitting(false);
  }
};

const processApplicationInBackground = async (job, user, application, profileDocs) => {
  try {
    console.log('🚀 Background processing started');

    // Check already applied
    const { data: existingApp, error: checkError } = await supabase
      .from('applications')
      .select('id, status')
      .eq('job_id', job.id)
      .eq('applicant_id', user.id)
      .maybeSingle();

    if (checkError) throw checkError;

    if (existingApp && existingApp.status !== 'WITHDRAWN') {
      console.warn('Already applied — aborting');
      return;
    }

    // Resolve PDS file
    let pdsBlob;
    if (application.documents.pds) {
      pdsBlob = application.documents.pds;
    } else {
      const pdsResponse = await fetch(profileDocs.pds_file_url);
      const blob = await pdsResponse.blob();
      const ext = profileDocs.pds_file_url.split('.').pop().split('?')[0];
      pdsBlob = new File([blob], `pds.${ext}`, { type: blob.type });
    }

    // Get or create applicant
    const applicantRecord = await getOrCreateApplicant(user);

    // Upload docs in parallel
    const docFileNames = {};
    const pdsUploadPromise = (async () => {
      if (application.documents.pds) {
        const r = await uploadFile(application.documents.pds, `${job.id}/${user.id}`, 'pds');
        return r.fileName;
      } else if (profileDocs.pds_file_url) {
        try {
          const res = await fetch(profileDocs.pds_file_url);
          const blob = await res.blob();
          const ext = profileDocs.pds_file_url.split('.').pop().split('?')[0];
          const file = new File([blob], `pds.${ext}`, { type: blob.type });
          const r = await uploadFile(file, `${job.id}/${user.id}`, 'pds');
          return r.fileName;
        } catch { return profileDocs.pds_file_url; }
      }
      return null;
    })();

    const transcriptUploadPromise = (async () => {
      if (application.documents.transcript) {
        const r = await uploadFile(application.documents.transcript, `${job.id}/${user.id}`, 'transcript');
        return r.fileName;
      } else if (profileDocs.tor_file_url) {
        try {
          const res = await fetch(profileDocs.tor_file_url);
          const blob = await res.blob();
          const ext = profileDocs.tor_file_url.split('.').pop().split('?')[0];
          const file = new File([blob], `transcript.${ext}`, { type: blob.type });
          const r = await uploadFile(file, `${job.id}/${user.id}`, 'transcript');
          return r.fileName;
        } catch { return profileDocs.tor_file_url; }
      }
      return null;
    })();

    const prUploadPromise = (async () => {
      if (application.documents.performanceRating) {
        const r = await uploadFile(application.documents.performanceRating, `${job.id}/${user.id}`, 'performanceRating');
        return r.fileName;
      } else if (profileDocs.performance_rating_file_url) {
        try {
          const res = await fetch(profileDocs.performance_rating_file_url);
          const blob = await res.blob();
          const ext = profileDocs.performance_rating_file_url.split('.').pop().split('?')[0];
          const file = new File([blob], `performanceRating.${ext}`, { type: blob.type });
          const r = await uploadFile(file, `${job.id}/${user.id}`, 'performanceRating');
          return r.fileName;
        } catch { return profileDocs.performance_rating_file_url; }
      }
      return null;
    })();

        const letterUploadPromise = (async () => {
      if (application.documents.applicationLetter) {
        const r = await uploadFile(application.documents.applicationLetter, `${job.id}/${user.id}`, 'applicationLetter');
        return r.fileName;
      } else if (profileDocs.application_letter_file_url) {
        try {
          const res = await fetch(profileDocs.application_letter_file_url);
          const blob = await res.blob();
          const ext = profileDocs.application_letter_file_url.split('.').pop().split('?')[0];
          const file = new File([blob], `applicationLetter.${ext}`, { type: blob.type });
          const r = await uploadFile(file, `${job.id}/${user.id}`, 'applicationLetter');
          return r.fileName;
        } catch { return profileDocs.application_letter_file_url; }
      }
      return null;
    })();

    const [pdsName, transcriptName, prName, letterName] = await Promise.all([
      pdsUploadPromise, transcriptUploadPromise, prUploadPromise, letterUploadPromise,
    ]);
    if (pdsName) docFileNames.pds = pdsName;
    if (transcriptName) docFileNames.transcript = transcriptName;
    if (prName) docFileNames.performanceRating = prName;
    if (letterName) docFileNames.applicationLetter = letterName;

        const docsSubmitted = {
      pds: true,
      transcript: !!(application.documents.transcript || profileDocs.tor_file_url),
      performanceRating: !!(application.documents.performanceRating || profileDocs.performance_rating_file_url),
      applicationLetter: !!(application.documents.applicationLetter || profileDocs.application_letter_file_url),
    };

    // Save application
    const applicationData = {
      status: 'PENDING',
      screening_status: 'PROCESSING',
      docs_submitted: docsSubmitted,
      doc_filenames: docFileNames,
      applied_date: new Date().toISOString(),
      ai_match_score: null,
      ai_explanation: null,
    };

    let savedAppId;
    if (existingApp && existingApp.status === 'WITHDRAWN') {
      const { data, error } = await supabase
        .from('applications')
        .update({ ...applicationData, updated_at: new Date().toISOString() })
        .eq('id', existingApp.id)
        .select('id')
        .single();
      if (error) throw error;
      savedAppId = data.id;
    } else {
      const { data, error } = await supabase
        .from('applications')
        .insert([{ job_id: job.id, applicant_id: applicantRecord.id, ...applicationData }])
        .select('id')
        .single();
      if (error) throw error;
      savedAppId = data.id;
    }

    // Update count + reload applied in parallel
    await Promise.all([
      (async () => {
        const { data: currentJob } = await supabase
          .from('job_postings')
          .select('applicants_count')
          .eq('id', job.id)
          .single();
        const newCount = (currentJob?.applicants_count || 0) + 1;
        await supabase.from('job_postings').update({ applicants_count: newCount }).eq('id', job.id);
      })(),
      loadAppliedJobs(user.id),
    ]);

    console.log('✅ Background processing complete. savedAppId=' + savedAppId);

    // Fire Python screening — fire and forget
    screenInBackground(savedAppId, pdsBlob, job);

  } catch (error) {
    console.error('❌ Background processing failed:', error);
    alert(`There was an issue saving your application: ${error.message}. Please try applying again.`);
  }
};

const screenInBackground = async (applicationId, pdsBlob, job) => {
  try {
    const screeningResult = await screenPDSWithAPI(pdsBlob, job, applicationId);
    // Python now writes the score to Supabase itself (screening_status='COMPLETED').
    // This fetch just triggers the Python work — no client-side Supabase write needed.
    console.log('✅ Background screening completed for application', applicationId);
  } catch (err) {
    console.error('❌ Background screening failed for application', applicationId, err);
    // Python-side except already marks FAILED, but mark here as fallback
    // if the request never reached Python (e.g. network error)
    try {
      await supabase
        .from('applications')
        .update({ screening_status: 'FAILED' })
        .eq('id', applicationId);
    } catch (e) {
      console.error('Failed to mark application as FAILED:', e);
    }
  }
};

  const locations = [...new Set(jobs.map(job => job.place_of_assignment))];
  
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.position_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          job.place_of_assignment?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation = selectedLocation === "All" || job.place_of_assignment === selectedLocation;
    return matchesSearch && matchesLocation;
  });

  // =========================
  // RENDER RESULTS (for screening results)
  // =========================
  const renderResults = () => {
    if (!screeningResult) return null;
    
    const { fit_analysis, explanation } = screeningResult;
    const breakdown = fit_analysis?.breakdown || {};
    const score = fit_analysis?.percentage || 0;
    const requirementsMet = fit_analysis?.requirements_met || '0/0';
    
    return (
      <div className="result-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <div className="score">{score}%</div>
            <div style={{ fontSize: '14px', color: '#6c757d' }}>AI Match Score</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', color: '#6c757d' }}>Requirements Met</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{requirementsMet}</div>
          </div>
        </div>
        
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontWeight: 600, marginBottom: '8px' }}>📊 Breakdown</div>
          {Object.entries(breakdown).map(([key, value]) => {
            const status = value.status || '';
            const isMet = status.includes('MET') || status.includes('EXCEEDS');
            return (
              <div key={key} className="breakdown-item">
                <span>{key}</span>
                <span className={isMet ? 'status-met' : 'status-not-met'}>
                  {isMet ? '✅' : '❌'} {status}
                </span>
              </div>
            );
          })}
        </div>
        
        {explanation?.recommendations && explanation.recommendations.length > 0 && (
          <div className="recommendations">
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>💡 Recommendations</div>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {explanation.recommendations.map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div style={{ marginTop: '12px', fontSize: '13px', color: '#6c757d' }}>
          {explanation?.summary || ''}
        </div>
      </div>
    );
  };

  // =========================
  // RENDER RESULTS (for already applied modal)
  // =========================
  const renderAlreadyAppliedSummary = () => {
    return (
      <div className="already-applied-banner">
       <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <BasiconsInfoIcon size={18} color="#92400e" />
    You have already applied to this position.
  </div>
        <div className="sub-text">
          You can view your full application details below.
        </div>
      </div>
    );
  };

  // =========================
  // SUCCESS POPUP
  // =========================

const SuccessPopup = () => {
  if (!showSuccessPopup || !successData) return null;

  const { positionTitle } = successData;

  return (
    <div
      className="success-popup-overlay"
      onClick={() => setShowSuccessPopup(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="success-popup"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '400px',
          background: '#FFFFFF',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
          boxSizing: 'border-box',
        }}
      >

        {/* Icon */}
        <div style={{
          width: '58px',
          height: '58px',
          margin: '0 auto 20px',
          borderRadius: '16px',
          background: '#EEF2FF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <BasiconsDocumentIcon size={27} color="#4F46E5" />
        </div>

        {/* Heading */}
        <h2 style={{
          margin: '0 0 10px',
          fontSize: '21px',
          fontWeight: 700,
          color: '#1E293B',
          textAlign: 'center',
        }}>
          Application Submitted!
        </h2>

        {/* Description */}
        <p style={{
          margin: '0 0 22px',
          fontSize: '14px',
          lineHeight: 1.6,
          color: '#64748B',
          textAlign: 'center',
        }}>
          Your application for{' '}
          <strong style={{ color: '#334155' }}>"{positionTitle}"</strong>{' '}
          has been received successfully.
        </p>

        {/* Processing Notice */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '13px',
          marginBottom: '22px',
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: '10px',
        }}>
          <p style={{
            margin: 0,
            fontSize: '12px',
            color: '#92400E',
            lineHeight: 1.5,
          }}>
            <strong>Processing.</strong>{' '}
            Your match score will be available in My Applications shortly.
          </p>
        </div>

        {/* Buttons */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '9px',
        }}>
         <button
  className="primary-btn-popup"
  onClick={() => {
    setShowSuccessPopup(false);
    navigate('/applicant/applications', {
      state: { expectNewApplication: true },
    });
  }}
  style={{
    width: '100%',
    padding: '12px',
    border: 'none',
    borderRadius: '8px',
    background: '#4F46E5',
    color: '#FFFFFF',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.2s ease',
  }}
>
  View My Applications
</button>

         <button
  className="secondary-btn-popup"
  onClick={() => setShowSuccessPopup(false)}
  style={{
    width: '100%',
    padding: '11px',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    background: '#e7edf3',
    color: '#475569',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.2s ease, border-color 0.2s ease',
  }}
>
  Close
</button>
        </div>

        {/* Hover + focus states */}
        <style>{`
  .success-popup .primary-btn-popup:hover {
    background: #4338CA !important;
  }
  .success-popup .primary-btn-popup:active {
    background: #3730A3 !important;
  }
  .success-popup .primary-btn-popup:focus-visible {
    outline: 2px solid #4F46E5;
    outline-offset: 2px;
  }
  .success-popup .secondary-btn-popup:hover {
    background: #E2E8F0 !important;
    border-color: #CBD5E1 !important;
    color: #334155 !important;
  }
  .success-popup .secondary-btn-popup:active {
    background: #CBD5E1 !important;
  }
  .success-popup .secondary-btn-popup:focus-visible {
    outline: 2px solid #94A3B8;
    outline-offset: 2px;
  }
`}</style>

      </div>
    </div>
  );
};


  const FileUploadField = ({ label, docType, jobRequires }) => {
    if (!jobRequires && docType !== 'pds') return null;
    
    const hasFile = application.documents[docType] !== null && application.documents[docType] !== undefined;
    
    return (
      <div className="form-group">
        <label>{label}</label>
        <div className="file-upload-container">
          {!hasFile ? (
            <div className="file-upload-box">
              <input
                id={`file-${docType}`}
                type="file"
                className="file-input-hidden"
                accept=".pdf,.xlsx,.xls,.docx"
                onChange={(e) => handleFileChange(e, docType)}
                disabled={appliedJobs[selectedJob?.id]}
              />
              <label htmlFor={`file-${docType}`} className="file-upload-label">
                📁 Choose File
              </label>
              <span className="file-name-placeholder">No file chosen</span>
            </div>
          ) : (
            <div className="file-uploaded-box">
              <span className="file-icon">📄</span>
              <span className="file-uploaded-name">{application.documents[docType].name}</span>
              <button 
                type="button" 
                className="file-remove-btn"
                onClick={() => handleRemoveFile(docType)}
                disabled={appliedJobs[selectedJob?.id]}
              >
                ✗ Remove
              </button>
            </div>
          )}
        </div>
        {docType === 'pds' && (
          <small>Upload your PDS (Excel or Word format). Accepted: .xlsx, .xls, .docx</small>
        )}
      </div>
    );
  };

  return (
    <>
      <Navbar userRole="applicant" />
      
      <div className="browse-container">
        <div className="page-header">
          <h1>Browse Job Vacancies</h1>
          <p>Find your next career opportunity in government service</p>
        </div>

        <div className="search-section">
          <input
            type="text"
            className="search-input"
            placeholder="Search by position title or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select 
            className="filter-select"
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
          >
            <option value="All">All Locations</option>
            {locations.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>

        <div className="jobs-grid" style={{ position: 'relative' }}>
          {loading ? (
            <div className="loading-state"><Loader/> </div>
             
          ) : filteredJobs.length === 0 ? (
            <div className="empty-state">No job vacancies found</div>
          ) : (
            filteredJobs.map((job) => (
              <div key={job.id} className="job-card">
                <h3 className="job-title">{job.position_title}</h3>
                <div className="job-assignment">{job.place_of_assignment}</div>
                <div className="job-details">
                  <span className="job-detail-item">SG {job.salary_grade}</span>
                  <span className="job-detail-item">₱{job.monthly_salary?.toLocaleString()}</span>
                  <span className="job-detail-item">Item No: {job.item_no}</span>
                </div>
                <div className="job-deadline">
                  <img src={calendarminimalLogo} alt="calendar" className="calendar-blue-icon" /> Closing Date: {job.closing_date}
                </div>
                <div className="button-group">
                  <button 
                    className="view-details-btn" 
                    onClick={() => handleViewDetails(job)}
                  >
                    View Details
                  </button>
                  {appliedJobs[job.id] && (
                    <span className="applied-badge-btn"><ApplicantCheckboxIcon size={18} /> Applied</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Success Popup */}
      <SuccessPopup />

      {showJobDetailsModal && selectedJob && (
        <div className="modal-overlay" onClick={() => setShowJobDetailsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
             {/* ── NEW HEADER ── */}
      <div className="modal-header" style={{
        background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
        borderBottom: '1px solid #bfdbfe',
        borderRadius: '16px 16px 0 0',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px', background: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(37,99,235,0.12)', flexShrink: 0
          }}>
            <span style={{ fontSize: '18px' }}><BasiconsBriefcaseIcon size={20} color="#4F46E5" /></span>
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#1a3a5c', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '2px' }}>
              Job Details
            </div>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#1a1f36', fontWeight: 700 }}>
              {selectedJob.position_title}
            </h2>
          </div>
        </div>
        <button className="close-modal" onClick={() => setShowJobDetailsModal(false)}>×</button>
      </div>

      <div className="modal-body">

        {/* ── JOB DETAILS ── */}
        <div style={{ background: '#f8fafc', border: '1px solid #e8ebf5', borderRadius: '12px', padding: '18px 20px', marginBottom: '16px' }}>
          <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#1a3a5c', letterSpacing: '0.8px', textTransform: 'uppercase', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#4F46E5' }}>■</span> Job Details
          </h4>
          <div className="detail-grid">
            <div>
              <span className="detail-label">Place of Assignment</span>
              <span className="detail-value">{selectedJob.place_of_assignment}</span>
            </div>
            <div>
              <span className="detail-label">Item No.</span>
              <span className="detail-value">{selectedJob.item_no}</span>
            </div>
            <div>
              <span className="detail-label">Salary Grade</span>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#eef2ff', borderRadius: '6px', fontWeight: 700, color: '#1a3a5c' }}>
                {selectedJob.salary_grade}
              </span>
            </div>
            <div>
              <span className="detail-label">Monthly Salary</span>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#eef2ff', borderRadius: '6px', fontWeight: 700, color: '#1a3a5c' }}>
                ₱{selectedJob.monthly_salary?.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="detail-label">Opening Date</span>
              <span className="detail-value">{selectedJob.opening_date}</span>
            </div>
            <div>
              <span className="detail-label">Closing Date</span>
              <span className="detail-value">{selectedJob.closing_date}</span>
            </div>
          </div>
        </div>

        {/* ── QUALIFICATIONS ── */}
        <div style={{ background: '#f8fafc', border: '1px solid #e8ebf5', borderRadius: '12px', padding: '18px 20px', marginBottom: '16px' }}>
          <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#1a3a5c', letterSpacing: '0.8px', textTransform: 'uppercase', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#0d9488' }}>■</span> Qualifications
          </h4>
          <div className="detail-grid">
            <div>
              <span className="detail-label">Education</span>
              <span className="detail-value">{getEducationLabel(selectedJob.qualifications?.education)}</span>
            </div>
            <div>
              <span className="detail-label">Eligibility</span>
              <span className="detail-value">{getEligibilityLabel(selectedJob.qualifications?.eligibility)}</span>
            </div>
            <div>
              <span className="detail-label">Training</span>
              <span className="detail-value">{getTrainingLabel(selectedJob.qualifications?.training)}</span>
            </div>
            <div>
              <span className="detail-label">Work Experience</span>
              <span className="detail-value">{getExperienceLabel(selectedJob.qualifications?.workExperience)}</span>
            </div>
          </div>
        </div>

      {/* ── REQUIRED DOCUMENTS ── */}
<div style={{ 
  background: '#f8fafc', 
  border: '1px solid #e8ebf5', 
  borderRadius: '12px', 
  padding: '18px 20px', 
  marginBottom: '16px' 
}}>
  <h4 style={{ 
    fontSize: '12px', 
    fontWeight: 700, 
    color: '#1a3a5c', 
    letterSpacing: '0.8px', 
    textTransform: 'uppercase', 
    margin: '0 0 14px 0', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '10px' // Increased gap slightly for the dot
  }}>
    {/* ✅ The glowing dot replacing the square */}
    <span style={{ 
      width: '8px', 
      height: '8px', 
      borderRadius: '50%', 
      background: '#f59e0b', // The solid orange color
      boxShadow: '0 0 0 3px rgba(245, 158, 11, 0.15)', // The soft outer glow
      flexShrink: 0 
    }} /> 
    Required Documents
  </h4>
  
  <ul style={{ 
    paddingLeft: '0', // Removed default padding
    margin: 0, 
    fontSize: '13px', 
    color: '#1a1f36', 
    lineHeight: 1.6,
    listStyleType: 'none', // Removed default bullets
    display: 'flex',
    flexDirection: 'column',
    gap: '8px' // Spacing between items
  }}>
    {/* Using a nice checkmark icon instead of a dot for the list items */}
    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ color: '#10b981', fontSize: '14px' }}>✓</span> 
      Personal Data Sheet (PDS)
    </li>

        {selectedJob.required_docs?.applicationLetter && (
      <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#10b981', fontSize: '14px' }}>✓</span> 
        Application Letter
      </li>
    )}

    {selectedJob.required_docs?.transcriptRecords && (
      <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#10b981', fontSize: '14px' }}>✓</span> 
        Transcript of Records
      </li>
    )}
    {selectedJob.required_docs?.performanceRating && (
      <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#10b981', fontSize: '14px' }}>✓</span> 
        Performance Rating
      </li>
    )}
  </ul>
</div>

        {/* ── INSTRUCTIONS ── */}
        {selectedJob.instructions && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', letterSpacing: '0.8px', textTransform: 'uppercase', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#f59e0b' }}>■</span> Instructions / Remarks
            </h4>
            <p style={{ fontSize: '13px', lineHeight: 1.6, margin: 0, color: '#78350f' }}>{selectedJob.instructions}</p>
          </div>
        )}

              <hr style={{ border: 0, borderTop: '1px solid #e2e8f0', margin: '24px 0' }} />

             <div style={{
  background: '#f8fafc',
  border: '1px solid #e8ebf5',
  borderRadius: '12px',
  padding: '18px 20px',
  marginBottom: '16px'
}}>
  <h4 style={{
    fontSize: '12px',
    fontWeight: 700,
    color: '#1a3a5c',
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    margin: '0 0 14px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  }}>
    <span style={{ color: '#4F46E5' }}>■</span> Submit Your Application
  </h4>
                
                {appliedJobs[selectedJob.id] ? (
                  // === ALREADY APPLIED VIEW ===
                  <>
                    {renderAlreadyAppliedSummary()}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                      <button 
                        className="view-applications-btn"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => {
                          setShowJobDetailsModal(false);
                          navigate('/applicant/applications');
                        }}
                      >
                         View My Applications
                      </button>
                      <button 
                        className="cancel-btn"
                        style={{ flex: 1 }}
                        onClick={() => setShowJobDetailsModal(false)}
                      >
                        Close
                      </button>
                    </div>
                  </>
                ) : (
                  // === NEW APPLICATION VIEW ===
                  <>
                    <div className="form-group">
                      <label>Cover Letter (Optional)</label>
                      <textarea 
                        rows="3" 
                        placeholder="Tell us why you're a great fit for this position..."
                        value={application.coverLetter}
                        onChange={(e) => setApplication({...application, coverLetter: e.target.value})}
                      />
                    </div>
{/* ═══ PROFILE DOCUMENTS ═══ */}
{/* ═══ DOCUMENTS ═══ */}
<div className="required-docs-section">
 <h4 style={{ 
  display: 'flex', 
  alignItems: 'center', 
  gap: '8px', 
  fontSize: '13px', 
  fontWeight: 600, 
  color: '#1a3a5c',
  margin: '0 0 8px 0'
}}>
  <BasiconsDocumentIcon size={16} color="#15152c" /> Submit Documents
</h4>
  <p className="info-text" style={{ marginBottom: '12px' }}>
    Documents from your profile are used by default.{' '}
    
  </p>

  {/* ═══════════════════════════════════════════════ */}
  {/* PDS — always required */}
  {/* ═══════════════════════════════════════════════ */}
  {/* ═══════════════════════════════════════════════ */}
<div style={{
  background: '#f8f9fc',
  padding: '14px 16px',
  borderRadius: '8px',
  fontSize: '13px',
  border: application.documents.pds
    ? '1px solid #c7d2fe'
    : (applicantProfile?.pds_file_url ? '1px solid #d1fae5' : '1px solid #fecaca'),
  marginBottom: '10px',
  
  // ✅ ADDED SOFT DROP SHADOW HERE
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
}}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
    <span style={{ fontWeight: 600 }}>
       Personal Data Sheet 
    </span>
    {!application.documents.pds && (
      applicantProfile?.pds_file_url
        ? <span style={{ color: '#0d9488', fontWeight: 600, fontSize: '12px' }}>✓ Using profile (default)</span>
        : <span style={{ color: '#dc2626', fontWeight: 600, fontSize: '12px' }}>✗ Missing</span>
    )}
  </div>

  <div style={{ fontSize: '11px', color: '#6c757d', marginBottom: '10px' }}>
    Primary document used for screening
  </div>

  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
         background: '#eef2ff',        /* ✅ White background */
    color: '#475569',             /* ✅ Dark gray text */
    border: '1px solid #CBD5E1',  /* ✅ Subtle gray border */
        padding: '8px 14px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)' /* Tiny shadow to pop it off the gray card */
      }}
      onMouseEnter={(e) => {
    e.currentTarget.style.background = '#e0e7ff';
    e.currentTarget.style.borderColor = '#94A3B8';
  }}
      onMouseLeave={(e) => {
    e.currentTarget.style.background = '#eef2ff';
    e.currentTarget.style.borderColor = '#CBD5E1';
  }}
    >
      <BasiconsFolderIcon size={14} color="#383654" />{application.documents.pds
        ? 'Replace file'
        : (applicantProfile?.pds_file_url ? 'Upload different file' : 'Upload PDS')}
      <input
        type="file"
        accept=".pdf,.xlsx,.docx,.jpg,.jpeg,.png"
        style={{ display: 'none' }}
        onChange={(e) => handleFileChange(e, 'pds')}
      />
    </label>

    {application.documents.pds && (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: '#eef2ff',
        padding: '6px 10px',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#4F46E5',
        maxWidth: '100%'
      }}>
        <span>{application.documents.pds.name}</span>
        <button
          type="button"
          onClick={() => handleRemoveFile('pds')}
          style={{
            background: '#fee2e2',
            color: '#dc2626',
            border: 'none',
            borderRadius: '4px',
            padding: '2px 8px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600
          }}
        >
          ✕ Remove
        </button>
      </div>
    )}
  </div>

  {!application.documents.pds && !applicantProfile?.pds_file_url && (
    <div style={{
      marginTop: '10px',
      fontSize: '11px',
      color: '#92400e',
      background: '#fef3c7',
      padding: '6px 10px',
      borderRadius: '6px'
    }}>
       No PDS found on your profile. Upload one to apply for this job.
    </div>
  )}
</div>


 {/* ═══════════════════════════════════════════════ */}
{/* Application Letter — optional */}
{/* ═══════════════════════════════════════════════ */}
{selectedJob.required_docs?.applicationLetter && (
  <div style={{
    background: '#f8f9fc',
    padding: '14px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    border: application.documents.applicationLetter
      ? '1px solid #c7d2fe'
      : (applicantProfile?.application_letter_file_url ? '1px solid #d1fae5' : '1px solid #e5e7eb'),
    marginBottom: '10px'
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
      <span style={{ fontWeight: 600 }}> Application Letter</span>
      {!application.documents.applicationLetter && applicantProfile?.application_letter_file_url && (
        <span style={{ color: '#0d9488', fontWeight: 600, fontSize: '12px' }}>
          ✓ Using Profile (default)
        </span>
      )}
    </div>

    <div style={{ fontSize: '11px', color: '#6c757d', marginBottom: '10px' }}>
      Letter of intent addressed to the CHRMO
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: '#eef2ff',
          color: '#475569',
          border: '1px solid #CBD5E1',
          padding: '8px 14px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.2s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#e0e7ff'}
        onMouseLeave={(e) => e.currentTarget.style.background = '#eef2ff'}
      >
        <BasiconsFolderIcon size={14} color="#383654" /> {application.documents.applicationLetter
          ? 'Replace file'
          : (applicantProfile?.application_letter_file_url ? 'Upload different file' : 'Upload file')}
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.docx"
          style={{ display: 'none' }}
          onChange={(e) => handleFileChange(e, 'applicationLetter')}
        />
      </label>

      {application.documents.applicationLetter && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#eef2ff',
          padding: '6px 10px',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#4F46E5',
          maxWidth: '100%'
        }}>
          <span> {application.documents.applicationLetter.name}</span>
          <button
            type="button"
            onClick={() => handleRemoveFile('applicationLetter')}
            style={{
              background: '#fee2e2',
              color: '#dc2626',
              border: 'none',
              borderRadius: '4px',
              padding: '2px 8px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600
            }}
          >
            ✕ Remove
          </button>
        </div>
      )}
    </div>
  </div>
)}


{/* ═══════════════════════════════════════════════ */}
{/* Transcript of Records — optional */}
{/* ═══════════════════════════════════════════════ */}
{selectedJob.required_docs?.transcriptRecords && (
  <div style={{
    background: '#f8f9fc',
    padding: '14px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    border: application.documents.transcript
      ? '1px solid #c7d2fe'
      : (applicantProfile?.tor_file_url ? '1px solid #d1fae5' : '1px solid #e5e7eb'),
    marginBottom: '10px'
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
      <span style={{ fontWeight: 600 }}> Transcript of Records</span>
      {!application.documents.transcript && applicantProfile?.tor_file_url && (
        <span style={{ color: '#0d9488', fontWeight: 600, fontSize: '12px' }}>
          ✓ Using Profile (default)
        </span>
      )}
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: '#eef2ff',        /* ✅ White background */
    color: '#475569',             /* ✅ Dark gray text */
    border: '1px solid #CBD5E1',  /* ✅ Subtle gray border */
          padding: '8px 14px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.2s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#e0e7ff'}
        onMouseLeave={(e) => e.currentTarget.style.background = '#eef2ff'}
      >
        <BasiconsFolderIcon size={14} color="#383654" /> {application.documents.transcript
          ? 'Replace file'
          : (applicantProfile?.tor_file_url ? 'Upload different file' : 'Upload file')}
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          style={{ display: 'none' }}
          onChange={(e) => handleFileChange(e, 'transcript')}
        />
      </label>

      {application.documents.transcript && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#eef2ff',
          padding: '6px 10px',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#4F46E5',
          maxWidth: '100%'
        }}>
          <span> {application.documents.transcript.name}</span>
          <button
            type="button"
            onClick={() => handleRemoveFile('transcript')}
            style={{
              background: '#fee2e2',
              color: '#dc2626',
              border: 'none',
              borderRadius: '4px',
              padding: '2px 8px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600
            }}
          >
            ✕ Remove
          </button>
        </div>
      )}
    </div>
  </div>
)}

 

{/* ═══════════════════════════════════════════════ */}
{/* Performance Rating — optional */}
{/* ═══════════════════════════════════════════════ */}
{selectedJob.required_docs?.performanceRating && (
  <div style={{
    background: '#f8f9fc',
    padding: '14px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    border: application.documents.performanceRating
      ? '1px solid #c7d2fe'
      : (applicantProfile?.performance_rating_file_url ? '1px solid #d1fae5' : '1px solid #e5e7eb')
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
      <span style={{ fontWeight: 600 }}> Performance Rating</span>
      {!application.documents.performanceRating && applicantProfile?.performance_rating_file_url && (
        <span style={{ color: '#0d9488', fontWeight: 600, fontSize: '12px' }}>
          ✓ Using Profile (default)
        </span>
      )}
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
               background: '#eef2ff',        /* ✅ White background */
    color: '#475569',             /* ✅ Dark gray text */
    border: '1px solid #CBD5E1',  /* ✅ Subtle gray border */
          padding: '8px 14px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.2s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#e0e7ff'}
        onMouseLeave={(e) => e.currentTarget.style.background = '#eef2ff'}
      >
        <BasiconsFolderIcon size={14} color="#383654" /> {application.documents.performanceRating
          ? 'Replace file'
          : (applicantProfile?.performance_rating_file_url ? 'Upload different file' : 'Upload file')}
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          style={{ display: 'none' }}
          onChange={(e) => handleFileChange(e, 'performanceRating')}
        />
      </label>

      {application.documents.performanceRating && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#eef2ff',
          padding: '6px 10px',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#4F46E5',
          maxWidth: '100%'
        }}>
          <span> {application.documents.performanceRating.name}</span>
          <button
            type="button"
            onClick={() => handleRemoveFile('performanceRating')}
            style={{
              background: '#fee2e2',
              color: '#dc2626',
              border: 'none',
              borderRadius: '4px',
              padding: '2px 8px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600
            }}
          >
            ✕ Remove
          </button>
        </div>
      )}
    </div>
  </div>
)}

  
</div>
                    {/* AI Screening Results - shown during submission */}
                    {showResults && renderResults()}

                    <div className="modal-actions">
                      <button className="cancel-btn" onClick={() => {
                        setShowJobDetailsModal(false);
                        setScreeningResult(null);
                        setShowResults(false);
                      }}>
                        {showResults ? 'Close' : 'Cancel'}
                      </button>
                     <button 
  className="submit-btn" 
  onClick={handleSubmitApplication} 
  disabled={submitting}
  style={{
    background: '#4f46e5',
    opacity: submitting ? 0.8 : 1,
    cursor: submitting ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'opacity 0.2s ease'
  }}
>
  {submitting ? (
    <>
      <span className="spinner" style={{ width: '16px', height: '16px' }} />
      Processing...
    </>
  ) : (
    'Submit Application'
  )}
</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}