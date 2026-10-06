/*
 * LIME EMR site matrix data.
 *
 * Edit this file to update the matrix (docs/site-matrix/index.html).
 *
 * Form states:   "on" enabled in the site build, "plan" planned, "hold" on hold,
 *                "no" not needed. A form missing from a site is "not assessed".
 * Module states: same vocabulary.
 * Milestones:    { d: "YYYY-MM-DD" | "YYYY-MM" | "YYYY", done: true|false, approx: true|false, note: "..." }
 * Site status:   "live" | "preparation" | "planned"
 * Integration:   DHIS2 sync through OpenFn, from sites/<site>/configs/openfn.
 *                status "live" | "staging" | "template" (config present, not adapted
 *                or triggers off) | "planned"; synced = form codes mapped in the
 *                production workflow (F00 = registration, synced as TEI attributes);
 *                staging = extra forms mapped in the staging project only.
 *
 * Sources: sites/<site>/pom.xml (forms included in each build), sites/<site>/configs
 * (idgen, patient identifier types, registration fields, locales, locations),
 * LIME - Mombasa - Activities and forms.xlsx, LIME weekly follow-up notes.
 */
window.LIME_MATRIX = {
  asOf: "2026-10-06",

  // Shared form library: distro/configs/openmrs/initializer_config/ampathforms
  // [code, name, program, inLibrary (default true)]
  library: [
    ["F01", "MHPSS Baseline (v1)", "Mental Health"],
    ["F02", "MHPSS Follow-up (v1)", "Mental Health"],
    ["F03", "mhGAP Baseline (v1)", "Mental Health"],
    ["F04", "mhGAP Follow-up (v1)", "Mental Health"],
    ["F05", "MHPSS Closure (v1)", "Mental Health"],
    ["F06", "mhGAP Closure (v1)", "Mental Health"],
    ["F07", "MH PHQ-9 (v1)", "Mental Health"],
    ["F08", "ITFC Admission", "Nutrition"],
    ["F09", "ITFC Discharge", "Nutrition"],
    ["F10", "Feeding", "Nutrition"],
    ["F11", "Family Planning Assessment", "Family Planning"],
    ["F12", "Family Planning Follow-up", "Family Planning"],
    ["F13", "PNC", "Postnatal Care"],
    ["F14", "Basic Obstetric Ultrasound", "Obstetrics"],
    ["F15", "Surgical Safety Checklist", "Surgery"],
    ["F16", "Operative Report", "Surgery"],
    ["F17", "Surgery Admission", "Surgery"],
    ["F18", "Surgery Discharge", "Surgery"],
    ["F19", "Pre-anesthesia Record", "Anesthesia"],
    ["F20", "Recovery", "Anesthesia"],
    ["F21", "Anesthesia Transfer", "Anesthesia"],
    ["F22", "Neonatal Delivery", "Neonatology"],
    ["F23", "Neonatal Admission", "Neonatology"],
    ["F24", "Neonatal Discharge", "Neonatology"],
    ["F25", "Pediatrics Admission", "Pediatrics"],
    ["F26", "Pediatrics Discharge", "Pediatrics"],
    ["F27", "Adult Admission", "Adults"],
    ["F28", "Adult Discharge", "Adults"],
    ["F29", "MHPSS Baseline", "Mental Health"],
    ["F30", "MHPSS Follow-up", "Mental Health"],
    ["F31", "mhGAP Baseline", "Mental Health"],
    ["F32", "mhGAP Follow-up", "Mental Health"],
    ["F33", "MHPSS Closure", "Mental Health"],
    ["F34", "mhGAP Closure", "Mental Health"],
    ["F35", "MH PHQ-9", "Mental Health"],
    ["F36", "Maternity Triage", "Maternity"],
    ["F37", "Maternity Admission", "Maternity"],
    ["F38", "Maternity Delivery", "Maternity"],
    ["F39", "Maternity Discharge", "Maternity"],
    ["F40", "Referral & Discharge", "Other"],
    ["F41", "ER Triage", "Emergency Room"],
    ["F42", "ER Consultation", "Emergency Room"],
    ["F43", "ER Exit", "Emergency Room"],
    ["F44", "OPD General", "Outpatient"],
    ["F45", "ATFC", "Nutrition"],
    ["F46", "Small Procedure Report", "Other"],
    ["F47", "Pre-donation", "Other"],
    ["F48", "Blood Transfusion", "Other"],
    ["F49", "NCDs Baseline", "Non-Communicable Diseases"],
    ["F50", "NCDs Follow-up", "Non-Communicable Diseases"],
    ["F51", "HIV Baseline", "HIV"],
    ["F52", "HIV Follow-up", "HIV"],
    ["F53", "TB Baseline", "Tuberculosis"],
    ["F54", "TB Follow-up", "Tuberculosis"],
    ["F55", "HBV Baseline", "Hepatitis"],
    ["F56", "HBV Follow-up", "Hepatitis"],
    ["F57", "HCV Baseline", "Hepatitis"],
    ["F58", "HCV Follow-up", "Hepatitis"],
    ["F59", "Social Work Baseline", "Social Work"],
    ["F60", "Social Work Follow-up", "Social Work"],
    ["F61", "Travel Medicine", "Travel Medicine"],
    ["F62", "Palliative Care Baseline", "Palliative Care"],
    ["F63", "Palliative Care Follow-up", "Palliative Care"],
    ["F64", "ICU Admission", "Intensive Care Unit"],
    ["F65", "ICU Discharge", "Intensive Care Unit"],
    ["F66", "Snakebites", "Snakebites"],
    ["F67", "Cholera", "Outbreak"],
    ["F68", "NTDs Dengue", "Neglected Tropical Diseases"],
    ["F69", "NTDs Filariasis", "Neglected Tropical Diseases"],
    ["F70", "NTDs Schistosomiasis", "Neglected Tropical Diseases"],
    ["F71", "POCUS", "Other"],
    ["F72", "ANC", "Antenatal Care"],
    ["F73", "Gynaecology", "Gynaecology"],
    ["F74", "Cervical Cancer", "Cervical Cancer"],
    ["F75", "Wound Dressing", "Other"],
    ["F76", "Radiology Request", "Other"],
    ["F90", "Safe Abortion Care", "Safe Abortion Care", false],
    ["F91", "SV / IPV Admission", "Sexual Violence", false],
    ["F92", "SV / IPV Follow-up", "Sexual Violence", false]
  ],

  modules: [
    ["registration", "Patient registration"],
    ["chart", "Patient chart & clinical forms"],
    ["appointments", "Appointments"],
    ["lab", "Laboratory"],
    ["meds", "Orders & medications"],
    ["dispensing", "Dispensing"],
    ["ward", "Ward & bed management"],
    ["labels", "ID label printing"],
    ["reports", "Reports & data export"],
    ["ocl", "OCL terminology"]
  ],

  sites: [
    {
      id: "mosul",
      name: "Mosul",
      country: "Iraq",
      status: "live",
      phase: "Live, handover preparation",
      milestones: {
        live: { d: "2024", done: true },
        handover: { d: "2026-10-31", note: "Handover target end of October" }
      },
      registration: {
        primaryId: { type: "MSF ID", prefix: "IQ146-", pattern: "IQ146- + sequence (digits)", example: "IQ146-1024" },
        otherIds: ["Legacy MSF ID (AA00-00-0000), optional"],
        address: "Country › Governorate › District › City/Village › Address",
        fields: "Nationality, current status, legal status, marital status, number of children, occupation, 2 emergency contacts",
        languages: "English, Arabic"
      },
      locations: "Mental Health (MH), Registration Counter (REG) and hospital services",
      modules: { registration: "on", chart: "on", appointments: "on", lab: "on", meds: "on", ward: "no", labels: "on", ocl: "on" },
      formsDefault: "on",
      forms: {},
      customForms: [
        { code: "MOS-DC", name: "MH Discharge form", program: "Mental Health", state: "plan", note: "MH field team to check what is needed" }
      ],
      openItems: [
        "Discharge form: MH field team to check what is needed",
        "Handover: clarify DB management (store DB dump, no live instance)"
      ],
      integration: {
        status: "live",
        config: "sites/mosul/configs/openfn/mosul-project.yaml",
        version: "v1.5.6", versionDate: "2026-06-15",
        dhis2: "Mental Health tracker program (PII attributes removed before sync)",
        workflows: {
          wf1: { name: "DHIS2 → OpenMRS patient migration", schedule: "Daily 00:00", enabled: false },
          wf2: { name: "OpenMRS → DHIS2 patients and encounters", schedule: "Daily 17:00", enabled: true },
          wf3: { name: "OpenMRS → DHIS2, all programs (collection-based mappings)", schedule: "Daily 00:00", enabled: true, staging: true }
        },
        synced: ["F00", "F29-F34"],
        staging: ["F08", "F09", "F13", "F16-F18", "F22-F28", "F37", "F38", "F40-F43", "F49", "F50", "F55", "F56", "F58-F69"],
        metadata: "LIME EMR - Iraq Metadata - Release 1 - v2026-05-28",
        notes: "Staging project msf-lime-mosul-staging extends sync to the other hospital programs (WF3)."
      },
      notes: "Build includes the full distro form library (except IPD admission)."
    },
    {
      id: "matsapha",
      name: "Matsapha",
      country: "Eswatini",
      status: "live",
      phase: "Hypercare, moving to BAU",
      milestones: {
        live: { d: "2026-02", done: true, approx: true, note: "Deployed in Sprint 43 release (5 Feb 2026)" }
      },
      registration: {
        primaryId: { type: "MSF ID", prefix: "SZ-", pattern: "SZ- + sequence (digits)", example: "SZ-1024" },
        otherIds: ["Patient ID, required, exactly 5 digits (e.g. 12345)"],
        address: "Country › Region › Inkhundla › Address 1 / 2",
        fields: "Gender identity, marital and partnership status, occupation (+ other), date of first visit, 2nd phone, 2 emergency contacts",
        languages: "English"
      },
      locations: "Manzini Clinic",
      modules: { registration: "on", chart: "on", appointments: "on", lab: "on", meds: "on", labels: "on", reports: "on", ocl: "on" },
      formsDefault: "no",
      forms: { on: ["F11", "F12", "F29-F34", "F40", "F51", "F52", "F59", "F60", "F73"] },
      customForms: [],
      openItems: [
        "Users: confirm whether the admin account is still in use",
        "User creation troubleshooting: share with Pius"
      ],
      integration: {
        status: "template",
        config: "sites/matsapha/configs/openfn/mosul-project.yaml",
        version: "v1.5.1", versionDate: "2025-10-13",
        dhis2: "To define",
        workflows: {
          wf1: { name: "DHIS2 → OpenMRS patient migration", schedule: "Daily 00:00", enabled: false },
          wf2: { name: "OpenMRS → DHIS2 patients and encounters", schedule: "Daily 00:00", enabled: false }
        },
        synced: [],
        notes: "OpenFn project file is an unchanged copy of the Mosul v1.5.1 config (Mosul MH mappings, F00 + F29-F34). Both triggers are disabled. Site-specific mappings still to build."
      },
      notes: "Data migration and cleaning completed. Ongoing support process clarified."
    },
    {
      id: "bunia",
      name: "Bunia",
      country: "DR Congo",
      status: "live",
      phase: "Live",
      milestones: {
        live: { d: "", done: true, note: "Go-live date to confirm" }
      },
      registration: {
        primaryId: { type: "MSF ID", prefix: "CD511-", pattern: "CD511- + sequence (digits)", example: "CD511-1024" },
        otherIds: ["DHIS2 ID, optional"],
        address: "Country › Province › Health Zone › Address",
        fields: "Middle names, nationality, current status, legal status, marital status, number of children, occupation, 2 emergency contacts",
        languages: "French (default), English"
      },
      locations: "Bunia, Surgical Ward, Post-op Recovery Ward",
      modules: { registration: "on", chart: "on", appointments: "on", lab: "on", meds: "on", ward: "on", labels: "on", ocl: "on" },
      formsDefault: "no",
      forms: { on: ["F15-F21", "F29-F34", "F40", "F46-F48", "F75", "F76"] },
      customForms: [],
      openItems: [],
      integration: {
        status: "template",
        config: "sites/bunia/configs/openfn/bunia-project.yaml",
        version: "v1.5.1", versionDate: "2025-10-13",
        dhis2: "To define",
        workflows: {
          wf1: { name: "DHIS2 → OpenMRS patient migration", schedule: "Daily 00:00", enabled: false },
          wf2: { name: "OpenMRS → DHIS2 patients and encounters", schedule: "Daily 00:00", enabled: false }
        },
        synced: [],
        notes: "OpenFn project file is an unchanged copy of the Mosul v1.5.1 config (Mosul MH mappings, F00 + F29-F34). Both triggers are disabled. Site-specific mappings still to build."
      },
      notes: "Surgical project. Ward and bed management enabled (LIME2-1147)."
    },
    {
      id: "mombasa",
      name: "Mombasa",
      country: "Kenya",
      status: "preparation",
      phase: "UAT server deployment",
      milestones: {
        requirements: { d: "", note: "General consultation form specs still to finalize" },
        uat: { d: "2026-10-15", note: "UAT server before mid-October" }
      },
      registration: {
        primaryId: { type: "MSF ID", prefix: "", pattern: "To define", example: "" },
        otherIds: [],
        address: "To define (see Mombasa metadata file)",
        fields: "Site-specific registration form (F00) defined in the Mombasa metadata file",
        languages: "To confirm",
        isNew: true
      },
      locations: "Mombasa Health Facility: general consultation, mental health, infectious chronic diseases, family planning, health promotion, laboratory, dispensary",
      modules: { registration: "plan", chart: "plan", lab: "plan", meds: "plan", dispensing: "plan", ocl: "plan" },
      formsDefault: "no",
      forms: {
        plan: ["F11", "F12", "F29-F34", "F40", "F51-F60"],
        hold: ["F91", "F92"]
      },
      formNotes: {
        F35: "Not needed for the moment",
        F44: "Merged with F73 into the new General consultation form",
        F73: "Merged with F44 into the new General consultation form",
        F59: "Likely not used, access given so the team can view content",
        F60: "Likely not used, access given so the team can view content",
        F91: "Not introduced until further discussions (security measures)",
        F92: "Not introduced until further discussions (security measures)"
      },
      customForms: [
        { code: "MBA-GC", name: "General consultation", program: "Outpatient", state: "plan", note: "Combines OPD General (F44) and Gynaecology (F73). Specs to finalize" }
      ],
      openItems: [
        "Profiles: clarify default profiles vs MSF-defined users",
        "General consultation form: finalize specs",
        "Certification: analyse what is really required and document the strategy",
        "FiWi kit from Geneva to discuss before hardware is sent",
        "IT checklist to discuss separately"
      ],
      integration: {
        status: "planned",
        dhis2: "To define",
        notes: "DHIS2 needs to be confirmed with the project."
      },
      notes: "Requirements from 'LIME - Mombasa - Activities and forms'. One location needed."
    },
    {
      id: "ebola",
      name: "Ebola response",
      country: "Outbreak",
      status: "preparation",
      phase: "Tablet setup",
      milestones: {},
      registration: {},
      modules: {},
      forms: {},
      customForms: [],
      openItems: ["Finalize setup of 2 tablets"],
      notes: ""
    },
    {
      id: "baghdad",
      name: "Baghdad",
      country: "Iraq",
      status: "planned",
      phase: "Feasibility & budgeting",
      milestones: {},
      registration: {},
      modules: {},
      forms: {},
      customForms: [],
      openItems: ["Feasibility assessment and budgeting"],
      notes: ""
    },
    {
      id: "south-tehran",
      name: "South Tehran",
      country: "Iran",
      status: "planned",
      phase: "Feasibility & budgeting (urgent for PoA)",
      milestones: {},
      registration: {},
      modules: {},
      forms: {},
      customForms: [],
      openItems: ["Technical investigation of hosting infrastructure", "Feasibility analysis and budget, urgent for PoA", "New MedCo arriving"],
      notes: ""
    },
    {
      id: "homs",
      name: "Homs",
      country: "Syria",
      status: "planned",
      phase: "Feasibility & budgeting (urgent for PoA)",
      milestones: {},
      registration: {},
      modules: {},
      forms: {},
      customForms: [],
      openItems: ["Feasibility analysis and budgeting, urgent for PoA"],
      notes: ""
    },
    {
      id: "vinnytsia",
      name: "Vinnytsia",
      country: "Ukraine",
      status: "planned",
      phase: "Feasibility & budgeting",
      milestones: {},
      registration: {},
      modules: {},
      forms: {},
      customForms: [],
      openItems: [
        "IT infrastructure: FiWi kit to confirm",
        "User acceptance to confirm, high change management risk",
        "Alternative: implement in the other new project (early stage)"
      ],
      notes: ""
    }
  ]
};
