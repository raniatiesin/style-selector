import { create } from 'zustand';

export const useQuizStore = create((set, get) => ({
  // --- Navigation ---
  screen: 'welcome', // 'welcome' | 'quiz' | 'output' | 'confirmation'
  welcomePanel: 'hero', // 'hero' | 'faq'
  welcomePanelAnimating: false,

  // --- Quiz ---
  currentStep: 0, // 0–35
  answers: {}, // { [stepIndex]: tagString }
  activeImageIds: [], // 60 style IDs for background

  // --- Output ---
  sessionId: null, // uuid from /api/search — links to Supabase sessions row
  outputResults: [], // [{ id, similarity }] from pgvector
  outputHistory: [], // stack of { results, selected } for rabbit-hole back-nav
  isSearching: false, // true while /api/search is in flight
  selectedCarousel: null, // styleId currently featured on left panel

  // --- Update mode (when editing tally from output screen) ---
  updateMode: false,
  updateCategoryIndex: null,

  // --- Confirmation ---
  selectedStyle: null,
  submitting: false,
  submitted: false,
  submitError: null,

  // --- Actions ---
  setScreen: (screen) => set(() => {
    if (screen === 'welcome') {
      return { screen, welcomePanel: 'hero', welcomePanelAnimating: false };
    }

    return { screen, welcomePanel: 'hero', welcomePanelAnimating: false };
  }),

  setWelcomePanelAnimating: (val) => set({ welcomePanelAnimating: val }),
  openWelcomeFaq: () => set({ welcomePanel: 'faq' }),
  closeWelcomeFaq: () => set({ welcomePanel: 'hero' }),
  resetWelcomePanel: () => set({ welcomePanel: 'hero', welcomePanelAnimating: false }),

  selectAnswer: (stepIndex, value) => {
    const answers = { ...get().answers, [stepIndex]: value };
    set({ answers });
  },

  setActiveImageIds: (ids) => set({ activeImageIds: ids }),

  advanceStep: () => {
    const next = get().currentStep + 1;
    if (next > 35) {
      set({ screen: 'output' });
    } else {
      set({ currentStep: next });
    }
  },

  goBack: () => {
    const prev = get().currentStep - 1;
    if (prev < 0) {
      set({ screen: 'welcome' });
    } else {
      set({ currentStep: prev });
    }
  },

  setSessionId: (id) => set({ sessionId: id }),
  setOutputResults: (results) => set({ outputResults: results }),
  setIsSearching: (val) => set({ isSearching: val }),
  setSelectedCarousel: (id) => set({ selectedCarousel: id }),

  pushToHistory: () => {
    const { outputResults, selectedCarousel, outputHistory } = get();
    set({ outputHistory: [...outputHistory, { results: outputResults, selected: selectedCarousel }] });
  },

  popHistory: () => {
    const history = [...get().outputHistory];
    const prev = history.pop();
    if (prev) {
      set({
        outputResults: prev.results,
        selectedCarousel: prev.selected,
        outputHistory: history,
      });
    }
  },

  appendOutputResults: (additional) => {
    set({ outputResults: [...get().outputResults, ...additional] });
  },

  jumpToQuizStep: (stepIndex) => {
    set({
      screen: 'quiz',
      currentStep: stepIndex,
      updateMode: true,
      updateCategoryIndex: Math.floor(stepIndex / 3),
    });
  },

  returnToOutput: () => {
    set({ screen: 'output', updateMode: false, updateCategoryIndex: null });
  },

  updateAndReturn: () => {
    set({
      screen: 'output',
      updateMode: false,
      updateCategoryIndex: null,
      outputResults: [],
      sessionId: null,
      selectedCarousel: null,
      outputHistory: [],
    });
  },

  prepareConfirmation: () => {
    const { selectedCarousel } = get();
    if (selectedCarousel) {
      set({ selectedStyle: selectedCarousel, screen: 'confirmation' });
    }
  },

  submitConfirmation: async (name, email) => {
    set({ submitting: true, submitError: null });
    try {
      const { sessionId, selectedStyle } = get();
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, name, email, selected: selectedStyle }),
      });
      if (res.ok) {
        set({ submitted: true, submitting: false });
      } else {
        set({ submitting: false, submitError: 'submit_failed' });
      }
    } catch {
      set({ submitting: false, submitError: 'submit_failed' });
    }
  },
}));
