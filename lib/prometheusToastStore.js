let currentMessage = '';
const listeners = new Set();

export const reportPrometheusError = (message) => {
  if (!message) return;
  if (message === currentMessage) return;
  currentMessage = message;
  listeners.forEach((listener) => listener(currentMessage));
};

export const clearPrometheusError = () => {
  if (!currentMessage) return;
  currentMessage = '';
  listeners.forEach((listener) => listener(currentMessage));
};

export const subscribeToPrometheusErrors = (listener) => {
  listeners.add(listener);
  listener(currentMessage);
  return () => {
    listeners.delete(listener);
  };
};
