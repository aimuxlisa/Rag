/**
 * Google Drive RAG Integration Module
 * Позволяет динамически подгружать и синхронизировать базу знаний RAG из папки Google Drive
 */

export const GDRIVE_STORAGE_KEY = 'gdrive_config';
const DRIVE_READ_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

/**
 * Получить сохраненную конфигурацию Google Drive
 */
export function getSavedGDriveConfig() {
  try {
    const raw = localStorage.getItem(GDRIVE_STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    const config = {
      folderId: saved.folderId || '',
      clientId: saved.clientId || '',
      lastSynced: saved.lastSynced || null
    };
    if (saved.apiKey) localStorage.setItem(GDRIVE_STORAGE_KEY, JSON.stringify(config));
    return config;
  } catch (e) {
    return { folderId: '', clientId: '', lastSynced: null };
  }
}

/**
 * Сохранить конфигурацию Google Drive
 */
export function saveGDriveConfig(config) {
  localStorage.setItem(GDRIVE_STORAGE_KEY, JSON.stringify(config));
}

/** Получить OAuth access token для чтения Google Drive. Токен не сохраняется. */
export function requestGoogleDriveAccess(clientId) {
  const cleanClientId = (clientId || '').trim();
  if (!cleanClientId || !cleanClientId.endsWith('.apps.googleusercontent.com')) {
    return Promise.reject(new Error('Укажите корректный OAuth Client ID из Google Cloud Console'));
  }

  const oauth = window.google?.accounts?.oauth2;
  if (!oauth) {
    return Promise.reject(new Error('Не загрузилась библиотека Google OAuth. Обновите страницу и попробуйте снова.'));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      callback(value);
    };
    timeoutId = setTimeout(() => {
      finish(reject, new Error('Google OAuth не завершился. Проверьте окно входа и попробуйте снова.'));
    }, 120000);

    try {
      const tokenClient = oauth.initTokenClient({
        client_id: cleanClientId,
        scope: DRIVE_READ_SCOPE,
        callback: response => {
          if (response.error) {
            finish(reject, new Error(response.error_description || response.error));
            return;
          }
          if (!response.access_token) {
            finish(reject, new Error('Google не вернул токен доступа к Drive'));
            return;
          }
          finish(resolve, response.access_token);
        },
        error_callback: error => finish(reject, new Error(error.message || 'Не удалось открыть окно Google OAuth'))
      });

      tokenClient.requestAccessToken({ prompt: '' });
    } catch (error) {
      finish(reject, error);
    }
  });
}

/**
 * Извлечь Folder ID из обычной ссылки Google Drive или прямого ID
 * Поддерживает форматы:
 * - https://drive.google.com/drive/folders/1aBcD_...
 * - https://drive.google.com/drive/u/0/folders/1aBcD_...
 * - Прямой ID: 1aBcD_...
 */
export function extractFolderId(input) {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

export async function extractDocxText(fileData) {
  const response = await fetch('/api/docx-to-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    body: fileData
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Не удалось прочитать DOCX: ${response.status}`);
  return result.text;
}

/**
 * Загрузить поддерживаемые файлы из приватной папки Google Drive через OAuth
 */
export async function fetchFilesFromGDrive({ folderId, accessToken }) {
  const cleanFolderId = extractFolderId(folderId);
  if (!cleanFolderId) {
    throw new Error('Укажите корректный Google Drive Folder ID или ссылку на папку');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(cleanFolderId)) {
    throw new Error('Не удалось распознать ID папки Google Drive');
  }
  if (!accessToken) throw new Error('Сначала войдите в Google и разрешите чтение файлов Drive');

  const files = [];
  let pageToken = '';
  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', `'${cleanFolderId}' in parents and trashed = false`);
    url.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType)');
    url.searchParams.set('pageSize', '1000');
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const listRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const listData = await listRes.json().catch(() => ({}));
    if (!listRes.ok) {
      throw new Error(listData.error?.message || `Ошибка Google Drive API: ${listRes.status}`);
    }

    files.push(...(listData.files || []));
    pageToken = listData.nextPageToken || '';
  } while (pageToken);

  const googleDocMime = 'application/vnd.google-apps.document';
  const supportedFiles = files.filter(file =>
    /\.(txt|docx)$/i.test(file.name) || file.mimeType === googleDocMime
  );
  if (supportedFiles.length === 0) {
    throw new Error('В папке нет поддерживаемых файлов (.txt, .docx или Google Docs)');
  }

  const loadedDocs = [];
  for (const file of supportedFiles) {
    try {
      let contentUrl;
      if (file.mimeType === googleDocMime) {
        contentUrl = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export`);
        contentUrl.searchParams.set('mimeType', 'text/plain');
      } else {
        contentUrl = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}`);
        contentUrl.searchParams.set('alt', 'media');
      }

      const contentRes = await fetch(contentUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!contentRes.ok) {
        const error = await contentRes.json().catch(() => ({}));
        throw new Error(error.error?.message || `Ошибка загрузки: ${contentRes.status}`);
      }

      const text = /\.docx$/i.test(file.name) && file.mimeType !== googleDocMime
        ? await extractDocxText(await contentRes.arrayBuffer())
        : await contentRes.text();
      if (!text.trim()) throw new Error('Файл не содержит текста');

      loadedDocs.push({
        id: `gdrive_${file.id}`,
        title: file.mimeType === googleDocMime ? file.name : file.name.replace(/\.[^/.]+$/, ''),
        source: `Google Drive: ${file.name}`,
        content: text,
        gdriveId: file.id
      });
    } catch (fileErr) {
      console.warn(`Не удалось загрузить файл ${file.name} из Google Drive:`, fileErr);
    }
  }

  if (loadedDocs.length === 0) {
    throw new Error('Не удалось прочитать файлы из папки. Проверьте доступ и разрешение на скачивание.');
  }

  return {
    success: true,
    docs: loadedDocs,
    folderId: cleanFolderId,
    syncedAt: new Date().toISOString()
  };
}
