const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

/**
 * Get the CDN base URL for assets (without trailing slash)
 * Defaults to cdn.octanerpg.com in production, localhost in dev
 */
function getAssetBaseUrl() {
  const raw = process.env.ASSET_BASE_URL || process.env.API_URL || 'http://localhost:3000';
  return String(raw).replace(/\/+$/, '');
}

/**
 * Get local asset path (for development/fallback only)
 */
function getLocalAssetPath(assetPath) {
  const p = normalizeAssetPath(assetPath);
  return path.join(__dirname, '..', 'assets', p);
}

/**
 * Normalize asset path to remove common prefixes
 * Examples:
 *   'vehicles/foo.png' -> 'vehicles/foo.png'
 *   '/assets/vehicles/foo.png' -> 'vehicles/foo.png'
 */
function normalizeAssetPath(assetPath) {
  if (!assetPath) return '';
  let p = String(assetPath).trim();
  // Remove leading slashes and 'assets/' prefix
  p = p.replace(/^\/+/, '');
  if (p.startsWith('assets/')) p = p.slice('assets/'.length);
  return p;
}

/**
 * Get CDN URL for an asset with optional image resizing
 * @param {string} assetPath - Asset path (e.g., 'vehicles/2020_audi_r8.png' or 'carmeet.png')
 * @param {Object} options - Optional image sizing parameters
 * @param {number} options.width - Target width in pixels
 * @param {number} options.height - Target height in pixels
 * @param {string} options.fit - Fit mode: 'scale-down', 'contain', 'cover', 'crop', 'pad'
 * @param {string} options.format - Output format: 'auto', 'webp', 'avif', 'json', 'jpeg', 'png'
 * @returns {string} Full CDN URL
 * 
 * @example
 * getAssetUrl('carmeet.png') // 'https://cdn.octanerpg.com/carmeet.png'
 * getAssetUrl('carmeet.png', { width: 400 }) // Plain URL (resizing disabled by default)
 * 
 * Note: Cloudflare Image Resizing requires a paid plan ($20/mo). 
 * Set ENABLE_IMAGE_RESIZING=true in .env to enable.
 */
function getAssetUrl(assetPath, options = {}) {
  const base = getAssetBaseUrl();
  const p = normalizeAssetPath(assetPath);
  
  // If using CDN (cdn.octanerpg.com), assets are at root level
  // If using backend API (localhost or api subdomain), assets are at /assets/
  const isCDN = base.includes('cdn.');
  const baseUrl = isCDN ? `${base}/${p}` : `${base}/assets/${p}`;
  
  // Check if image resizing is enabled (requires Cloudflare paid plan)
  const resizingEnabled = String(process.env.ENABLE_IMAGE_RESIZING || 'false').toLowerCase() === 'true';
  
  // If no sizing options, not using CDN, or resizing disabled, return plain URL
  if (!isCDN || !resizingEnabled || (!options.width && !options.height && !options.fit && !options.format)) {
    return baseUrl;
  }
  
  // Build Cloudflare Image Resizing parameters (Pro plan or higher required)
  const params = [];
  if (options.width) params.push(`width=${options.width}`);
  if (options.height) params.push(`height=${options.height}`);
  if (options.fit) params.push(`fit=${options.fit}`);
  params.push(`format=${options.format || 'auto'}`);
  
  // Cloudflare Image Resizing URL format
  return `${base}/cdn-cgi/image/${params.join(',')}/${p}`;
}

const bufferCache = new Map();

/**
 * @deprecated Use getAssetUrl() and embed images by URL instead
 * Fetch asset as buffer (legacy function for backwards compatibility)
 */
async function getAssetBuffer(assetPath, options = {}) {
  const p = normalizeAssetPath(assetPath);
  if (!p) throw new Error('assetLoader: missing assetPath');

  const cacheKey = p;
  if (!options.noCache && bufferCache.has(cacheKey)) {
    return bufferCache.get(cacheKey);
  }

  // Try local file first if preferLocal is set
  if (options.preferLocal) {
    try {
      const localPath = getLocalAssetPath(p);
      const buf = await fs.readFile(localPath);
      if (!options.noCache) bufferCache.set(cacheKey, buf);
      return buf;
    } catch (localErr) {
      // Fall through to API fetch
    }
  }

  // Try API/CDN fetch
  try {
    const url = getAssetUrl(p);
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: options.timeoutMs ?? 5000,
      validateStatus: () => true,
    });

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`assetLoader: failed to fetch ${url} (status=${res.status})`);
    }

    const buf = Buffer.from(res.data);
    if (!options.noCache) bufferCache.set(cacheKey, buf);
    return buf;
  } catch (apiErr) {
    // Fallback to local file if API/CDN fails
    if (!options.preferLocal) {
      try {
        const localPath = getLocalAssetPath(p);
        const buf = await fs.readFile(localPath);
        if (!options.noCache) bufferCache.set(cacheKey, buf);
        return buf;
      } catch (localErr) {
        throw new Error(`assetLoader: failed both CDN/API (${apiErr.message}) and local (${localErr.message})`);
      }
    }
    throw apiErr;
  }
}

/**
 * @deprecated Use getAssetUrl() instead
 */
async function getAssetText(assetPath, options = {}) {
  const buf = await getAssetBuffer(assetPath, options);
  return buf.toString(options.encoding || 'utf8');
}

module.exports = {
  getAssetBaseUrl,
  getAssetUrl,
  getAssetBuffer, // Deprecated - use getAssetUrl() instead
  getAssetText, // Deprecated - use getAssetUrl() instead
  getLocalAssetPath,
};
