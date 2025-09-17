// src/utils/audioManager.ts

/**
 * A simple manager to hold a reference to the global audio element
 * so that it can be controlled from outside the React component tree (e.g., from a Zustand store).
 */
export const audioManager = {
    element: null as HTMLAudioElement | null,
    unlocked: false,
  
    /**
     * "Unlocks" audio playback on mobile browsers. This must be called from a user
     * interaction event (e.g., a click or tap). It plays and immediately pauses
     * the audio to satisfy browser security policies.
     */
    unlock: () => {
      if (audioManager.element && !audioManager.unlocked) {
        console.log('Unlocking audio...');
        audioManager.element.play().catch(() => { /* Ignore potential error */ });
        audioManager.element.pause();
        audioManager.unlocked = true;
      }
    },
  
    /**
     * Plays the audio element. Catches and logs potential errors,
     * as browsers can sometimes block programmatic audio playback.
     */
    play: () => {
      // The play() method returns a Promise which can be rejected.
      // We catch it to prevent unhandled promise rejection errors.
      audioManager.element?.play().catch(error => {
        console.error("Audio playback failed:", error);
      });
    },
  
    /**
     * Pauses the audio element.
     */
    pause: () => {
      audioManager.element?.pause();
    },
  };