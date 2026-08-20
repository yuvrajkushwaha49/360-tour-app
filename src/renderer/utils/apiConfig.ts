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

export const CLOUDFRONT_DOMAIN = 'd23x4xy9audncu.cloudfront.net';

// Automatically transform S3 direct URLs into high-speed CloudFront CDN URLs
export function toCloudFrontUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;
  if (!CLOUDFRONT_DOMAIN) return url;
  
  // Transforms https://<bucket>.s3.<region>.amazonaws.com/<key> -> https://<cloudfront>/<key>
  return url.replace(
    /^https:\/\/[a-zA-Z0-9._-]+\.s3[a-zA-Z0-9._-]*\.amazonaws\.com\//,
    `https://${CLOUDFRONT_DOMAIN}/`
  );
}
