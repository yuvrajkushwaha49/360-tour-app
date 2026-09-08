// Live AWS Server IP
export const AWS_SERVER_URL = 'http://35.154.65.44';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const port = window.location.port;
    // When running in dev mode on localhost or local Wi-Fi network (port 5173 or LAN IP), connect to AWS backend
    if (port === '5173' || hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
      return AWS_SERVER_URL;
    }
    // When running in production on AWS server (port 80/443), use relative URL handled by Nginx
    if (hostname === '35.154.65.44') {
      return '';
    }
  }
  return AWS_SERVER_URL;
}

export const API_BASE_URL = getApiBaseUrl();

export const CLOUDFRONT_DOMAIN = 'd23x4xy9audncu.cloudfront.net';

// Automatically transform S3 direct URLs & local upload paths into pure CloudFront CDN URLs
export function toCloudFrontUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;
  if (!CLOUDFRONT_DOMAIN) return url;
  
  // If it's already a full CloudFront URL, return it
  if (url.startsWith(`https://${CLOUDFRONT_DOMAIN}`)) {
    return url;
  }

  // If it's a relative /uploads/ path, prepend CloudFront domain
  if (url.startsWith('/uploads/')) {
    return `https://${CLOUDFRONT_DOMAIN}${url}`;
  }
  if (url.startsWith('uploads/')) {
    return `https://${CLOUDFRONT_DOMAIN}/${url}`;
  }

  // Transforms https://<bucket>.s3.<region>.amazonaws.com/<key> -> https://<cloudfront>/<key>
  return url.replace(
    /^https:\/\/[a-zA-Z0-9._-]+\.s3[a-zA-Z0-9._-]*\.amazonaws\.com\//,
    `https://${CLOUDFRONT_DOMAIN}/`
  );
}
