// Live AWS Server IP
export const AWS_SERVER_URL = 'http://35.154.65.44';

// Dynamic API Base URL resolver: connects to AWS live server from both cloud and localhost
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // When running directly on the AWS web server domain/IP, use relative URL (Nginx handles proxying)
    if (hostname === '35.154.65.44' || (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && !window.location.protocol.startsWith('file'))) {
      return '';
    }
  }
  // When running on localhost (Local PC / Electron / Vite Dev Server), connect to live AWS database & API
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
