import { useEffect, useState } from 'react';
import PrometheusErrorToast from './prometheusErrorToast';
import {
  clearPrometheusError,
  subscribeToPrometheusErrors,
} from '../lib/prometheusToastStore';

export default function PrometheusErrorToastHost() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    return subscribeToPrometheusErrors((nextMessage) => {
      setMessage(nextMessage || '');
    });
  }, []);

  return (
    <PrometheusErrorToast
      message={message}
      onDismiss={() => {
        clearPrometheusError();
      }}
    />
  );
}
