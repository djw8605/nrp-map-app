export const fetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) {
        message = typeof body.error === 'string' ? body.error : body.error.message || message;
      }
    } catch (parseError) {
      // Ignore parse errors and keep default message.
    }
    throw new Error(message);
  }
  return res.json();
};
