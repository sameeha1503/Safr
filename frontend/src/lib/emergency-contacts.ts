// Checked against current Goa/India government and operator sources on 2026-10-25.
// Keep a bundled directory so emergency numbers remain visible during database outages.
export const EMERGENCY_SOURCES = [
  { name: "Goa Government helplines", url: "https://www.goa.gov.in/" },
  {
    name: "Goa Police directory",
    url: "https://citizen.goapolice.gov.in/web/guest/phone",
  },
  {
    name: "Goa Tourism helpline",
    url: "https://goatourism.gov.in/blog-list/experience-goa-with-ease-with-a-dedicated-helpline/",
  },
  {
    name: "Drishti Lifesaving emergency contact",
    url: "https://drishtimarine.com/",
  },
  {
    name: "National Cyber Crime Reporting Portal",
    url: "https://cybercrime.gov.in/",
  },
  {
    name: "Goa Directorate of Health Services contacts",
    url: "https://www.goa.gov.in/department/health-services/",
  },
];

export const EMERGENCY_LAST_VERIFIED = "2026-10-25";

export const EMERGENCY_NUMBERS = {
  police: "112",
  ambulance: "108",
  childline: "1098",
};

export const EMERGENCY_CONTACTS = [
  {
    id: "112",
    name: "Emergency response",
    phone: "112",
    category: "Emergency",
    note: "Immediate emergency assistance",
    verified: true,
  },
  {
    id: "pink",
    name: "Pink Force",
    phone: "112",
    category: "Police",
    note: "Ask for Pink Force assistance",
    verified: true,
  },
  {
    id: "tourist",
    name: "Goa Tourist Helpline",
    phone: "1364",
    category: "Travel",
    note: "Tourism enquiries, complaints and assistance",
    verified: true,
  },
  {
    id: "ambulance",
    name: "Ambulance",
    phone: "108",
    category: "Medical",
    note: "Emergency ambulance assistance",
    verified: true,
  },
  {
    id: "fire",
    name: "Fire Brigade",
    phone: "101",
    category: "Emergency",
    note: "Fire and rescue",
    verified: true,
  },
  {
    id: "child",
    name: "Child Helpline",
    phone: "1098",
    category: "Support",
    note: "Assistance for children",
    verified: true,
  },
  {
    id: "women",
    name: "Women Helpline",
    phone: "1091",
    category: "Support",
    note: "Women requiring assistance",
    verified: true,
  },
  {
    id: "senior",
    name: "Senior Citizen Helpline",
    phone: "1090",
    category: "Support",
    note: "Support for senior citizens",
    verified: true,
  },
  {
    id: "gmc",
    name: "Goa Medical College, Bambolim",
    phone: "+918322458700",
    category: "Medical",
    note: "Hospital contact; for an ambulance call 108",
    verified: true,
  },
  {
    id: "drishti",
    name: "Drishti Marine Lifeguards",
    phone: "18008331511",
    category: "Coastal",
    note: "Operator-listed emergency contact; for immediate danger call 112",
    verified: true,
  },
  {
    id: "cyber-crime",
    name: "Cyber Crime Helpline",
    phone: "1930",
    category: "Support",
    note: "Online fraud and cyber crime",
    verified: true,
  },
  {
    id: "north-district-hospital",
    name: "North Goa District Hospital, Mapusa",
    phone: "+918322253244",
    category: "Medical",
    note: "Government hospital contact; for an ambulance call 108",
    verified: true,
  },
  {
    id: "south-district-hospital",
    name: "South Goa District Hospital, Margao",
    phone: "+918322705664",
    category: "Medical",
    note: "Government hospital contact; for an ambulance call 108",
    verified: true,
  },
  {
    id: "vasco-health-centre",
    name: "Urban Health Centre, Vasco",
    phone: "+918322512307",
    category: "Medical",
    note: "Government health-centre contact; for an ambulance call 108",
    verified: true,
  },
];
