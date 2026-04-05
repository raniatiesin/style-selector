import { create } from 'zustand';
import { MAX_VISIBLE_STEP_INDEX, STEPS_PER_STAGE } from '../config/questionTree';

let bootstrapSessionPromise = null;

export const useQuizStore = create((set, get) => ({
  // --- Navigation ---
  screen: 'welcome', // 'welcome' | 'quiz' | 'output' | 'confirmation'
  welcomePanel: 'hero', // 'hero' | 'faq'
  welcomePanelAnimating: false,

  // --- Quiz ---
  currentStep: 0, // 0–MAX_VISIBLE_STEP_INDEX
  answers: {}, // { [stepIndex]: tagString }
  activeImageIds: [], // 60 style IDs for background

  // --- Output ---
  handle: null, // URL handle from /@{handle}, nullable
  sessionId: null, // uuid from /api/search — links to Supabase sessions row
  sessionReady: false,
  sessionError: null,
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
    const answers = { ...get().answers };
    if (value == null) {
      delete answers[stepIndex];
    } else {
      answers[stepIndex] = value;
    }
    set({ answers });
  },

  setActiveImageIds: (ids) => set({ activeImageIds: ids }),

  advanceStep: () => {
    const next = get().currentStep + 1;
    if (next > MAX_VISIBLE_STEP_INDEX) {
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

  setHandle: (handle) => set({ handle: handle || null }),
  setSessionId: (id) => set({ sessionId: id }),
  bootstrapSession: async (handle) => {
    const normalizedHandle = typeof handle === 'string' && handle.trim()
      ? handle.trim()
      : null;

    if (get().sessionId) {
      set({
        handle: normalizedHandle,
        sessionReady: true,
        sessionError: null,
      });
      return get().sessionId;
    }

    if (bootstrapSessionPromise) {
      return bootstrapSessionPromise;
    }

    set({
      handle: normalizedHandle,
      sessionReady: false,
      sessionError: null,
    });

    bootstrapSessionPromise = (async () => {
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'initSession',
            handle: normalizedHandle,
          }),
        });

        if (!res.ok) {
          throw new Error('Session init failed');
        }

        const data = await res.json();
        const nextId = data?.sessionId || null;

        if (!nextId) {
          throw new Error('Session init missing id');
        }

        set({
          sessionId: nextId,
          sessionReady: true,
          sessionError: null,
        });
        return nextId;
      } catch (err) {
        console.error('Session bootstrap failed:', err);
        set({
          sessionReady: false,
          sessionError: 'session_init_failed',
        });
        return null;
      } finally {
        bootstrapSessionPromise = null;
      }
    })();

    return bootstrapSessionPromise;
  },
  ensureSession: async () => {
    const current = get().sessionId;
    if (current) return current;
    return get().bootstrapSession(get().handle);
  },
  updateSessionProgress: async (patch = {}) => {
    const sessionId = get().sessionId;
    if (!sessionId) {
      return false;
    }

    const body = {
      action: 'updateSession',
      sessionId,
      ...patch,
    };

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return res.ok;
    } catch (err) {
      console.error('Session progress update failed:', err);
      return false;
    }
  },
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
      updateCategoryIndex: Math.floor(stepIndex / STEPS_PER_STAGE),
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
      const ensuredSessionId = await get().ensureSession();
      if (!ensuredSessionId) {
        throw new Error('Missing session id');
      }

      const { selectedStyle, handle } = get();
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: ensuredSessionId,
          handle: handle ?? null,
          name,
          email,
          selected: selectedStyle,
        }),
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
