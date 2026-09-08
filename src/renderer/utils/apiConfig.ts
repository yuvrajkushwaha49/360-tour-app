// Live AWS Server IP
export const AWS_SERVER_URL = 'http://35.154.65.44';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const port = window.location.port;
    const protocol = window.location.protocol;

    // 1. If loaded over HTTPS (e.g., https://virtual.kalaakchar.in or any SSL custom domain),
    // always use relative URL so all requests stay pure HTTPS via Nginx reverse proxy.
    // This prevents Mixed Content security blocks by browsers.
    if (protocol === 'https:') {
      return '';
    }

    // 2. When running in local Vite dev server on localhost or local Wi-Fi LAN (port 5173 or custom dev ports),
    // forward API requests to the live AWS backend server.
    if (port === '5173' || port === '3000' || (port && port !== '80' && port !== '443' && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')))) {
      return AWS_SERVER_URL;
    }

    // 3. In production (port 80/443 or any custom domain/IP served by Nginx), use relative URL handled by Nginx
    return '';
  }
  return AWS_SERVER_URL;
}

export const API_BASE_URL = getApiBaseUrl();

export const CLOUDFRONT_DOMAIN = 'd23x4xy9audncu.cloudfront.net';

// Automatically transform S3 direct URLs & local upload paths into pure CloudFront CDN URLs
export function toCloudFrontUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;

  // Clean any explicit insecure IP upload prefix
  if (url.startsWith('http://35.154.65.44/uploads/')) {
    url = url.replace('http://35.154.65.44/uploads/', '/uploads/');
  }

  if (!CLOUDFRONT_DOMAIN) return url;
  
  // If it's already a full CloudFront URL, return it
  if (url.startsWith(`https://${CLOUDFRONT_DOMAIN}`)) {
    return url;
  }

  // If it's a relative /uploads/ path, prepend CloudFront domain (always HTTPS)
  if (url.startsWith('/uploads/')) {
    return `https://${CLOUDFRONT_DOMAIN}${url}`;
  }
  if (url.startsWith('uploads/')) {
    return `https://${CLOUDFRONT_DOMAIN}/${url}`;
  }

  // Transforms http:// or https://<bucket>.s3.<region>.amazonaws.com/<key> -> https://<cloudfront>/<key>
  return url.replace(
    /^https?:\/\/[a-zA-Z0-9._-]+\.s3[a-zA-Z0-9._-]*\.amazonaws\.com\//,
    `https://${CLOUDFRONT_DOMAIN}/`
  );
}
