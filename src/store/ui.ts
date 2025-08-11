import { create } from 'zustand'

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
  // Modal states
  isProjectManagerOpen: boolean
  isAddEntryModalOpen: boolean
  confirmDialog: {
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    onCancel?: () => void
  } | null
  
  // Toast system
  toasts: ToastState[]
  
  // Settings
  currentProjectId: number | null
  theme: 'light' | 'dark'
  
  // Actions
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
  // Modal states
  isProjectManagerOpen: false,
  isAddEntryModalOpen: false,
  confirmDialog: null,
  
  // Toast system
  toasts: [],
  
  // Settings
  currentProjectId: null,
  theme: 'light',
  
  // Actions
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
    const id = Math.random().toString(36).substr(2, 9)
    const toast: ToastState = { id, message, type, action }
    
    set(state => ({
      toasts: [...state.toasts, toast]
    }))
    
    // Auto remove after 5 seconds unless it has an action
    if (!action) {
      setTimeout(() => {
        get().removeToast(id)
      }, 5000)
    }
  },
  
  removeToast: (id) => {
    set(state => ({
      toasts: state.toasts.filter(t => t.id !== id)
    }))
  },
  
  setCurrentProject: (projectId) => {
    set({ currentProjectId: projectId })
    // Persist to settings
    if (projectId) {
      import('../db/dexie').then(({ db }) => {
        db.settings.toCollection().first().then(settings => {
          if (settings) {
            db.settings.update(settings.id!, { lastProjectId: projectId })
          }
        })
      })
    }
  },
  
  setTheme: (theme) => {
    set({ theme })
    // Persist to settings
    import('../db/dexie').then(({ db }) => {
      db.settings.toCollection().first().then(settings => {
        if (settings) {
          db.settings.update(settings.id!, { theme })
        }
      })
    })
  }
}))