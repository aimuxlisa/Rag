const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

let PORT = parseInt(process.env.PORT, 10) || 8080;
const BASE_DIR = __dirname;

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

function createServer() {
  const server = http.createServer((req, res) => {
    if (req.url.split('?')[0] === '/api/docx-to-text') {
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
        'Access-Control-Allow-Origin': '*'
      });

      const readStream = fs.createReadStream(filePath);
      readStream.pipe(res);
    });
  });

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

createServer();
