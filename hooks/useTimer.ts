
import { useState, useEffect, useRef, useCallback } from 'react';

export const useTimer = (duration: number, onComplete: () => void) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isActive, setIsActive] = useState(false);
  const timerRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsActive(false);
  }, []);
  
  const startTimer = useCallback(() => {
    stopTimer();
    setTimeLeft(duration);
    setIsActive(true);
    timerRef.current = window.setInterval(() => {
      setTimeLeft(prevTime => {
        if (prevTime <= 1) {
          stopTimer();
          onCompleteRef.current();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  }, [duration, stopTimer]);

  const resetTimer = useCallback(() => {
    stopTimer();
    setTimeLeft(duration);
  }, [duration, stopTimer]);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  return { timeLeft, isActive, startTimer, stopTimer, resetTimer };
};
