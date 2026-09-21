const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * Download a publicly shared Google Drive file straight into the staging folder.
 *
 * A share link ("drive.google.com/file/d/<id>/view") is a viewer page, not the
 * file. The file itself comes from drive.usercontent.google.com with
 * `confirm=t`, which skips the "Google Drive can't scan this file for viruses"
 * page Google shows instead of the file for anything over roughly 100 MB.
 *
 * Google answers with an HTML page rather than the file in two situations:
 * the file is not shared publicly, or it has hit Drive's download quota ("Too
 * many users have viewed or downloaded this file recently", which locks it for
 * about a day). Both are reported as `html` so the caller can open the Drive
 * page in the browser, where the user sees Google's own explanation.
 *
 * Only the author-sanctioned files listed in Getting Started go through this.
 */

const ALLOWED_EXT = /\.(zip|rar|7z)$/i;
const MAX_REDIRECTS = 6;

function directUrl(fileId) {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
}

/** Filename from Content-Disposition, preferring the RFC 5987 UTF-8 form. */
function filenameFrom(disposition) {
  if (!disposition) return null;
  const star = disposition.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/);
  if (star) { try { return decodeURIComponent(star[1].trim()); } catch { /* fall through */ } }
  const plain = disposition.match(/filename\s*=\s*"?([^";]+)"?/);
  return plain ? plain[1].trim() : null;
}

/** A name that is safe to create inside the staging folder, or null. */
function safeName(name) {
  const base = path.basename(String(name || '')).replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim();
  return base && ALLOWED_EXT.test(base) ? base : null;
}

function request(url, redirects = 0, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'RealTCGOverhaulModManager', Accept: '*/*', ...extraHeaders },
      timeout: 30000,
    }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        if (redirects >= MAX_REDIRECTS) return reject(new Error('Too many redirects'));
        const next = new URL(res.headers.location, url).href;
        return resolve(request(next, redirects + 1, extraHeaders));
      }
      resolve(res);
    });
    req.on('timeout', () => req.destroy(new Error('Timed out connecting to Google Drive')));
    req.on('error', reject);
  });
}

/**
 * First bytes of each archive format we accept. Checked on the downloaded file
 * itself, because a file saved under our own name (saveAs) no longer has
 * Google's filename vouching for what it is.
 */
const MAGIC = [
  { ext: 'zip', bytes: [0x50, 0x4b, 0x03, 0x04] },          // PK\x03\x04
  { ext: 'zip', bytes: [0x50, 0x4b, 0x05, 0x06] },          // empty zip
  { ext: '7z',  bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
  { ext: 'rar', bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07] }, // Rar!\x1a\x07
];
function archiveKind(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const head = Buffer.alloc(8);
    fs.readSync(fd, head, 0, 8, 0);
    const hit = MAGIC.find(m => m.bytes.every((b, i) => head[i] === b));
    return hit ? hit.ext : null;
  } finally { fs.closeSync(fd); }
}

/**
 * @param {string} fileId      Drive file id
 * @param {string} stagingDir  destination folder
 * @param {{saveAs?:string, fallbackName?:string}} names
 *   saveAs       the filename to store it under, overriding Google's. Lets a
 *                listing give the archive a versioned name the parser can read.
 *   fallbackName used only when Google sends no filename and there is no saveAs
 * @param {(done:number,total:number)=>void} onProgress
 * @returns {Promise<{filename:string, bytes:number}>}
 */
async function downloadDriveFile(fileId, stagingDir, names = {}, onProgress) {
  if (typeof names === 'string') names = { fallbackName: names };   // older callers
  const { saveAs, fallbackName } = names;
  if (!/^[A-Za-z0-9_-]{10,}$/.test(String(fileId || ''))) throw new Error('Invalid Google Drive file id');
  fs.mkdirSync(stagingDir, { recursive: true });

  const res = await request(directUrl(fileId));
  if (res.statusCode !== 200) {
    res.resume();
    throw Object.assign(new Error(`Google Drive answered HTTP ${res.statusCode}`), { code: 'http' });
  }
  // An HTML body means Google sent a page, not the file: quota exceeded or
  // not shared publicly.
  if (/text\/html/i.test(String(res.headers['content-type'] || ''))) {
    res.resume();
    throw Object.assign(new Error('Google Drive did not return the file'), { code: 'html' });
  }

  // If Google names the file as something that is not an archive, refuse
  // outright — whatever name we would have saved it under.
  const served = filenameFrom(res.headers['content-disposition']);
  if (served && !safeName(served)) {
    res.resume();
    throw Object.assign(new Error(`The download is not a .zip, .rar or .7z archive (got "${path.basename(served)}")`), { code: 'type' });
  }
  // Our own name wins when given; then Google's; then the fallback, which is
  // only ever for a response that names no file at all.
  const name = safeName(saveAs) || (served ? safeName(served) : safeName(fallbackName));
  if (!name) {
    res.resume();
    throw Object.assign(new Error('No usable archive filename'), { code: 'type' });
  }

  const total = Number(res.headers['content-length']) || 0;
  const finalPath = path.join(stagingDir, name);
  // Write to a temporary name so the staging watcher never picks up, and the
  // user never installs, a half-downloaded archive.
  const partPath = `${finalPath}.part`;

  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(partPath);
    let done = 0, lastTick = 0;
    res.on('data', chunk => {
      done += chunk.length;
      const now = Date.now();
      if (onProgress && now - lastTick > 150) { lastTick = now; try { onProgress(done, total); } catch {} }
    });
    res.on('error', err => { out.destroy(); reject(err); });
    out.on('error', reject);
    out.on('finish', () => { try { onProgress?.(done, total); } catch {} resolve(); });
    res.pipe(out);
  }).catch(err => { try { fs.unlinkSync(partPath); } catch {} throw err; });

  const bytes = fs.statSync(partPath).size;
  if (total && bytes !== total) {
    try { fs.unlinkSync(partPath); } catch {}
    throw Object.assign(new Error('Download was incomplete'), { code: 'incomplete' });
  }
  // The name on disk is now ours, so prove the contents really are an archive.
  // This also catches a Drive file that was swapped for something else.
  const kind = archiveKind(partPath);
  if (!kind) {
    try { fs.unlinkSync(partPath); } catch {}
    throw Object.assign(new Error('The downloaded file is not a valid archive'), { code: 'type' });
  }
  // Name the file after what it actually IS. Extraction picks its method from
  // the extension, so a RAR saved as ".zip" would reach the zip extractor and
  // fail to install. saveAs chooses the name; the contents choose the extension.
  const realName = name.replace(/\.(zip|rar|7z)$/i, `.${kind}`);
  const realPath = path.join(stagingDir, realName);
  fs.renameSync(partPath, realPath);
  return { filename: realName, bytes, format: kind };
}

/**
 * Size of a Drive file in bytes, without downloading it.
 *
 * Asks for a single byte. A server that supports ranges answers 206 with
 * "Content-Range: bytes 0-0/<total>", which carries the full size; one that
 * does not answers 200 with the whole file's Content-Length, which also
 * carries it — the body is abandoned immediately either way. Returns null when
 * Google answers with a page (quota, sharing changed) or no size at all.
 */
async function driveFileSize(fileId) {
  if (!/^[A-Za-z0-9_-]{10,}$/.test(String(fileId || ''))) return null;
  const res = await request(directUrl(fileId), 0, { Range: 'bytes=0-0' });
  try {
    if (/text\/html/i.test(String(res.headers['content-type'] || ''))) return null;
    const range = String(res.headers['content-range'] || '').match(/\/(\d+)\s*$/);
    if (res.statusCode === 206 && range) return Number(range[1]);
    const len = Number(res.headers['content-length']);
    return res.statusCode === 200 && len > 1 ? len : null;
  } finally {
    res.destroy();   // never read the body
  }
}

module.exports = { downloadDriveFile, driveFileSize, directUrl, filenameFrom, safeName, archiveKind };
