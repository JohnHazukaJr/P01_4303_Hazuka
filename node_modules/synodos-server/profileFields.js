/**
 * Work field taxonomy: broad category + subfield (validated on PATCH /api/me).
 * Keys are stored in DB; `id` values must stay stable for existing users — add new ids, avoid renames.
 */
const WORK_FIELDS = {
  tech: {
    label: "Tech",
    subfields: [
      { id: "software", label: "Software engineering" },
      { id: "web_frontend", label: "Web — front-end & UI engineering" },
      { id: "web_backend", label: "Web — back-end & APIs" },
      { id: "mobile", label: "Mobile apps (iOS, Android, cross-platform)" },
      { id: "data", label: "Data & analytics" },
      { id: "ai_ml", label: "AI / machine learning" },
      { id: "devops", label: "DevOps, SRE & infrastructure" },
      { id: "cloud", label: "Cloud platforms & architecture" },
      { id: "cybersecurity", label: "Security & privacy engineering" },
      { id: "qa_testing", label: "QA, test automation & quality" },
      { id: "hardware", label: "Hardware & electronics" },
      { id: "embedded_iot", label: "Embedded systems & IoT" },
      { id: "it_support", label: "IT support & systems administration" },
      { id: "product", label: "Product management" },
      { id: "ux_research", label: "UX research & content design" },
      { id: "games_interactive", label: "Games & interactive media (engineering)" },
      { id: "science_tech", label: "Scientific / research computing" },
      { id: "technical_writing", label: "Technical writing & documentation" },
      { id: "other", label: "Other tech" },
    ],
  },
  art: {
    label: "Art",
    subfields: [
      { id: "visual", label: "Visual art, illustration & painting" },
      { id: "photography", label: "Photography" },
      { id: "design", label: "Graphic & brand design" },
      { id: "ux_ui_design", label: "UX / UI & digital product design" },
      { id: "animation", label: "Animation & motion design" },
      { id: "film", label: "Film & video production" },
      { id: "music", label: "Music composition & performance" },
      { id: "audio", label: "Audio engineering, sound & podcasting" },
      { id: "writing", label: "Writing & editing" },
      { id: "performing_arts", label: "Theatre, dance & live performance" },
      { id: "crafts", label: "Crafts, sculpture & physical making" },
      { id: "fashion", label: "Fashion & textile art" },
      { id: "games_art", label: "Games — art, narrative & direction" },
      { id: "art_education", label: "Arts education & facilitation" },
      { id: "other", label: "Other art" },
    ],
  },
  blue_collar: {
    label: "Blue collar",
    subfields: [
      { id: "construction", label: "Construction & carpentry" },
      { id: "electrical", label: "Electrical trade" },
      { id: "plumbing", label: "Plumbing & pipefitting" },
      { id: "hvac", label: "HVAC & refrigeration" },
      { id: "metal_welding", label: "Metalwork & welding" },
      { id: "manufacturing", label: "Manufacturing & machining" },
      { id: "logistics", label: "Logistics, warehousing & material handling" },
      { id: "transportation", label: "Transportation & commercial driving" },
      { id: "trades", label: "General skilled trades (other)" },
      { id: "automotive", label: "Automotive & diesel repair" },
      { id: "agriculture", label: "Agriculture, farming & ranching" },
      { id: "forestry_landscaping", label: "Forestry, landscaping & grounds" },
      { id: "food_production", label: "Food production & processing" },
      { id: "facilities", label: "Facilities, janitorial & building maintenance" },
      { id: "oil_gas_mining", label: "Oil, gas & mining operations" },
      { id: "other", label: "Other" },
    ],
  },
};

function isValidWorkField(field) {
  return Object.prototype.hasOwnProperty.call(WORK_FIELDS, field);
}

function isValidWorkSubfield(field, subfield) {
  if (!isValidWorkField(field)) return false;
  var subs = WORK_FIELDS[field].subfields;
  for (var i = 0; i < subs.length; i++) {
    if (subs[i].id === subfield) return true;
  }
  return false;
}

function getFieldLabel(field) {
  return WORK_FIELDS[field] ? WORK_FIELDS[field].label : String(field || "");
}

function getSubfieldLabel(field, subfieldId) {
  if (!WORK_FIELDS[field] || !WORK_FIELDS[field].subfields) {
    return String(subfieldId || "");
  }
  var subs = WORK_FIELDS[field].subfields;
  for (var i = 0; i < subs.length; i++) {
    if (subs[i].id === subfieldId) return subs[i].label;
  }
  return String(subfieldId || "");
}

/** Labels for API + UI; ids must match stored DB values. */
function enrichTag(field, subfield) {
  var wf = String(field || "").trim();
  var ws = String(subfield || "").trim();
  return {
    work_field: wf,
    work_subfield: ws,
    field_label: getFieldLabel(wf),
    subfield_label: getSubfieldLabel(wf, ws),
  };
}

function profileFieldsPayload() {
  var keys = Object.keys(WORK_FIELDS);
  var fields = {};
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    fields[k] = {
      label: WORK_FIELDS[k].label,
      subfields: WORK_FIELDS[k].subfields,
    };
  }
  return { fields: fields };
}

module.exports = {
  WORK_FIELDS,
  isValidWorkField,
  isValidWorkSubfield,
  profileFieldsPayload,
  getFieldLabel,
  getSubfieldLabel,
  enrichTag,
};
