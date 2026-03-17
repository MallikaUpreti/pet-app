import axios from "axios";

const TOKEN_KEY = "pawcare_token";
const SELECTED_PET_KEY = "pawcare_selected_pet";

export const backendContracts = {
  auth: ["/auth/signup", "/auth/login", "/me", "/vet/profile"],
  reference: ["/vaccines"],
  pets: ["/pets", "/pets/:id", "/pets/:id/diet-plans", "/pets/:id/medications", "/pets/:id/vaccinations", "/pets/:id/records", "/pets/:id/health-logs", "/pets/:id/meals"],
  appointments: ["/appointments", "/appointments/:id/report"],
  messaging: ["/chat/requests", "/chats", "/chats/:id/messages", "/chats/:id/stream"],
  owner: ["/settings", "/notifications"],
  vet: ["/vet/patients", "/vet/patients/:id", "/vets", "/notifications"],
  ai: ["/ai/advice"]
};

const defaultApiBase =
  typeof window !== "undefined" && window.location?.port === "5000"
    ? `${window.location.origin}/api`
    : "http://127.0.0.1:5000/api";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || defaultApiBase,
  timeout: 30000
});

export function getStoredToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
    delete api.defaults.headers.common.Authorization;
  }
}

export function getStoredPetId() {
  const value = window.localStorage.getItem(SELECTED_PET_KEY);
  return value ? Number(value) : null;
}

export function setStoredPetId(petId) {
  if (petId) {
    window.localStorage.setItem(SELECTED_PET_KEY, String(petId));
  } else {
    window.localStorage.removeItem(SELECTED_PET_KEY);
  }
}

setStoredToken(getStoredToken());

function normalizeError(error) {
  if (error?.message === "Network Error") {
    return "Could not reach backend API. Confirm backend is running on port 5000 and restart both frontend/backend.";
  }
  return error?.response?.data?.error || error.message || "Request failed";
}

function normalizePet(item) {
  return {
    id: item.Id,
    owner_id: item.OwnerId,
    name: item.Name,
    species: item.Species,
    breed: item.Breed,
    age_months: item.AgeMonths,
    weight_kg: item.WeightKg,
    allergies: item.Allergies || "",
    diseases: item.Diseases || "",
    food_restrictions: item.FoodRestrictions || "",
    health_conditions: item.HealthConditions || item.Diseases || "",
    activity_level: item.ActivityLevel || "",
    vaccination_history: item.VaccinationHistory || "",
    photo_url: item.PhotoUrl || "https://placehold.co/600x600/f4f7fa/0f0f0f?text=Pet",
    created_at: item.CreatedAt
  };
}

function normalizeAppointment(item) {
  return {
    id: item.Id,
    type: item.Type,
    status: item.Status,
    start_time: item.StartTime,
    end_time: item.EndTime,
    notes: item.Notes,
    pet_id: item.PetId,
    owner_id: item.OwnerId,
    vet_user_id: item.VetUserId,
    pet_name: item.PetName,
    vet_name: item.VetName,
    owner_name: item.OwnerName,
    has_report: Boolean(item.HasReport)
  };
}

function normalizeSimple(item) {
  return {
    id: item.Id,
    pet_id: item.PetId,
    name: item.Name,
    title: item.Title,
    status: item.Status,
    notes: item.Notes,
    due_date: item.DueDate,
    administered_date: item.AdministeredDate,
    dosage: item.Dosage,
    frequency: item.Frequency,
    start_date: item.StartDate,
    end_date: item.EndDate,
    file_url: item.FileUrl,
    visit_date: item.VisitDate,
    created_at: item.CreatedAt,
    updated_at: item.UpdatedAt,
    details: item.Details,
    calories: item.Calories,
    allergies: item.Allergies,
    mood: item.Mood,
    appetite: item.Appetite,
    meal_time: item.MealTime,
    portion: item.Portion,
    source_appointment_id: item.SourceAppointmentId
  };
}

function normalizeThread(item) {
  return {
    id: item.Id,
    owner_id: item.OwnerId,
    vet_user_id: item.VetUserId,
    pet_id: item.PetId,
    created_at: item.CreatedAt,
    is_closed: Boolean(item.IsClosed),
    closed_at: item.ClosedAt,
    last_body: item.LastBody,
    last_at: item.LastAt,
    last_sender_role: item.LastSenderRole,
    vet_name: item.VetName,
    owner_name: item.OwnerName,
    pet_name: item.PetName
  };
}

function normalizeMessage(item) {
  return {
    id: item.Id,
    chat_id: item.ChatId,
    sender_role: item.SenderRole,
    sender_id: item.SenderId,
    body: item.Body,
    attachment_url: item.AttachmentUrl,
    attachment_type: item.AttachmentType,
    attachment_name: item.AttachmentName,
    created_at: item.CreatedAt
  };
}

function normalizeNotification(item) {
  return {
    id: item.Id,
    type: item.Type,
    message: item.Message,
    is_read: item.IsRead,
    created_at: item.CreatedAt,
    appointment_id: item.AppointmentId,
    owner_id: item.OwnerId,
    pet_id: item.PetId
  };
}

function normalizeDietPlanShape(plan, petName = "") {
  if (!plan) return null;

  // Gemini JSON shape
  if (Array.isArray(plan.daily_meals) || Array.isArray(plan.nutrition_breakdown)) {
    return plan;
  }

  // Backend deterministic generator shape (diet_generator.py)
  const macros = plan.macros || {};
  const firstDay = Array.isArray(plan.weekly_plan) ? plan.weekly_plan[0] : null;
  const dayMeals = Array.isArray(firstDay?.meals) ? firstDay.meals : [];

  return {
    summary: `${plan.pet_name || petName || "Pet"} plan generated at about ${plan.calories || "-"} kcal/day.`,
    daily_totals: {
      calories: Number(plan.calories || 0),
      protein_g: Number(macros.protein_g || 0),
      meals_count: dayMeals.length || 0,
      water_ml_range: ""
    },
    daily_meals: dayMeals.map((meal) => ({
      name: meal.name || "Meal",
      time: "",
      items: Array.isArray(meal.items) ? meal.items : [],
      portion: Array.isArray(meal.items) ? meal.items.join(", ") : ""
    })),
    weekly_plan: Array.isArray(plan.weekly_plan) ? plan.weekly_plan : [],
    nutrition_breakdown: [
      { label: "Protein", value: Number(macros.protein_g || 0) },
      { label: "Fat", value: Number(macros.fat_g || 0) },
      { label: "Carbs", value: Number(macros.carbs_g || 0) }
    ],
    meal_schedule: dayMeals.map((meal) => `${meal.name || "Meal"} ${Array.isArray(meal.items) ? `- ${meal.items.join(", ")}` : ""}`.trim()),
    recommended_foods: [],
    avoid_foods: [],
    clinical_notes: [],
    shopping_tips: [],
    safety_notes: Array.isArray(plan.notes) ? plan.notes : []
  };
}

function normalizeVet(item) {
  return {
    id: item.Id,
    full_name: item.FullName,
    email: item.Email,
    phone: item.Phone,
    clinic_name: item.ClinicName,
    license_no: item.LicenseNo,
    clinic_phone: item.ClinicPhone,
    bio: item.Bio,
    is_online: Boolean(item.IsOnline),
    start_hour: item.StartHour,
    end_hour: item.EndHour,
    available_days: item.AvailableDays
  };
}

function normalizePatient(item) {
  return {
    pet_id: item.PetId,
    pet_name: item.PetName,
    species: item.Species,
    breed: item.Breed,
    age_months: item.AgeMonths,
    weight_kg: item.WeightKg,
    owner_id: item.OwnerId,
    owner_name: item.OwnerName,
    last_visit: item.LastVisit,
    next_visit: item.NextVisit
  };
}

function buildWeightSeries(pets) {
  const label = new Date().toLocaleDateString(undefined, { month: "short" });
  return [{ date: label, ...Object.fromEntries(pets.map((pet) => [pet.name, pet.weight_kg || 0])) }];
}

function buildSlotDays(vets) {
  const activeVet = vets[0];
  if (!activeVet) return [];
  const availableDays = String(activeVet.available_days || "Mon,Tue,Wed,Thu,Fri")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const startHour = Number(activeVet.start_hour ?? 8);
  const endHour = Number(activeVet.end_hour ?? 18);
  const weekdayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days = [];
  const cursor = new Date();
  while (days.length < 5) {
    const code = weekdayMap[cursor.getDay()];
    if (availableDays.includes(code)) {
      const slots = [];
      for (let hour = startHour; hour < endHour; hour += 1) {
        slots.push(`${String(hour).padStart(2, "0")}:00`);
        slots.push(`${String(hour).padStart(2, "0")}:30`);
      }
      days.push({
        date: cursor.toISOString().slice(0, 10),
        label: cursor.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }),
        slots
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

async function fetchNotifications() {
  const { data } = await api.get("/notifications");
  return data.map(normalizeNotification);
}

async function fetchReportSummaries(appointments) {
  const reportAppointments = appointments.filter((item) => item.has_report);
  const results = await Promise.all(
    reportAppointments.map(async (appointment) => {
      try {
        const { data } = await api.get(`/appointments/${appointment.id}/report`);
        if (!data.report) return null;
        return {
          appointment_id: appointment.id,
          pet_id: appointment.pet_id,
          pet_name: appointment.pet_name,
          appointment_type: appointment.type,
          appointment_time: appointment.start_time,
          diagnosis: data.report.Diagnosis,
          medications_and_doses: data.report.MedicationsAndDoses,
          diet_recommendation: data.report.DietRecommendation,
          general_recommendation: data.report.GeneralRecommendation
        };
      } catch {
        return null;
      }
    })
  );
  return results.filter(Boolean);
}

async function fetchPetResources(petId, appointments = []) {
  if (!petId) {
    return {
      vaccinations: [],
      medications: [],
      records: [],
      dietPlans: [],
      healthLogs: [],
      meals: [],
      reports: []
    };
  }

  const safeList = async (path, mapper = normalizeSimple) => {
    try {
      const res = await api.get(path);
      return res.data.map(mapper);
    } catch (error) {
      if (error?.response?.status === 404) {
        return [];
      }
      throw error;
    }
  };

  const [vaccinations, medications, records, dietPlans, healthLogs, meals, reports] = await Promise.all([
    safeList(`/pets/${petId}/vaccinations`),
    safeList(`/pets/${petId}/medications`),
    safeList(`/pets/${petId}/records`),
    safeList(`/pets/${petId}/diet-plans`, (item) => ({
        ...normalizeSimple(item),
        nutrition: [
          { label: "Protein", value: 30 },
          { label: "Fat", value: 25 },
          { label: "Carbs", value: 45 }
        ]
      })
    ),
    safeList(`/pets/${petId}/health-logs`),
    safeList(`/pets/${petId}/meals`),
    fetchReportSummaries(appointments.filter((item) => Number(item.pet_id) === Number(petId)))
  ]);

  const dietPlansWithMeals = dietPlans.map((plan) => ({
    ...plan,
    meals: meals.map((meal) => ({
      title: meal.title,
      time: meal.meal_time,
      calories: meal.calories,
      portion: meal.portion
    }))
  }));

  return {
    vaccinations,
    medications,
    records,
    dietPlans: dietPlansWithMeals,
    healthLogs,
    meals,
    reports
  };
}

async function fetchCommonBootstrap(user) {
  const [pets, appointments, vets, chatRequests, chatThreads, notifications] = await Promise.all([
    api.get("/pets").then((res) => res.data.map(normalizePet)),
    api.get("/appointments").then((res) => res.data.map(normalizeAppointment)),
    api.get("/vets").then((res) => res.data.map(normalizeVet)),
    api.get("/chat/requests").then((res) =>
      res.data.map((item) => ({
        id: item.Id,
        owner_id: item.OwnerId,
        vet_user_id: item.VetUserId,
        pet_id: item.PetId,
        message: item.Message,
        status: item.Status,
        created_at: item.CreatedAt,
        vet_name: item.VetName,
        owner_name: item.OwnerName
      }))
    ),
    api.get("/chats").then((res) => res.data.map(normalizeThread)),
    fetchNotifications()
  ]);

  const storedPetId = getStoredPetId();
  const selectedPetId = pets.some((pet) => Number(pet.id) === Number(storedPetId)) ? storedPetId : pets[0]?.id || null;
  setStoredPetId(selectedPetId);
  const petResources = await fetchPetResources(selectedPetId, appointments);
  const activeChatId = chatThreads[0]?.id || null;
  const messages = activeChatId ? await api.get(`/chats/${activeChatId}/messages`).then((res) => res.data.map(normalizeMessage)) : [];

  return {
    user,
    pets,
    appointments,
    vets,
    chatRequests,
    chatThreads,
    notifications,
    slotDays: buildSlotDays(vets),
    weightSeries: buildWeightSeries(pets),
    aiSuggestions: [
      "What diet changes make sense for my pet's current profile?",
      "Are there any vaccine deadlines I should prioritize?",
      "What should I monitor in today's health logs?"
    ],
    ...petResources,
    messages
  };
}

export const liveApi = {
  async login(payload) {
    try {
      const { data } = await api.post("/auth/login", payload);
      setStoredToken(data.token);
      return data;
    } catch (error) {
      throw new Error(normalizeError(error));
    }
  },
  async signup(payload) {
    try {
      const { data } = await api.post("/auth/signup", payload);
      setStoredToken(data.token);
      return data;
    } catch (error) {
      throw new Error(normalizeError(error));
    }
  },
  async me() {
    const { data } = await api.get("/me");
    return data;
  },
  async hydrateSession() {
    const token = getStoredToken();
    if (!token) return null;
    try {
      setStoredToken(token);
      return await this.me();
    } catch {
      setStoredToken(null);
      return null;
    }
  },
  async loadBootstrap(role) {
    const user = await this.me();
    const base = await fetchCommonBootstrap(user);
    if (role === "vet") {
      const [vetProfile, patients] = await Promise.all([
        api.get("/vet/profile").then((res) => normalizeVet(res.data)),
        api.get("/vet/patients").then((res) => res.data.map(normalizePatient))
      ]);
      return { ...base, vet: vetProfile, patients };
    }
    const settings = await api.get("/settings").then((res) => res.data).catch(() => ({}));
    return { ...base, owner: user, settings };
  },
  async selectPet(petId, appointments) {
    setStoredPetId(petId);
    return fetchPetResources(petId, appointments);
  },
  async createPetFromQuiz(payload) {
    const form = new FormData();
    form.append("name", payload.pet_name);
    form.append("species", String(payload.species || "").toLowerCase());
    form.append("breed", payload.breed || "");
    form.append("age_months", String(Number(payload.age_months)));
    form.append("weight_kg", String(Number(payload.weight)));
    form.append("allergies", payload.allergies || "");
    form.append("diseases", payload.health_conditions || "");
    form.append("food_restrictions", payload.food_restrictions || "");
    form.append("health_conditions", payload.health_conditions || "");
    form.append("vaccination_history", payload.vaccination_history || "");
    if (payload.photo_file) {
      form.append("photo", payload.photo_file);
    }
    const { data } = await api.post("/pets", form);
    return data;
  },
    async updatePetPhoto(petId, file) {
      const form = new FormData();
      form.append("photo", file);
      const { data } = await api.patch(`/pets/${petId}`, form);
      return data;
    },
    async updatePetProfile(petId, payload) {
      const { data } = await api.patch(`/pets/${petId}`, payload);
      return data;
    },
  async askAi({ petId, question }) {
    try {
      const { data } = await api.post("/ai/advice", { pet_id: petId, question, mode: "chat" });
      return data;
    } catch (error) {
      throw new Error(normalizeError(error));
    }
  },
  async generateDietPlan({ petId, pantryItems = "" }) {
    try {
      const { data } = await api.post("/ai/advice", {
        pet_id: petId,
        pantry_items: pantryItems,
        mode: "plan",
        strict_ai: true
      });
      return { ...data, plan: normalizeDietPlanShape(data.plan) };
    } catch (error) {
      throw new Error(normalizeError(error));
    }
  },
  async bookAppointment(payload) {
    const { data } = await api.post("/appointments", payload);
    return data;
  },
  async updateAppointment(apptId, payload) {
    const { data } = await api.patch(`/appointments/${apptId}`, payload);
    return data;
  },
  async updateVetProfile(payload) {
    const { data } = await api.put("/vet/profile", payload);
    return data;
  },
    async sendMessage(chatId, { body, attachment }) {
    if (attachment) {
      const form = new FormData();
      form.append("body", body || "");
      form.append("attachment", attachment);
      const { data } = await api.post(`/chats/${chatId}/messages`, form);
      return data;
    }
      const { data } = await api.post(`/chats/${chatId}/messages`, { body });
      return data;
    },
    async closeChat(chatId) {
      const { data } = await api.post(`/chats/${chatId}/close`);
      return data;
    },
  async fetchMessages(chatId) {
    const { data } = await api.get(`/chats/${chatId}/messages`);
    return data.map(normalizeMessage);
  },
  async fetchVaccineGuide(species) {
    const { data } = await api.get("/vaccines", { params: { species: String(species || "").toLowerCase() } });
    return data.vaccines || [];
  },
  async saveVaccination(petId, payload) {
    if (payload.id) {
      const { data } = await api.patch(`/pets/${petId}/vaccinations/${payload.id}`, payload);
      return data;
    }
    const { data } = await api.post(`/pets/${petId}/vaccinations`, payload);
    return data;
  },
  async fetchVetPatientDetail(petId) {
    const { data: detail } = await api.get(`/vet/patients/${petId}`);
    const appointments = detail.appointments.map(normalizeAppointment);
    const resources = await fetchPetResources(petId, appointments);
    return {
      patient: normalizePet({
        Id: detail.patient.PetId,
        OwnerId: detail.patient.OwnerId,
        Name: detail.patient.PetName,
        Species: detail.patient.Species,
        Breed: detail.patient.Breed,
        AgeMonths: detail.patient.AgeMonths,
        WeightKg: detail.patient.WeightKg,
        Allergies: detail.patient.Allergies,
        Diseases: detail.patient.Diseases,
        FoodRestrictions: detail.patient.FoodRestrictions,
        HealthConditions: detail.patient.HealthConditions,
        ActivityLevel: detail.patient.ActivityLevel,
        VaccinationHistory: detail.patient.VaccinationHistory,
        PhotoUrl: detail.patient.PhotoUrl
      }),
      owner: {
        id: detail.patient.OwnerId,
        full_name: detail.patient.OwnerName,
        email: detail.patient.OwnerEmail,
        phone: detail.patient.OwnerPhone
      },
      appointments,
      ...resources
    };
  },
  async createChatRequest(payload) {
    const { data } = await api.post("/chat/requests", payload);
    return data;
  },
  async acceptChatRequest(requestId) {
    const { data } = await api.post(`/chat/requests/${requestId}/accept`);
    return data;
  },
  async declineChatRequest(requestId) {
    const { data } = await api.post(`/chat/requests/${requestId}/decline`);
    return data;
  },
  async fetchAppointmentReport(apptId) {
    const { data } = await api.get(`/appointments/${apptId}/report`);
    return data;
  },
  async saveAppointmentReport(apptId, payload) {
    const { data } = await api.put(`/appointments/${apptId}/report`, payload);
    return data;
  },
  async markNotificationsRead() {
    await api.put("/notifications/read-all");
  },
  async markNotificationRead(notificationId) {
    await api.put(`/notifications/${notificationId}/read`);
  },
  async refreshNotifications() {
    return fetchNotifications();
  }
};
