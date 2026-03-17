import { create } from "zustand";
import { liveApi, setStoredToken } from "../lib/api";

let initializePromise = null;
let refreshPromise = null;

const emptyBootstrap = {
  owner: null,
  vet: null,
  user: null,
  settings: {},
  pets: [],
  appointments: [],
  vets: [],
  chatRequests: [],
  chatThreads: [],
  notifications: [],
  slotDays: [],
  weightSeries: [],
  aiSuggestions: [],
  vaccinations: [],
  medications: [],
  records: [],
  dietPlans: [],
  healthLogs: [],
  meals: [],
  reports: [],
  messages: [],
  patients: []
};

export const useAppStore = create((set, get) => ({
  ready: false,
  loading: false,
  error: "",
  currentRole: null,
  currentUser: null,
  bootstrap: emptyBootstrap,
  selectedPetId: null,
  activeChatId: null,
  generatedDietPlan: null,
  toasts: [],
  aiMessages: [
    {
      id: "seed-1",
      sender: "assistant",
      text: "Ask about diet, vaccine timing, appetite changes, or current medical context once you sign in."
    }
  ],
  async initialize() {
    if (get().ready) return;
    if (initializePromise) return initializePromise;
    set({ loading: true, error: "" });
    initializePromise = (async () => {
      try {
        const user = await liveApi.hydrateSession();
        if (!user) {
          set({ ready: true, loading: false });
          return;
        }
        const bootstrap = await liveApi.loadBootstrap(user.role, user);
        set({
          ready: true,
          loading: false,
          currentRole: user.role,
          currentUser: user,
          bootstrap: { ...emptyBootstrap, ...bootstrap },
          selectedPetId: bootstrap.pets[0]?.Id || bootstrap.pets[0]?.id || null,
          activeChatId: bootstrap.chatThreads[0]?.Id || bootstrap.chatThreads[0]?.id || null
        });
      } catch (error) {
        set({ ready: true, loading: false, error: error.message || "Failed to initialize app" });
      } finally {
        initializePromise = null;
      }
    })();
    return initializePromise;
  },
  async login(payload) {
    set({ loading: true, error: "" });
    try {
      const result = await liveApi.login(payload);
      const bootstrap = await liveApi.loadBootstrap(result.role);
      set({
        ready: true,
        loading: false,
        currentRole: result.role,
        currentUser: bootstrap.user,
        bootstrap: { ...emptyBootstrap, ...bootstrap },
        selectedPetId: bootstrap.pets[0]?.Id || bootstrap.pets[0]?.id || null,
        activeChatId: bootstrap.chatThreads[0]?.Id || bootstrap.chatThreads[0]?.id || null
      });
      return result;
    } catch (error) {
      set({ loading: false, error: error.message || "Login failed" });
      throw error;
    }
  },
  async signup(payload) {
    set({ loading: true, error: "" });
    try {
      const result = await liveApi.signup(payload);
      set({
        ready: true,
        loading: false,
        currentRole: result.role,
        currentUser: {
          id: result.user_id,
          role: result.role,
          full_name: result.full_name,
          email: payload.email
        }
      });
      return result;
    } catch (error) {
      set({ loading: false, error: error.message || "Signup failed" });
      throw error;
    }
  },
  async refreshBootstrap() {
    const { currentRole } = get();
    if (!currentRole) return;
    if (refreshPromise) return refreshPromise;
    const seedUser = get().currentUser || null;
    refreshPromise = (async () => {
      try {
        const bootstrap = await liveApi.loadBootstrap(currentRole, seedUser);
        set({
          bootstrap: { ...emptyBootstrap, ...bootstrap },
          currentUser: bootstrap.user,
          selectedPetId: get().selectedPetId || bootstrap.pets[0]?.Id || bootstrap.pets[0]?.id || null,
          activeChatId: get().activeChatId || bootstrap.chatThreads[0]?.Id || bootstrap.chatThreads[0]?.id || null
        });
      } finally {
        refreshPromise = null;
      }
    })();
    return refreshPromise;
  },
  async selectPet(petId) {
    const appointments = get().bootstrap.appointments;
    const resources = await liveApi.selectPet(petId, appointments);
    set((state) => ({
      selectedPetId: petId,
      bootstrap: { ...state.bootstrap, ...resources }
    }));
  },
  async setActiveChat(chatId) {
    const messages = await liveApi.fetchMessages(chatId);
    set((state) => ({
      activeChatId: chatId,
      bootstrap: { ...state.bootstrap, messages }
    }));
  },
  async submitQuiz(payload) {
    const result = await liveApi.createPetFromQuiz(payload);
    await get().refreshBootstrap();
    return result;
  },
  async submitAiPrompt(question) {
    const selectedPetId = get().selectedPetId;
    const userMessage = { id: crypto.randomUUID(), sender: "user", text: question };
    set((state) => ({ aiMessages: [...state.aiMessages, userMessage] }));
    try {
      const result = await liveApi.askAi({ petId: selectedPetId, question });
      set((state) => ({
        aiMessages: [...state.aiMessages, { id: crypto.randomUUID(), sender: "assistant", text: result.reply }]
      }));
    } catch (error) {
      set((state) => ({
        aiMessages: [...state.aiMessages, { id: crypto.randomUUID(), sender: "assistant", text: error.message || "AI guidance is currently unavailable." }]
      }));
    }
  },
  async generateDietPlan(pantryItems = "") {
    const selectedPetId = get().selectedPetId;
    if (!selectedPetId) return null;
    const result = await liveApi.generateDietPlan({ petId: selectedPetId, pantryItems });
    set({ generatedDietPlan: result.plan });
    return result.plan;
  },
  async bookAppointment(payload) {
    const result = await liveApi.bookAppointment(payload);
    await get().refreshBootstrap();
    return result;
  },
  async updateAppointment(apptId, payload) {
    const result = await liveApi.updateAppointment(apptId, payload);
    await get().refreshBootstrap();
    return result;
  },
  async saveVetAvailability(payload) {
    await liveApi.updateVetProfile(payload);
    await get().refreshBootstrap();
  },
  async sendMessage(payload) {
    const chatId = get().activeChatId;
    const body = typeof payload === "string" ? payload : payload?.body || "";
    const attachment = typeof payload === "object" ? payload?.attachment : null;
    if (!chatId || (!body.trim() && !attachment)) return;
    await liveApi.sendMessage(chatId, { body, attachment });
    const messages = await liveApi.fetchMessages(chatId);
    set((state) => ({
      bootstrap: { ...state.bootstrap, messages }
    }));
  },
  async uploadPetPhoto(petId, file) {
    await liveApi.updatePetPhoto(petId, file);
    await get().refreshBootstrap();
  },
  async updatePetProfile(petId, payload) {
    await liveApi.updatePetProfile(petId, payload);
    await get().refreshBootstrap();
  },
  async saveVaccination(petId, payload) {
    await liveApi.saveVaccination(petId, payload);
    await get().refreshBootstrap();
  },
  async closeChat(chatId) {
    await liveApi.closeChat(chatId);
    await get().refreshBootstrap();
  },
  pushToast(toast) {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts, { id, tone: "info", ...toast }]
    }));
  },
  dismissToast(toastId) {
    set((state) => ({
      toasts: state.toasts.filter((item) => item.id !== toastId)
    }));
  },
  async markNotificationsRead() {
    await liveApi.markNotificationsRead();
    const notifications = await liveApi.refreshNotifications();
    set((state) => ({
      bootstrap: { ...state.bootstrap, notifications }
    }));
  },
  async markNotificationRead(notificationId) {
    await liveApi.markNotificationRead(notificationId);
    const notifications = await liveApi.refreshNotifications();
    set((state) => ({
      bootstrap: { ...state.bootstrap, notifications }
    }));
  },
  logout() {
    setStoredToken(null);
    set({
      ready: true,
      loading: false,
      error: "",
      currentRole: null,
      currentUser: null,
      bootstrap: emptyBootstrap,
      selectedPetId: null,
      activeChatId: null,
      generatedDietPlan: null,
      toasts: [],
      aiMessages: [
        {
          id: "seed-1",
          sender: "assistant",
          text: "Ask about diet, vaccine timing, appetite changes, or current medical context once you sign in."
        }
      ]
    });
  }
}));
