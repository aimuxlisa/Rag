const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  let contents;

  try {
    contents = fs.readFileSync(envPath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('Не удалось прочитать .env:', error.message);
    return;
  }

  contents.split(/\r?\n/).forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) return;

    const match = trimmedLine.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) return;

    const [, name, rawValue] = match;
    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }

    if (process.env[name] === undefined) process.env[name] = value;
  });
}

loadEnvFile();

let PORT = parseInt(process.env.PORT, 10) || 8080;
const BASE_DIR = __dirname;
const MAX_GEMINI_REQUEST_BYTES = 2 * 1024 * 1024;
const MAX_GDRIVE_SYNC_REQUEST_BYTES = 16 * 1024;
const MAX_GDRIVE_FILE_BYTES = 12 * 1024 * 1024;
const GOOGLE_DRIVE_READ_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const GOOGLE_DRIVE_WRITE_SCOPE = 'https://www.googleapis.com/auth/drive';
let serviceAccountCredentials = null;
const driveAccessTokens = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const MAX_DOCX_BYTES = 12 * 1024 * 1024;
const MAX_DOCX_TEXT_BYTES = 10 * 1024 * 1024;

function decodeXmlText(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, code) => {
    if (code[0] === '#') {
      const isHex = code[1].toLowerCase() === 'x';
      const point = Number.parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
    }

    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[code.toLowerCase()] || entity;
  });
}

function extractDocxText(buffer) {
  const searchStart = Math.max(0, buffer.length - 65557);
  let eocdOffset = -1;

  for (let offset = buffer.length - 22; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset < 0) throw new Error('Файл не является корректным документом DOCX');
  if (buffer.readUInt16LE(eocdOffset + 4) !== 0 || buffer.readUInt16LE(eocdOffset + 6) !== 0) {
    throw new Error('Многочастные ZIP-файлы не поддерживаются');
  }

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  let offset = buffer.readUInt32LE(eocdOffset + 16);
  if (entryCount === 0xffff || centralDirectorySize === 0xffffffff || offset === 0xffffffff) {
    throw new Error('DOCX-файл с ZIP64 не поддерживается');
  }
  if (offset + centralDirectorySize > eocdOffset) throw new Error('Повреждён ZIP-каталог документа');

  let documentXml = null;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Повреждён ZIP-каталог документа');
    }

    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const entryEnd = offset + 46 + fileNameLength + extraLength + commentLength;
    if (entryEnd > buffer.length) throw new Error('Повреждён ZIP-каталог документа');

    const fileName = buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength);
    if (fileName === 'word/document.xml') {
      if (flags & 1) throw new Error('Зашифрованные DOCX-файлы не поддерживаются');
      if (uncompressedSize > MAX_DOCX_TEXT_BYTES) throw new Error('Текст документа превышает 10 МБ');
      if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) {
        throw new Error('Повреждён основной текст документа');
      }

      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const dataEnd = dataOffset + compressedSize;
      if (dataEnd > buffer.length) throw new Error('Повреждён основной текст документа');

      const compressed = buffer.subarray(dataOffset, dataEnd);
      if (method === 0) documentXml = compressed;
      else if (method === 8) documentXml = zlib.inflateRawSync(compressed, { maxOutputLength: MAX_DOCX_TEXT_BYTES });
      else throw new Error('Метод сжатия DOCX не поддерживается');

      if (documentXml.length !== uncompressedSize) throw new Error('Не удалось распаковать основной текст документа');
      break;
    }

    offset = entryEnd;
  }

  if (!documentXml) throw new Error('В DOCX-файле не найден основной текст документа');

  const xml = documentXml.toString('utf8');
  return [...xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)]
    .map(([, paragraph]) => [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>/g)]
      .map(([, value]) => value === undefined ? '\t' : decodeXmlText(value))
      .join(''))
    .filter(Boolean)
    .join('\n');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function loadServiceAccountCredentials() {
  if (serviceAccountCredentials) return serviceAccountCredentials;

  let keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE
    ? path.resolve(BASE_DIR, process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE)
    : null;

  if (!keyPath) {
    const secretsDir = path.join(BASE_DIR, 'secrets');
    let jsonFiles;
    try {
      jsonFiles = fs.readdirSync(secretsDir).filter(name => name.toLowerCase().endsWith('.json'));
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Не найдена папка secrets с JSON-ключом Service Account');
      }
      throw error;
    }

    if (jsonFiles.length !== 1) {
      throw new Error('В папке secrets должен находиться один JSON-ключ Service Account');
    }
    keyPath = path.join(secretsDir, jsonFiles[0]);
  }

  const relativePath = path.relative(path.join(BASE_DIR, 'secrets'), keyPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('JSON-ключ Service Account должен находиться внутри папки secrets');
  }

  let credentials;
  try {
    credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('JSON-ключ Service Account не найден');
    throw new Error('Не удалось прочитать JSON-ключ Service Account');
  }

  if (credentials.type !== 'service_account' || !credentials.client_email || !credentials.private_key) {
    throw new Error('Файл в secrets не похож на JSON-ключ Service Account');
  }

  serviceAccountCredentials = credentials;
  return serviceAccountCredentials;
}

async function getDriveAccessToken(scope = GOOGLE_DRIVE_READ_SCOPE) {
  const cachedToken = driveAccessTokens.get(scope);
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token;

  const credentials = loadServiceAccountCredentials();
  const issuedAt = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsignedToken = [
    encode({ alg: 'RS256', typ: 'JWT' }),
    encode({
      iss: credentials.client_email,
      scope,
      aud: 'https://oauth2.googleapis.com/token',
      iat: issuedAt,
      exp: issuedAt + 3600
    })
  ].join('.');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();
  const assertion = `${unsignedToken}.${signer.sign(credentials.private_key, 'base64url')}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  const tokenData = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenData.access_token) {
    const message = tokenData.error_description || tokenData.error || `HTTP ${tokenResponse.status}`;
    throw new Error(`Google не выдал токен Service Account: ${message}`);
  }

  const token = {
    token: tokenData.access_token,
    expiresAt: Date.now() + Number(tokenData.expires_in || 3600) * 1000
  };
  driveAccessTokens.set(scope, token);
  return token.token;
}

function extractDriveFolderId(input) {
  const value = String(input || '').trim();
  const fromLink = value.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  const folderId = fromLink ? fromLink[1] : value.split(/[?#]/, 1)[0];
  return /^[a-zA-Z0-9_-]+$/.test(folderId) ? folderId : '';
}

async function readDriveError(response) {
  const error = await response.json().catch(() => ({}));
  return error.error?.message || `Google Drive API вернул HTTP ${response.status}`;
}

async function downloadDriveFolder(folderId, accessToken) {
  const files = [];
  let pageToken = '';
  do {
    const listUrl = new URL('https://www.googleapis.com/drive/v3/files');
    listUrl.searchParams.set('q', `'${folderId}' in parents and trashed = false`);
    listUrl.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType)');
    listUrl.searchParams.set('pageSize', '1000');
    listUrl.searchParams.set('supportsAllDrives', 'true');
    listUrl.searchParams.set('includeItemsFromAllDrives', 'true');
    if (pageToken) listUrl.searchParams.set('pageToken', pageToken);

    const listResponse = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!listResponse.ok) throw new Error(await readDriveError(listResponse));
    const listData = await listResponse.json();
    files.push(...(listData.files || []));
    pageToken = listData.nextPageToken || '';
  } while (pageToken);

  const googleDocMime = 'application/vnd.google-apps.document';
  const supportedFiles = files.filter(file =>
    /\.(txt|md|docx)$/i.test(file.name) || file.mimeType === googleDocMime
  );
  if (supportedFiles.length === 0) {
    throw new Error('В папке не найдены поддерживаемые файлы (.txt, .md, .docx или Google Docs)');
  }

  const docs = [];
  const errors = [];
  for (const file of supportedFiles) {
    try {
      const contentUrl = file.mimeType === googleDocMime
        ? new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export`)
        : new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}`);
      if (file.mimeType === googleDocMime) contentUrl.searchParams.set('mimeType', 'text/plain');
      else contentUrl.searchParams.set('alt', 'media');

      const contentResponse = await fetch(contentUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!contentResponse.ok) throw new Error(await readDriveError(contentResponse));
      const contentBuffer = Buffer.from(await contentResponse.arrayBuffer());
      if (contentBuffer.length > MAX_GDRIVE_FILE_BYTES) {
        throw new Error('Размер файла превышает 12 МБ');
      }

      const isDocx = file.mimeType !== googleDocMime && /\.docx$/i.test(file.name);
      const content = isDocx
        ? extractDocxText(contentBuffer)
        : contentBuffer.toString('utf8');
      if (!content.trim()) throw new Error('Файл не содержит текста');

      docs.push({
        id: `gdrive_${file.id}`,
        title: file.mimeType === googleDocMime ? file.name : file.name.replace(/\.[^/.]+$/, ''),
        source: `Google Drive: ${file.name}`,
        content,
        gdriveId: file.id
      });
    } catch (error) {
      errors.push(`${file.name}: ${error.message}`);
    }
  }

  if (docs.length === 0) {
    throw new Error(errors[0] || 'Не удалось прочитать документы из папки');
  }

  return { docs, errors };
}

const LOCAL_RAG_FILES = [
  { relativePath: 'knowledge/courses.txt', mimeType: 'text/plain' },
  { relativePath: 'knowledge/center_info.md', mimeType: 'text/markdown' },
  { relativePath: 'knowledge/faq.md', mimeType: 'text/markdown' }
];

async function uploadLocalKnowledgeBase(folderId, accessToken) {
  const existingFiles = [];
  let pageToken = '';
  do {
    const listUrl = new URL('https://www.googleapis.com/drive/v3/files');
    listUrl.searchParams.set('q', `'${folderId}' in parents and trashed = false`);
    listUrl.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,appProperties)');
    listUrl.searchParams.set('pageSize', '1000');
    listUrl.searchParams.set('supportsAllDrives', 'true');
    listUrl.searchParams.set('includeItemsFromAllDrives', 'true');
    if (pageToken) listUrl.searchParams.set('pageToken', pageToken);

    const listResponse = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!listResponse.ok) throw new Error(await readDriveError(listResponse));
    const listData = await listResponse.json();
    existingFiles.push(...(listData.files || []));
    pageToken = listData.nextPageToken || '';
  } while (pageToken);

  const uploaded = [];
  for (const localFile of LOCAL_RAG_FILES) {
    const absolutePath = path.join(BASE_DIR, ...localFile.relativePath.split('/'));
    const content = fs.readFileSync(absolutePath);
    if (content.length > MAX_GDRIVE_FILE_BYTES) {
      throw new Error(`${path.basename(absolutePath)} превышает лимит 12 МБ`);
    }

    const fileName = path.basename(absolutePath);
    const marker = localFile.relativePath;
    const previousFile = existingFiles.find(file => file.appProperties?.localRagPath === marker);
    const metadata = {
      name: fileName,
      mimeType: localFile.mimeType,
      appProperties: { localRagPath: marker }
    };
    if (!previousFile) metadata.parents = [folderId];

    const boundary = `rag_upload_${crypto.randomBytes(12).toString('hex')}`;
    const metadataPart = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      'utf8'
    );
    const contentPart = Buffer.from(
      `--${boundary}\r\nContent-Type: ${localFile.mimeType}\r\n\r\n`,
      'utf8'
    );
    const closingPart = Buffer.from(`\r\n--${boundary}--`, 'utf8');
    const body = Buffer.concat([metadataPart, contentPart, content, closingPart]);
    const uploadUrl = new URL(
      previousFile
        ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(previousFile.id)}`
        : 'https://www.googleapis.com/upload/drive/v3/files'
    );
    uploadUrl.searchParams.set('uploadType', 'multipart');
    uploadUrl.searchParams.set('supportsAllDrives', 'true');
    uploadUrl.searchParams.set('fields', 'id,name,mimeType,webViewLink,appProperties');

    const uploadResponse = await fetch(uploadUrl, {
      method: previousFile ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    });
    if (!uploadResponse.ok) {
      throw new Error(`${fileName}: ${await readDriveError(uploadResponse)}`);
    }

    const result = await uploadResponse.json();
    uploaded.push({ name: result.name || fileName, id: result.id, updated: Boolean(previousFile) });
  }

  return uploaded;
}

function isLocalDriveSyncRequest(req) {
  const getHostname = value => {
    try { return new URL(value.includes('://') ? value : `http://${value}`).hostname.toLowerCase(); }
    catch { return ''; }
  };
  const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (!loopbackHosts.has(getHostname(req.headers.host || ''))) return false;
  if (req.headers.origin && !loopbackHosts.has(getHostname(req.headers.origin))) return false;
  return true;
}

function handleGDriveSyncRequest(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'POST' });
    res.end(JSON.stringify({ error: { message: 'Используйте POST для синхронизации Google Drive' } }));
    return;
  }
  if (!isLocalDriveSyncRequest(req)) {
    sendJson(res, 403, { error: { message: 'Синхронизация Service Account доступна только с этого компьютера' } });
    req.resume();
    return;
  }

  const chunks = [];
  let receivedBytes = 0;
  req.on('data', chunk => {
    receivedBytes += chunk.length;
    if (receivedBytes > MAX_GDRIVE_SYNC_REQUEST_BYTES) {
      if (!res.writableEnded) sendJson(res, 413, { error: { message: 'Слишком большой запрос синхронизации' } });
      req.resume();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', async () => {
    if (res.writableEnded) return;
    if (receivedBytes > MAX_GDRIVE_SYNC_REQUEST_BYTES) return;

    let payload;
    try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch {
      sendJson(res, 400, { error: { message: 'Некорректный JSON в запросе' } });
      return;
    }

    const folderId = extractDriveFolderId(payload.folderId);
    if (!folderId) {
      sendJson(res, 400, { error: { message: 'Укажите корректную ссылку или ID папки Google Drive' } });
      return;
    }

    try {
      const token = await getDriveAccessToken();
      const result = await downloadDriveFolder(folderId, token);
      sendJson(res, 200, {
        success: true,
        docs: result.docs,
        folderId,
        syncedAt: new Date().toISOString(),
        warnings: result.errors
      });
    } catch (error) {
      const message = /permission|not found|access|insufficient/i.test(error.message)
        ? `Не удалось открыть папку. Проверьте, что она расшарена с Service Account как Viewer. Детали: ${error.message}`
        : error.message;
      sendJson(res, 502, { error: { message } });
    }
  });
}

function handleGDriveUploadLocalRequest(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'POST' });
    res.end(JSON.stringify({ error: { message: 'Используйте POST для загрузки локальной базы знаний' } }));
    return;
  }
  if (!isLocalDriveSyncRequest(req)) {
    sendJson(res, 403, { error: { message: 'Загрузка локальных файлов доступна только с этого компьютера' } });
    req.resume();
    return;
  }

  const chunks = [];
  let receivedBytes = 0;
  req.on('data', chunk => {
    receivedBytes += chunk.length;
    if (receivedBytes > MAX_GDRIVE_SYNC_REQUEST_BYTES) {
      if (!res.writableEnded) sendJson(res, 413, { error: { message: 'Слишком большой запрос загрузки' } });
      req.resume();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', async () => {
    if (res.writableEnded) return;
    if (receivedBytes > MAX_GDRIVE_SYNC_REQUEST_BYTES) return;

    let payload;
    try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch {
      sendJson(res, 400, { error: { message: 'Некорректный JSON в запросе' } });
      return;
    }

    const folderId = extractDriveFolderId(payload.folderId);
    if (!folderId) {
      sendJson(res, 400, { error: { message: 'Укажите корректную ссылку или ID папки Google Drive' } });
      return;
    }

    try {
      const token = await getDriveAccessToken(GOOGLE_DRIVE_WRITE_SCOPE);
      const uploaded = await uploadLocalKnowledgeBase(folderId, token);
      sendJson(res, 200, { success: true, folderId, files: uploaded });
    } catch (error) {
      const message = /permission|not found|access|insufficient/i.test(error.message)
        ? `Не удалось загрузить файлы. Дайте Service Account роль Editor на папку Google Drive. Детали: ${error.message}`
        : error.message;
      sendJson(res, 502, { error: { message } });
    }
  });
}

function handleGeminiRequest(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'POST' });
    res.end(JSON.stringify({ error: { message: 'Используйте POST для запроса к Gemini' } }));
    return;
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    sendJson(res, 503, {
      code: 'GEMINI_NOT_CONFIGURED',
      error: { message: 'Добавьте GEMINI_API_KEY в файл .env и перезапустите сервер' }
    });
    req.resume();
    return;
  }

  const chunks = [];
  let receivedBytes = 0;
  let tooLarge = false;

  req.on('data', chunk => {
    receivedBytes += chunk.length;
    if (receivedBytes > MAX_GEMINI_REQUEST_BYTES) {
      tooLarge = true;
      if (!res.writableEnded) sendJson(res, 413, { error: { message: 'Запрос к Gemini превышает 2 МБ' } });
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', async () => {
    if (tooLarge || res.writableEnded) return;

    let payload;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      sendJson(res, 400, { error: { message: 'Некорректный JSON в запросе' } });
      return;
    }

    if (!Array.isArray(payload.contents) || !payload.system_instruction) {
      sendJson(res, 400, { error: { message: 'В запросе отсутствуют инструкции или сообщения' } });
      return;
    }

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000)
      });
      const responseBody = await response.text();
      res.writeHead(response.status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(responseBody);
    } catch (error) {
      sendJson(res, 502, { error: { message: `Не удалось связаться с Gemini API: ${error.message}` } });
    }
  });
}

function handleRequest(req, res) {
    const routePath = req.url.split('?')[0];

    if (routePath === '/api/config') {
      if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'GET' });
        res.end(JSON.stringify({ error: 'Используйте GET для чтения настроек сервера' }));
        return;
      }
      sendJson(res, 200, { geminiConfigured: Boolean((process.env.GEMINI_API_KEY || '').trim()) });
      return;
    }

    if (routePath === '/api/gemini') {
      handleGeminiRequest(req, res);
      return;
    }

    if (routePath === '/api/gdrive/sync') {
      handleGDriveSyncRequest(req, res);
      return;
    }

    if (routePath === '/api/gdrive/upload-local') {
      handleGDriveUploadLocalRequest(req, res);
      return;
    }

    if (routePath === '/api/docx-to-text') {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'POST' });
        res.end(JSON.stringify({ error: 'Используйте POST для загрузки DOCX' }));
        return;
      }

      const contentLength = Number(req.headers['content-length'] || 0);
      if (contentLength > MAX_DOCX_BYTES) {
        res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'DOCX-файл должен быть меньше 12 МБ' }));
        req.resume();
        return;
      }

      const chunks = [];
      let receivedBytes = 0;
      req.on('data', chunk => {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_DOCX_BYTES) {
          res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'DOCX-файл должен быть меньше 12 МБ' }));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        if (res.writableEnded) return;
        try {
          const text = extractDocxText(Buffer.concat(chunks));
          if (!text.trim()) throw new Error('В DOCX-файле нет текста');
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ text }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    let reqUrl = req.url.split('?')[0];
    if (reqUrl === '/') reqUrl = '/index.html';

    const safePath = path.normalize(decodeURIComponent(reqUrl)).replace(/^(\.\.[\/\\])+/, '');
    const pathSegments = safePath.split(/[\\/]+/).filter(Boolean);
    if (pathSegments.some(segment => {
      const lowerSegment = segment.toLowerCase();
      return lowerSegment === '.git' || lowerSegment === 'secrets' || lowerSegment.startsWith('.env');
    })) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404: Файл не найден');
      return;
    }
    const filePath = path.join(BASE_DIR, safePath);

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`404: Файл ${reqUrl} не найден`);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Referrer-Policy': 'no-referrer-when-downgrade',
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
      });

      const readStream = fs.createReadStream(filePath);
      readStream.pipe(res);
    });
}

function createServer() {
  const server = http.createServer(handleRequest);
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️ Порт ${PORT} занят, пробуем ${PORT + 1}...`);
      PORT += 1;
      server.listen(PORT);
    } else {
      console.error('Ошибка сервера:', err);
    }
  });

  server.listen(PORT, () => {
    console.log(`\n🚀 Сервер IT Academy успешно запущен: http://localhost:${PORT}`);
    console.log(`⚡ Для остановки нажмите Ctrl + C\n`);
  });
}

if (require.main === module) createServer();
module.exports = handleRequest;
