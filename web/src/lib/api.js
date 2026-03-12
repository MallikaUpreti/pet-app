import axios from "axios";

const TOKEN_KEY = "pawcare_token";
const SELECTED_PET_KEY = "pawcare_selected_pet";

export const backendContracts = {
  auth: ["/auth/signup", "/auth/login", "/me", "/vet/profile"],
  pets: ["/pets", "/pets/:id", "/pets/:id/diet-plans", "/pets/:id/medications", "/pets/:id/vaccinations", "/pets/:id/records", "/pets/:id/health-logs", "/pets/:id/meals"],
  appointments: ["/appointments", "/appointments/:id/report"],
  messaging: ["/chat/requests", "/chats", "/chats/:id/messages", "/chats/:id/stream"],
  owner: ["/settings", "/notifications"],
  vet: ["/vet/patients", "/vets", "/notifications"],
  ai: ["/ai/advice"]
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  timeout: 15000
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
    portion: item.Portion
  };
}

function normalizeThread(item) {
  return {
    id: item.Id,
    owner_id: item.OwnerId,
    vet_user_id: item.VetUserId,
    pet_id: item.PetId,
    created_at: item.CreatedAt,
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

  const [vaccinations, medications, records, dietPlans, healthLogs, meals, reports] = await Promise.all([
    api.get(`/pets/${petId}/vaccinations`).then((res) => res.data.map(normalizeSimple)),
    api.get(`/pets/${petId}/medications`).then((res) => res.data.map(normalizeSimple)),
    api.get(`/pets/${petId}/records`).then((res) => res.data.map(normalizeSimple)),
    api.get(`/pets/${petId}/diet-plans`).then((res) =>
      res.data.map((item) => ({
        ...normalizeSimple(item),
        nutrition: [
          { label: "Protein", value: 30 },
          { label: "Fat", value: 25 },
          { label: "Carbs", value: 45 }
        ]
      }))
    ),
    api.get(`/pets/${petId}/health-logs`).then((res) => res.data.map(normalizeSimple)),
    api.get(`/pets/${petId}/meals`).then((res) => res.data.map(normalizeSimple)),
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

  const selectedPetId = getStoredPetId() || pets[0]?.id || null;
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
    const body = {
      name: payload.pet_name,
      species: String(payload.species || "").toLowerCase(),
      breed: payload.breed,
      age_months: Number(payload.age_months),
      weight_kg: Number(payload.weight),
      allergies: payload.allergies,
      diseases: payload.health_conditions,
      food_restrictions: payload.food_restrictions,
      health_conditions: payload.health_conditions,
      activity_level: payload.activity_level,
      vaccination_history: payload.vaccination_history
    };
    const { data } = await api.post("/pets", body);
    return data;
  },
  async askAi({ petId, question }) {
    const { data } = await api.post("/ai/advice", { pet_id: petId, question, mode: "chat" });
    return data;
  },
  async generateDietPlan({ petId, pantryItems = "" }) {
    const { data } = await api.post("/ai/advice", {
      pet_id: petId,
      pantry_items: pantryItems,
      mode: "plan"
    });
    return data;
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
  async sendMessage(chatId, body) {
    const { data } = await api.post(`/chats/${chatId}/messages`, { body });
    return data;
  },
  async fetchMessages(chatId) {
    const { data } = await api.get(`/chats/${chatId}/messages`);
    return data.map(normalizeMessage);
  },
  async markNotificationsRead() {
    await api.put("/notifications/read-all");
  },
  async refreshNotifications() {
    return fetchNotifications();
  }
};
