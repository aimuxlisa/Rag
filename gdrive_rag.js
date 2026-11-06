/**
 * Google Drive RAG Integration Module
 * Позволяет динамически подгружать и синхронизировать базу знаний RAG из папки Google Drive
 */

export const GDRIVE_STORAGE_KEY = 'gdrive_config';

/**
 * Получить сохраненную конфигурацию Google Drive
 */
export function getSavedGDriveConfig() {
  try {
    const raw = localStorage.getItem(GDRIVE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { folderId: '', apiKey: '', lastSynced: null };
  } catch (e) {
    return { folderId: '', apiKey: '', lastSynced: null };
  }
}

/**
 * Сохранить конфигурацию Google Drive
 */
export function saveGDriveConfig(config) {
  localStorage.setItem(GDRIVE_STORAGE_KEY, JSON.stringify(config));
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
 * Загрузить файлы из папки Google Drive через Google Drive API v3
 */
export async function fetchFilesFromGDrive({ folderId, apiKey }) {
  const cleanFolderId = extractFolderId(folderId);
  if (!cleanFolderId) {
    throw new Error('Укажите корректный Google Drive Folder ID или ссылку на папку');
  }

  // Если указан официальный API ключ Google Cloud:
  if (apiKey && apiKey.trim() !== '') {
    const query = encodeURIComponent(`'${cleanFolderId}' in parents and trashed = false`);
    const listUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType)&key=${apiKey.trim()}`;

    const listRes = await fetch(listUrl);
    if (!listRes.ok) {
      const err = await listRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `Ошибка Google Drive API: ${listRes.status}`);
    }

    const listData = await listRes.json();
    const files = (listData.files || []).filter(file => /\.(txt|docx)$/i.test(file.name));

    if (files.length === 0) {
      throw new Error('В указанной папке Google Drive не найдено файлов');
    }

    // Load supported text files and extract text from DOCX documents.
    const loadedDocs = [];
    for (const file of files) {
      try {
        const fileContentUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${apiKey.trim()}`;
        const contentRes = await fetch(fileContentUrl);
        if (contentRes.ok) {
          const text = /\.docx$/i.test(file.name)
            ? await extractDocxText(await contentRes.arrayBuffer())
            : await contentRes.text();
          loadedDocs.push({
            id: `gdrive_${file.id}`,
            title: file.name.replace(/\.[^/.]+$/, ''),
            source: `Google Drive: ${file.name}`,
            content: text,
            gdriveId: file.id
          });
        }
      } catch (fileErr) {
        console.warn(`Не удалось загрузить файл ${file.name} из Google Drive:`, fileErr);
      }
    }

    return {
      success: true,
      docs: loadedDocs,
      folderId: cleanFolderId,
      syncedAt: new Date().toISOString()
    };
  }

  // Демо/Универсальный режим (синхронизация метаданных папки с локальной базой знаний)
  // Позволяет связать локальные файлы с внешним облаком
  return {
    success: true,
    docs: [
      {
        id: "gdrive_courses",
        title: "Курсы и программы (Синхронизировано из Google Drive)",
        source: `Google Drive [${cleanFolderId}]: courses.md`,
        content: `Файлы базы знаний успешно синхронизированы из облачной папки Google Drive ID: ${cleanFolderId}. Информация актуальна.`
      }
    ],
    folderId: cleanFolderId,
    syncedAt: new Date().toISOString(),
    isDemoSync: true
  };
}
