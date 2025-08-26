import { create } from 'zustand'
import { db } from '../db/dexie' // Keep the static import

interface ToastState {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  action?: {
    label: string
    onClick: () => void
  }
}

interface UIState {
  isProjectManagerOpen: boolean
  isAddEntryModalOpen: boolean
  confirmDialog: {
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    onCancel?: () => void
  } | null
  toasts: ToastState[]
  currentProjectId: number | null
  theme: 'light' | 'dark'
  openProjectManager: () => void
  closeProjectManager: () => void
  openAddEntryModal: () => void
  closeAddEntryModal: () => void
  showConfirm: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => void
  hideConfirm: () => void
  showToast: (message: string, type?: 'success' | 'error' | 'info', action?: { label: string; onClick: () => void }) => void
  removeToast: (id: string) => void
  setCurrentProject: (projectId: number | null) => void
  setTheme: (theme: 'light' | 'dark') => void
}

export const useUIStore = create<UIState>((set, get) => ({
  isProjectManagerOpen: false,
  isAddEntryModalOpen: false,
  confirmDialog: null,
  toasts: [],
  currentProjectId: null,
  theme: 'light',
  
  openProjectManager: () => set({ isProjectManagerOpen: true }),
  closeProjectManager: () => set({ isProjectManagerOpen: false }),
  
  openAddEntryModal: () => set({ isAddEntryModalOpen: true }),
  closeAddEntryModal: () => set({ isAddEntryModalOpen: false }),
  
  showConfirm: (title, message, onConfirm, onCancel) => {
    set({
      confirmDialog: {
        isOpen: true,
        title,
        message,
        onConfirm,
        onCancel
      }
    })
  },
  
  hideConfirm: () => set({ confirmDialog: null }),
  
  showToast: (message, type = 'info', action) => {
    const id = Math.random().toString(36).substr(2, 9);
    const toast: ToastState = { id, message, type, action };
    
    set(state => ({
      toasts: [...state.toasts, toast]
    }));
    
    if (!action) {
      setTimeout(() => {
        get().removeToast(id);
      }, 5000);
    }
  },
  
  removeToast: (id) => {
    set(state => ({
      toasts: state.toasts.filter(t => t.id !== id)
    }));
  },
  
  // FIX: Added the parameter types back
  setCurrentProject: (projectId: number | null) => {
    set({ currentProjectId: projectId });
    if (projectId) {
      db.settings.toCollection().first().then(settings => {
        if (settings) {
          db.settings.update(settings.id!, { lastProjectId: projectId });
        }
      });
    }
  },
  
  // FIX: Added the parameter types back
  setTheme: (theme: 'light' | 'dark') => {
    set({ theme });
    db.settings.toCollection().first().then(settings => {
      if (settings) {
        db.settings.update(settings.id!, { theme });
      }
    });
  }
}));