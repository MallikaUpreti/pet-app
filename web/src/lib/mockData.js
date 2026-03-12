export const owner = {
  id: 7,
  role: "owner",
  full_name: "Mallika Upreti",
  email: "mallika@pawcare.com",
  phone: "+977-9800000000"
};

export const vet = {
  id: 18,
  role: "vet",
  full_name: "Dr. Aarav Karki",
  email: "dr.aarav@pawcare.com",
  phone: "+977-9811111111",
  clinic_name: "BluePaw Veterinary Center",
  license_no: "VET-22391",
  clinic_phone: "+977-015550101",
  bio: "Small animal specialist focused on preventive care and long-term chronic disease management.",
  is_online: true,
  start_hour: 8,
  end_hour: 18,
  available_days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
};

export const pets = [
  {
    id: 101,
    owner_id: 7,
    name: "Mochi",
    species: "Dog",
    breed: "Shih Tzu",
    age_months: 26,
    weight_kg: 7.2,
    allergies: "Chicken, flea powder",
    diseases: "Sensitive stomach",
    photo_url:
      "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?auto=format&fit=crop&w=800&q=80",
    activity_level: "Playful",
    food_restrictions: "No chicken treats",
    health_conditions: "Occasional skin flareups"
  },
  {
    id: 102,
    owner_id: 7,
    name: "Nori",
    species: "Cat",
    breed: "British Shorthair",
    age_months: 48,
    weight_kg: 4.6,
    allergies: "None",
    diseases: "None",
    photo_url:
      "https://images.unsplash.com/photo-1511044568932-338cba0ad803?auto=format&fit=crop&w=800&q=80",
    activity_level: "Moderate",
    food_restrictions: "Low sodium",
    health_conditions: "Indoor cat"
  }
];

export const appointments = [
  {
    id: 3001,
    owner_id: 7,
    vet_user_id: 18,
    pet_id: 101,
    type: "Vaccination: Rabies",
    status: "Scheduled",
    start_time: "2026-03-18T10:30:00",
    end_time: "2026-03-18T11:00:00",
    notes: "Bring previous booklet",
    has_report: false
  },
  {
    id: 3002,
    owner_id: 7,
    vet_user_id: 18,
    pet_id: 101,
    type: "General Checkup",
    status: "Completed",
    start_time: "2026-02-11T15:00:00",
    end_time: "2026-02-11T15:30:00",
    notes: "Skin irritation review",
    has_report: true
  },
  {
    id: 3003,
    owner_id: 7,
    vet_user_id: 18,
    pet_id: 102,
    type: "Nutrition Review",
    status: "Pending",
    start_time: "2026-03-21T14:00:00",
    end_time: "2026-03-21T14:30:00",
    notes: "Review low-sodium options",
    has_report: false
  }
];

export const reports = [
  {
    appointment_id: 3002,
    diagnosis: "Mild contact dermatitis with no secondary infection.",
    medications_and_doses: "Omega oil | 2 ml | daily\nAntihistamine | 1 tablet | nightly",
    diet_recommendation: "Shift to fish-based sensitive skin formula for 8 weeks.",
    general_recommendation: "Weekly weigh-ins, no new grooming products, review in 30 days.",
    vet_notes:
      "Observed improved coat quality but owner should monitor paw licking after walks."
  }
];

export const vaccinations = [
  {
    id: 4101,
    pet_id: 101,
    name: "Rabies",
    due_date: "2026-03-18",
    status: "Due",
    notes: "Required booster"
  },
  {
    id: 4102,
    pet_id: 101,
    name: "DHPPiL",
    due_date: "2025-12-20",
    status: "Given",
    notes: "Completed at BluePaw"
  },
  {
    id: 4103,
    pet_id: 102,
    name: "Rabies",
    due_date: "2026-06-02",
    status: "Upcoming",
    notes: "Indoor cat schedule"
  }
];

export const medications = [
  {
    id: 5101,
    pet_id: 101,
    name: "Omega Oil",
    dosage: "2 ml",
    frequency: "Daily",
    start_date: "2026-02-11",
    end_date: "2026-04-11",
    notes: "Take with breakfast"
  },
  {
    id: 5102,
    pet_id: 101,
    name: "Antihistamine",
    dosage: "1 tablet",
    frequency: "Nightly",
    start_date: "2026-02-11",
    end_date: "2026-03-13",
    notes: "Monitor drowsiness"
  }
];

export const records = [
  {
    id: 6001,
    pet_id: 101,
    title: "Dermatology lab report",
    file_url: "#",
    notes: "No yeast overgrowth, no bacterial culture required.",
    visit_date: "2026-02-11"
  },
  {
    id: 6002,
    pet_id: 101,
    title: "Appointment Report - General Checkup",
    file_url: "",
    notes: reports[0].diagnosis,
    visit_date: "2026-02-11"
  }
];

export const dietPlans = [
  {
    id: 7001,
    pet_id: 101,
    title: "Sensitive skin recovery plan",
    details:
      "Fish-based kibble in two portions, pumpkin topper on alternate nights, omega-rich hydration booster.",
    calories: 320,
    allergies: "Chicken",
    budget: "Medium",
    meals: [
      { title: "Breakfast", time: "08:00", calories: 160, portion: "1 cup" },
      { title: "Dinner", time: "18:00", calories: 160, portion: "1 cup" }
    ],
    nutrition: [
      { label: "Protein", value: 32 },
      { label: "Fat", value: 24 },
      { label: "Carbs", value: 44 }
    ]
  }
];

export const healthLogs = [
  {
    id: 8001,
    pet_id: 101,
    mood: "Energetic",
    appetite: "Normal",
    notes: "No scratching today after changing bedding.",
    created_at: "2026-03-10T08:00:00"
  },
  {
    id: 8002,
    pet_id: 101,
    mood: "Sleepy",
    appetite: "Low",
    notes: "After medication dose.",
    created_at: "2026-03-08T08:00:00"
  }
];

export const meals = [
  { id: 9001, pet_id: 101, title: "Breakfast", meal_time: "08:00", calories: 160, portion: "1 cup" },
  { id: 9002, pet_id: 101, title: "Dinner", meal_time: "18:00", calories: 160, portion: "1 cup" }
];

export const notifications = [
  {
    id: 1,
    role: "owner",
    type: "vaccination_reminder",
    message: "Mochi's Rabies vaccine is due on March 18, 2026.",
    created_at: "2026-03-12T08:10:00",
    is_read: false
  },
  {
    id: 2,
    role: "owner",
    type: "appointment_update",
    message: "Appointment approved for Mochi (Vaccination: Rabies).",
    created_at: "2026-03-11T11:45:00",
    is_read: true
  },
  {
    id: 3,
    role: "vet",
    type: "chat_request",
    message: "New chat request from Mallika Upreti for Mochi.",
    created_at: "2026-03-12T09:40:00",
    is_read: false
  }
];

export const chatThreads = [
  {
    id: 10001,
    owner_id: 7,
    vet_user_id: 18,
    pet_id: 101,
    last_body: "Thank you, we already switched the food.",
    last_at: "2026-03-12T09:50:00"
  }
];

export const messages = [
  {
    id: 1,
    chat_id: 10001,
    sender_role: "owner",
    sender_id: 7,
    body: "Mochi has been scratching less after the diet change.",
    created_at: "2026-03-12T09:40:00"
  },
  {
    id: 2,
    chat_id: 10001,
    sender_role: "vet",
    sender_id: 18,
    body: "That is encouraging. Please keep the antihistamine for one more night.",
    created_at: "2026-03-12T09:45:00"
  },
  {
    id: 3,
    chat_id: 10001,
    sender_role: "owner",
    sender_id: 7,
    body: "Thank you, we already switched the food.",
    created_at: "2026-03-12T09:50:00"
  }
];

export const chatRequests = [
  {
    id: 11001,
    owner_id: 7,
    vet_user_id: 18,
    pet_id: 102,
    status: "Pending",
    message: "Need help comparing renal-support diets for Nori.",
    created_at: "2026-03-12T10:00:00"
  }
];

export const weightSeries = [
  { date: "Jan", Mochi: 7.8, Nori: 4.5 },
  { date: "Feb", Mochi: 7.4, Nori: 4.6 },
  { date: "Mar", Mochi: 7.2, Nori: 4.6 },
  { date: "Apr", Mochi: 7.1, Nori: 4.7 }
];

export const slotDays = [
  {
    date: "2026-03-18",
    label: "Tue 18",
    slots: ["09:00", "09:30", "10:30", "11:00", "15:00", "16:30"]
  },
  {
    date: "2026-03-19",
    label: "Wed 19",
    slots: ["08:00", "08:30", "13:00", "13:30", "17:00"]
  },
  {
    date: "2026-03-20",
    label: "Thu 20",
    slots: ["09:00", "10:00", "10:30", "14:00", "14:30"]
  }
];

export const aiSuggestions = [
  "Build a fish-free diet for a senior dog with chicken allergy",
  "Explain the next core vaccines my puppy needs",
  "What appetite changes should I log after antibiotics?"
];
