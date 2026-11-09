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
    const saved = raw ? JSON.parse(raw) : {};
    const config = {
      folderId: saved.folderId || '',
      lastSynced: saved.lastSynced || null
    };
    if (saved.apiKey || saved.clientId) localStorage.setItem(GDRIVE_STORAGE_KEY, JSON.stringify(config));
    return config;
  } catch (e) {
    return { folderId: '', lastSynced: null };
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
  if (match && match[1]) return match[1];
  return trimmed.split(/[?#]/, 1)[0];
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
 * Синхронизировать поддерживаемые файлы из Google Drive через локальный сервер
 */
export async function fetchFilesFromGDrive({ folderId }) {
  const cleanFolderId = extractFolderId(folderId);
  if (!cleanFolderId) {
    throw new Error('Укажите корректный Google Drive Folder ID или ссылку на папку');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(cleanFolderId)) {
    throw new Error('Не удалось распознать ID папки Google Drive');
  }
  const response = await fetch('/api/gdrive/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderId: cleanFolderId })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || `Ошибка синхронизации Google Drive: ${response.status}`);
  return result;
}
