import { useCallback } from 'react';

// Pre-create audio instances outside the hook so they are singletons and preloaded.
// This prevents severe lag on mobile devices caused by instantiating new Audio objects on every tap.
const clickAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
clickAudio.volume = 0.4; // Increased volume for better desktop feedback
clickAudio.preload = 'auto';

const successAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
successAudio.volume = 0.5;
successAudio.preload = 'auto';

const errorAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3');
errorAudio.volume = 0.5;
errorAudio.preload = 'auto';

export function useFeedback() {
  const playClick = useCallback(() => {
    // Vibration for mobile devices - stronger for better tactile response
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(25); // 25ms is a very noticeable, solid click
      } catch (e) {
        // Ignore vibration errors
      }
    }

    // Audio feedback
    try {
      clickAudio.currentTime = 0; // Reset to start for rapid clicking
      const playPromise = clickAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Ignore audio play errors (often blocked by browser until user interaction)
        });
      }
    } catch (e) {
      // Ignore audio errors
    }
  }, []);

  const playSuccess = useCallback(() => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([40, 60, 40]); // Stronger double distinct vibration
      } catch (e) {
        // Ignore
      }
    }

    try {
      successAudio.currentTime = 0;
      const playPromise = successAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    } catch (e) {
      // Ignore
    }
  }, []);

  const playError = useCallback(() => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([60, 60, 60, 60]); // Stronger stutter vibration for error
      } catch (e) {
        // Ignore
      }
    }

    try {
      errorAudio.currentTime = 0;
      const playPromise = errorAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    } catch (e) {
      // Ignore
    }
  }, []);

  return { playClick, playSuccess, playError };
}
