import { useCallback } from 'react';

export function useFeedback() {
  const playClick = useCallback(() => {
    // Vibration for mobile devices
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(10); // Short vibration
      } catch (e) {
        // Ignore vibration errors
      }
    }

    // Audio feedback
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
      audio.volume = 0.2;
      audio.play().catch(() => {
        // Ignore audio play errors (often blocked by browser until user interaction)
      });
    } catch (e) {
      // Ignore audio errors
    }
  }, []);

  const playSuccess = useCallback(() => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([20, 50, 20]); // Double short vibration
      } catch (e) {
        // Ignore
      }
    }

    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (e) {
      // Ignore
    }
  }, []);

  const playError = useCallback(() => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(200); // Longer vibration for error
      } catch (e) {
        // Ignore
      }
    }

    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (e) {
      // Ignore
    }
  }, []);

  return { playClick, playSuccess, playError };
}
