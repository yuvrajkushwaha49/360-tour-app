// Dynamic API Base URL resolver
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // On AWS / Web Server, use relative URL (Nginx handles proxying to port 5000)
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && !window.location.protocol.startsWith('file')) {
      return '';
    }
  }
  return 'http://localhost:5000';
}

export const API_BASE_URL = getApiBaseUrl();
