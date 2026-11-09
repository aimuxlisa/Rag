import { generateGeminiRAGResponse, updateKnowledgeBase, KNOWLEDGE_BASE } from './rag.js';
import { getSavedGDriveConfig, saveGDriveConfig, fetchFilesFromGDrive, extractDocxText } from './gdrive_rag.js';

// DOM Elements
const fabToggleBtn = document.getElementById('fab-ai-toggle');
const chatWindow = document.getElementById('rag-chat-window');
const chatCloseBtn = document.getElementById('chat-close-btn');
const heroAiTrigger = document.getElementById('hero-ai-trigger');
const headerAskAiBtn = document.getElementById('header-ask-ai-btn');

const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-user-input');
const chatMessages = document.getElementById('chat-messages');
const quickChips = document.querySelectorAll('.quick-chip');
const courseAskBtns = document.querySelectorAll('.course-btn-ask');

const openApiModalBtn = document.getElementById('open-api-modal-btn');
const bannerApiKeyBtn = document.getElementById('banner-api-key-btn');
const chatSettingsBtn = document.getElementById('chat-settings-btn');
const apiModal = document.getElementById('api-modal');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalClearBtn = document.getElementById('modal-clear-btn');
const geminiKeyInput = document.getElementById('gemini-key-input');
const apiStatusText = document.getElementById('api-status-text');

// Google Drive Sync DOM Elements
const gdriveFolderInput = document.getElementById('gdrive-folder-input');
const gdriveSyncBtn = document.getElementById('gdrive-sync-btn');
const gdriveUploadBtn = document.getElementById('gdrive-upload-btn');
const gdriveStatusMsg = document.getElementById('gdrive-status-msg');
const knowledgeFileInput = document.getElementById('knowledge-file-input');
const knowledgeImportBtn = document.getElementById('knowledge-import-btn');
const knowledgeImportStatus = document.getElementById('knowledge-import-status');
const themeToggleBtn = document.getElementById('theme-toggle');

// State
const STORAGE_KEY = 'gemini_api_key';
const IMPORTED_DOCS_KEY = 'knowledge_imports';
const THEME_STORAGE_KEY = 'site_theme';
let chatHistory = [];
let isGenerating = false;
let localCourseLoad;

function setTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');

  if (themeToggleBtn) {
    const label = isDark ? 'Включить светлую тему' : 'Включить тёмную тему';
    themeToggleBtn.setAttribute('aria-label', label);
    themeToggleBtn.setAttribute('title', label);
    themeToggleBtn.setAttribute('aria-pressed', String(isDark));
  }
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  });
}

setTheme(document.documentElement.dataset.theme);

function restoreImportedDocuments() {
  const saved = localStorage.getItem(IMPORTED_DOCS_KEY);
  if (!saved) return;

  try {
    const docs = JSON.parse(saved);
    if (!Array.isArray(docs) || docs.some(doc => !doc.id || !doc.title || !doc.content)) {
      throw new Error('Сохранённые документы имеют неверный формат');
    }
    updateKnowledgeBase(docs);
  } catch (error) {
    console.error('Не удалось восстановить импортированные документы базы знаний:', error);
    if (knowledgeImportStatus) knowledgeImportStatus.textContent = 'Не удалось прочитать сохранённые документы. Добавьте их повторно.';
  }
}

restoreImportedDocuments();

function loadLocalCourseKnowledge() {
  if (!localCourseLoad) {
    localCourseLoad = fetch('./knowledge/courses.txt')
      .then(response => {
        if (!response.ok) throw new Error(`Не удалось загрузить каталог курсов: ${response.status}`);
        return response.text();
      })
      .then(content => {
        if (!content.trim()) throw new Error('Файл courses.txt пуст');
        updateKnowledgeBase([{
          id: 'courses',
          title: 'Направления обучения и курсы',
          source: 'knowledge/courses.txt',
          content
        }]);
      })
      .catch(error => {
        localCourseLoad = null;
        console.warn('Не удалось обновить каталог курсов; используется доступная база знаний:', error);
      });
  }
  return localCourseLoad;
}

if (knowledgeImportBtn && knowledgeFileInput) {
  knowledgeImportBtn.addEventListener('click', async () => {
    const file = knowledgeFileInput.files && knowledgeFileInput.files[0];
    if (!file) {
      knowledgeImportStatus.textContent = 'Сначала выберите файл TXT или DOCX.';
      return;
    }

    if (!/\.(txt|docx)$/i.test(file.name)) {
      knowledgeImportStatus.textContent = 'Поддерживаются только файлы TXT и DOCX.';
      return;
    }
    if (file.size > 1024 * 1024) {
      knowledgeImportStatus.textContent = 'Размер файла не должен превышать 1 МБ.';
      return;
    }

    knowledgeImportBtn.disabled = true;
    knowledgeImportStatus.textContent = 'Читаем документ…';

    try {
      const content = /\.docx$/i.test(file.name)
        ? await extractDocxText(await file.arrayBuffer())
        : await file.text();
      if (!content.trim()) throw new Error('В файле нет текста для добавления');

      const doc = {
        id: `upload_${crypto.randomUUID()}`,
        title: file.name.replace(/\.(txt|docx)$/i, ''),
        source: file.name,
        content
      };
      const savedDocs = JSON.parse(localStorage.getItem(IMPORTED_DOCS_KEY) || '[]');
      localStorage.setItem(IMPORTED_DOCS_KEY, JSON.stringify([...savedDocs, doc]));
      updateKnowledgeBase([doc]);
      knowledgeFileInput.value = '';
      knowledgeImportStatus.textContent = `Добавлен документ «${doc.title}».`;
    } catch (error) {
      knowledgeImportStatus.textContent = `Не удалось добавить документ: ${error.message}`;
    } finally {
      knowledgeImportBtn.disabled = false;
    }
  });
}

// Initialize API Key state
function initApiKeyState() {
  const savedKey = localStorage.getItem(STORAGE_KEY);
  if (savedKey && savedKey.trim() !== '') {
    geminiKeyInput.value = savedKey;
    apiStatusText.innerHTML = `Режим: <b class="status-badge">Gemini 3 Flash Active</b>`;
  } else {
    apiStatusText.innerHTML = `Режим: <b class="status-badge">Локальная база знаний</b>`;
    fetch('/api/config')
      .then(response => response.ok ? response.json() : null)
      .then(config => {
        if (config?.geminiConfigured && !localStorage.getItem(STORAGE_KEY)) {
          apiStatusText.innerHTML = `Режим: <b class="status-badge">Gemini 3 Flash Active (сервер)</b>`;
        }
      })
      .catch(() => {});
  }
}

// Open / Close Chat Window
function toggleChat(forceOpen = null) {
  const shouldOpen = forceOpen !== null ? forceOpen : !chatWindow.classList.contains('active');
  if (shouldOpen) {
    chatWindow.classList.add('active');
    setTimeout(() => chatInput.focus(), 250);
  } else {
    chatWindow.classList.remove('active');
  }
}

// Modal open/close
function openModal() {
  geminiKeyInput.value = localStorage.getItem(STORAGE_KEY) || '';
  const gdriveConf = getSavedGDriveConfig();
  if (gdriveFolderInput) gdriveFolderInput.value = gdriveConf.folderId || '';
  if (gdriveStatusMsg && gdriveConf.lastSynced) {
    gdriveStatusMsg.innerHTML = `<span style="color:#10b981;">✔ Синхронизировано: ${new Date(gdriveConf.lastSynced).toLocaleTimeString()}</span>`;
  }
  apiModal.classList.add('active');
  geminiKeyInput.focus();
}

function closeModal() {
  apiModal.classList.remove('active');
}

// Format Markdown to Clean HTML
function formatMarkdown(text) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic *text*
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Inline code `text`
  html = html.replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:monospace;">$1</code>');
  // Line breaks
  html = html.replace(/\n/g, '<br>');

  return html;
}

// Append message to chat
function appendMessage({ text, sender = 'bot' }) {
  const bubble = document.createElement('div');
  bubble.className = `message-bubble message-${sender}`;

  bubble.innerHTML = formatMarkdown(text);
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Add to history
  chatHistory.push({
    role: sender === 'user' ? 'user' : 'model',
    text: text
  });
}

// Show typing indicator
function showTypingIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'chat-typing-indicator';
  indicator.className = 'typing-indicator';
  indicator.innerHTML = `
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
  `;
  chatMessages.appendChild(indicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return indicator;
}

function removeTypingIndicator() {
  const el = document.getElementById('chat-typing-indicator');
  if (el) el.remove();
}

// Handle sending message
async function handleSendMessage(queryText) {
  const text = (queryText || chatInput.value).trim();
  if (!text || isGenerating) return;

  chatInput.value = '';
  isGenerating = true;

  // Render user message
  appendMessage({ text, sender: 'user' });

  // Show typing indicator
  showTypingIndicator();

  const apiKey = localStorage.getItem(STORAGE_KEY) || '';

  try {
    await loadLocalCourseKnowledge();
    const result = await generateGeminiRAGResponse({
      query: text,
      apiKey: apiKey,
      chatHistory: chatHistory
    });

    removeTypingIndicator();
    appendMessage({
      text: result.text,
      sender: 'bot'
    });
  } catch (err) {
    removeTypingIndicator();
    appendMessage({
      text: `Извините, произошла ошибка: ${err.message}. Пожалуйста, попробуйте еще раз.`,
      sender: 'bot'
    });
  } finally {
    isGenerating = false;
  }
}

// Event Listeners for FAB & Buttons
if (fabToggleBtn) fabToggleBtn.addEventListener('click', () => toggleChat());
if (chatCloseBtn) chatCloseBtn.addEventListener('click', () => toggleChat(false));
if (heroAiTrigger) heroAiTrigger.addEventListener('click', () => toggleChat(true));
if (headerAskAiBtn) headerAskAiBtn.addEventListener('click', () => toggleChat(true));

// Quick Prompts
quickChips.forEach(chip => {
  chip.addEventListener('click', () => {
    const query = chip.getAttribute('data-query');
    handleSendMessage(query);
  });
});

// Form submit
if (chatForm) {
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSendMessage();
  });
}

// API Key Modal open buttons
if (openApiModalBtn) openApiModalBtn.addEventListener('click', openModal);
if (bannerApiKeyBtn) bannerApiKeyBtn.addEventListener('click', openModal);
if (chatSettingsBtn) chatSettingsBtn.addEventListener('click', openModal);

// Google Drive Sync Button Handler
if (gdriveSyncBtn) {
  gdriveSyncBtn.addEventListener('click', async () => {
    const folderId = gdriveFolderInput ? gdriveFolderInput.value.trim() : '';
    if (!folderId) {
      if (gdriveStatusMsg) gdriveStatusMsg.innerHTML = '<span style="color:#ef4444;">Укажите ID или ссылку на папку Google Drive</span>';
      return;
    }

    gdriveSyncBtn.disabled = true;
    if (gdriveStatusMsg) gdriveStatusMsg.innerHTML = '<span style="color:#38bdf8;">⏳ Синхронизация с Google Drive...</span>';

    try {
      const res = await fetchFilesFromGDrive({ folderId });
      if (res.success && res.docs) {
        const localDocs = KNOWLEDGE_BASE.filter(doc => !doc.id.startsWith('gdrive_'));
        updateKnowledgeBase([...localDocs, ...res.docs], true);
        const now = new Date().toISOString();
        saveGDriveConfig({ folderId: res.folderId, lastSynced: now });

        const warningCount = Array.isArray(res.warnings) ? res.warnings.length : 0;
        if (gdriveStatusMsg) {
          const warningText = warningCount ? ` Не прочитано файлов: ${warningCount}.` : '';
          gdriveStatusMsg.innerHTML = `<span style="color:#10b981;">✔ Загружено: ${res.docs.length}.${warningText}</span>`;
        }

        // Add notice to chat window
        appendMessage({
          text: `🔄 **База знаний синхронизирована с Google Drive!**\nЗагружено документов: ${res.docs.length} (Папка ID: \`${res.folderId}\`). RAG ассистент использует обновленные данные.`,
          sender: 'bot'
        });
      }
    } catch (err) {
      if (gdriveStatusMsg) gdriveStatusMsg.innerHTML = `<span style="color:#ef4444;">Ошибка: ${err.message}</span>`;
    } finally {
      gdriveSyncBtn.disabled = false;
    }
  });
}

if (gdriveUploadBtn) {
  gdriveUploadBtn.addEventListener('click', async () => {
    const folderId = gdriveFolderInput ? gdriveFolderInput.value.trim() : '';
    if (!folderId) {
      if (gdriveStatusMsg) gdriveStatusMsg.innerHTML = '<span style="color:#ef4444;">Укажите ID или ссылку на папку Google Drive</span>';
      return;
    }

    gdriveUploadBtn.disabled = true;
    gdriveSyncBtn.disabled = true;
    if (gdriveStatusMsg) gdriveStatusMsg.innerHTML = '<span style="color:#38bdf8;">⏳ Загружаем локальные документы в Google Drive...</span>';

    try {
      const response = await fetch('/api/gdrive/upload-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error?.message || `Ошибка загрузки: ${response.status}`);

      saveGDriveConfig({ folderId: result.folderId, lastSynced: new Date().toISOString() });
      if (gdriveStatusMsg) {
        gdriveStatusMsg.innerHTML = `<span style="color:#10b981;">✔ Загружено файлов: ${result.files.length}</span>`;
      }
      appendMessage({
        text: `Локальная база знаний загружена в Google Drive: ${result.files.map(file => file.name).join(', ')}.`,
        sender: 'bot'
      });
    } catch (error) {
      if (gdriveStatusMsg) gdriveStatusMsg.innerHTML = `<span style="color:#ef4444;">Ошибка: ${error.message}</span>`;
    } finally {
      gdriveUploadBtn.disabled = false;
      gdriveSyncBtn.disabled = false;
    }
  });
}

// Modal Save & Clear Handlers
modalSaveBtn.addEventListener('click', () => {
  const key = geminiKeyInput.value.trim();
  if (key) {
    localStorage.setItem(STORAGE_KEY, key);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }

  // Save GDrive configuration
  const folderId = gdriveFolderInput ? gdriveFolderInput.value.trim() : '';
  const currentConf = getSavedGDriveConfig();
  saveGDriveConfig({ ...currentConf, folderId });

  initApiKeyState();
  closeModal();
});

modalClearBtn.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('gdrive_config');
  localStorage.removeItem(IMPORTED_DOCS_KEY);
  updateKnowledgeBase(KNOWLEDGE_BASE.filter(doc => !doc.id.startsWith('upload_') && !doc.id.startsWith('gdrive_')));
  geminiKeyInput.value = '';
  if (gdriveFolderInput) gdriveFolderInput.value = '';
  if (gdriveStatusMsg) gdriveStatusMsg.innerHTML = 'Статус: Не синхронизировано';
  initApiKeyState();
  closeModal();
});

apiModal.addEventListener('click', (e) => {
  if (e.target === apiModal) closeModal();
});

// Initialize on page load
initApiKeyState();

/* ==========================================================================
   STAGE 3: COURSES CATALOG, FILTERING & SYLLABUS CURRICULUM
   ========================================================================== */

const SYLLABUS_DATA = {
  frontend: {
    title: "Frontend Разработка (Web & SPA)",
    meta: "7 месяцев • 3 занятия в неделю по 2 часа + 24/7 коворкинг",
    promptAi: "Расскажи подробно про стек, дипломный проект и помощь в трудоустройстве на курсе Frontend",
    modules: [
      {
        num: "Модуль 01 (Месяц 1)",
        title: "Web Foundation & Deep HTML5/CSS3/SCSS",
        topics: "Семантическая верстка, методология BEM, Flexbox, CSS Grid, адаптивный дизайн (Mobile-First), препроцессоры SCSS, анимации и SVG."
      },
      {
        num: "Модуль 02 (Месяц 2-3)",
        title: "JavaScript Core to Advanced (ES6+)",
        topics: "Типы данных, замыкания, Event Loop, DOM API, асинхронность (Promises, async/await), Fetch, работа с REST API, Git и GitHub."
      },
      {
        num: "Модуль 03 (Месяц 4)",
        title: "TypeScript Essentials",
        topics: "Статическая типизация, интерфейсы, дженерики, типизация компонентов и API ответов."
      },
      {
        num: "Модуль 04 (Месяц 5-6)",
        title: "React.js & Next.js 15 Ecosystem",
        topics: "Хуки, управление состоянием (Redux Toolkit, Zustand), Server-Side Rendering (SSR/SSG), оптимизация производительности, Tailwind CSS."
      },
      {
        num: "Модуль 05 (Месяц 7)",
        title: "Дипломный проект & Карьерный спринт",
        topics: "Разработка полномасштабного коммерческого веб-сервиса, ревью кода менторами из BigTech, подготовка CV и симуляция технических собеседований."
      }
    ]
  },
  backend: {
    title: "Python & Backend Engineering",
    meta: "8 месяцев • 3 занятия в неделю по 2 часа + менторская поддержка",
    promptAi: "Какие базы данных и фреймворки изучаются на курсе Python Backend?",
    modules: [
      {
        num: "Модуль 01 (Месяц 1-2)",
        title: "Python Pro & ООП",
        topics: "Синтаксис Python 3.12, объектно-ориентированное программирование, структуры данных, декораторы, генераторы, алгоритмы."
      },
      {
        num: "Модуль 02 (Месяц 3)",
        title: "Реляционные базы данных & SQL",
        topics: "PostgreSQL, проектирование сложных схем, индексы, оптимизация запросов, транзакции, ORM SQLAlchemy."
      },
      {
        num: "Модуль 03 (Месяц 4-5)",
        title: "FastAPI, Django & RESTful API",
        topics: "Разработка асинхронных микросервисов, Pydantic, валидация, аутентификация JWT, Swagger документация."
      },
      {
        num: "Модуль 04 (Месяц 6-7)",
        title: "Очереди, кэширование & DevOps",
        topics: "Redis, фоновые задачи с Celery, контейнеризация Docker, Docker Compose, основы Nginx и CI/CD."
      },
      {
        num: "Модуль 05 (Месяц 8)",
        title: "Дипломная микросервисная система & AI Integration",
        topics: "Подключение Google Gemini API / LLM для бизнес-задач, деплой проекта на продакшн-сервер, защита диплома."
      }
    ]
  },
  design: {
    title: "UI/UX & Product Design",
    meta: "5 месяцев • Практика на реальных кейсах",
    promptAi: "Расскажи про проекты в портфолио на курсе UI/UX дизайна",
    modules: [
      {
        num: "Модуль 01 (Месяц 1)",
        title: "Основы UI и мастерство Figma",
        topics: "Интерфейс Figma, сетки, автолейауты (Auto-layout), компоненты, варианты (Variants), типографика и колористика."
      },
      {
        num: "Модуль 02 (Месяц 2)",
        title: "UX Research & Пользовательский путь",
        topics: "Глубинные интервью, CustDev, User Personas, Customer Journey Map (CJM), информационная архитектура."
      },
      {
        num: "Модуль 03 (Месяц 3)",
        title: "Дизайн мобильных приложений (iOS & Android)",
        topics: "Human Interface Guidelines (Apple) и Material Design (Google), интерактивные микроанимации и кликабельные прототипы."
      },
      {
        num: "Модуль 04 (Месяц 4)",
        title: "Дизайн-системы и передача в разработку",
        topics: "Создание масштабируемых UI-китов, дизайн-токенов, спецификации для разработчиков, Dev Mode."
      },
      {
        num: "Модуль 05 (Месяц 5)",
        title: "Оформление кейсов на Behance & Карьера",
        topics: "Презентация и оформление 4 работ на Behance и Dribbble, защита дипломного проекта перед дизайн-лидами."
      }
    ]
  },
  qa: {
    title: "QA Automation & Manual Testing",
    meta: "4 месяца • Быстрый старт в IT с нуля",
    promptAi: "Сложно ли учиться на QA и как устроен поиск работы?",
    modules: [
      {
        num: "Модуль 01 (Месяц 1)",
        title: "Теория тестирования & Тест-дизайн",
        topics: "Виды тестирования, тест-кейсы, чек-листы, баг-репорты в Jira, техники тест-дизайна (эквивалентные классы, граничные значения)."
      },
      {
        num: "Модуль 02 (Месяц 2)",
        title: "Тестирование API & Базы данных",
        topics: "Postman: коллекции, переменные окружения, скрипты тестирования; базовый SQL (SELECT, JOIN, агрегация)."
      },
      {
        num: "Модуль 03 (Месяц 3)",
        title: "Автоматизация тестирования на Python",
        topics: "Основы Python, фреймворк PyTest, автоматизация браузера с помощью Playwright / Selenium WebDriver."
      },
      {
        num: "Модуль 04 (Месяц 4)",
        title: "CI/CD & Защита дипломного проекта",
        topics: "Запуск автотестов в GitHub Actions, генерация отчетов Allure, итоговая аттестация и помощь карьерного центра."
      }
    ]
  },
  ai: {
    title: "Data Science & AI Engineering",
    meta: "9 месяцев • Продвинутый практический курс",
    promptAi: "Расскажи про математические требования и проект на курсе Data Science",
    modules: [
      {
        num: "Модуль 01 (Месяц 1-2)",
        title: "Python для Анализа Данных",
        topics: "NumPy, Pandas, очистка данных (Data Wrangling), визуализация Matplotlib, Seaborn и Plotly."
      },
      {
        num: "Модуль 02 (Месяц 3-4)",
        title: "Математика & Классический Machine Learning",
        topics: "Линейная алгебра, статистика, теория вероятностей, Scikit-learn: линейная регрессия, деревья решений, градиентный бустинг."
      },
      {
        num: "Модуль 03 (Месяц 5-6)",
        title: "Глубокое обучение (Deep Learning) & PyTorch",
        topics: "Нейронные сети, сверточные сети (CNN), рекуррентные сети и архитектура Transformer."
      },
      {
        num: "Модуль 04 (Месяц 7-8)",
        title: "LLM, RAG & AI-агенты",
        topics: "Fine-tuning моделей, векторизация текста (Embeddings), построение RAG-систем, интеграция Google Gemini API, LangChain."
      },
      {
        num: "Модуль 05 (Месяц 9)",
        title: "Дипломный AI-продукт",
        topics: "Реализация и развертывание собственного интеллектуального веб-сервиса в продакшн."
      }
    ]
  },
  flutter: {
    title: "Mobile App Development (Flutter & Dart)",
    meta: "6 месяцев • Кроссплатформенная разработка iOS & Android",
    promptAi: "Расскажи про разработку приложений на Flutter и вакансии",
    modules: [
      {
        num: "Модуль 01 (Месяц 1)",
        title: "Основы языка Dart & ООП",
        topics: "Синтаксис Dart, классы, коллекции, асинхронное программирование (Future, Streams), обработка ошибок."
      },
      {
        num: "Модуль 02 (Месяц 2-3)",
        title: "Flutter SDK & Верстка UI",
        topics: "Stateless & Stateful виджеты, кастомная анимация, Material 3 & Cupertino, навигация GoRouter."
      },
      {
        num: "Модуль 03 (Месяц 4)",
        title: "Управление состоянием & Сеть",
        topics: "BLoC & Cubit, архитектура Clean Architecture, Dio, REST API, кэширование Hive/Isar."
      },
      {
        num: "Модуль 04 (Месяц 5-6)",
        title: "Firebase & Публикация в App Store / Google Play",
        topics: "Push-уведомления, авторизация, платежные шлюзы (Payme/Click), сборка и релиз в маркеты."
      }
    ]
  },
  devops: {
    title: "DevOps & Cloud Engineering",
    meta: "6 месяцев • Автоматизация инфраструктуры и CI/CD",
    promptAi: "Какие навыки нужны DevOps-инженеру и что изучают на курсе?",
    modules: [
      {
        num: "Модуль 01 (Месяц 1)",
        title: "Linux Administration & Bash Scripting",
        topics: "Архитектура Linux, права доступа, SSH, Bash скрипты автоматизации, системный мониторинг."
      },
      {
        num: "Модуль 02 (Месяц 2-3)",
        title: "Контейнеризация: Docker & Docker Compose",
        topics: "Dockerfiles, оптимизация слоев, multi-stage builds, сети, volumes, микросервисы."
      },
      {
        num: "Модуль 03 (Месяц 4)",
        title: "CI/CD пайплайны & GitOps",
        topics: "GitHub Actions, GitLab CI, автоматическое тестирование, линтинг и доставка кода в стейджинг."
      },
      {
        num: "Модуль 04 (Месяц 5-6)",
        title: "Kubernetes & Облачная инфраструктура AWS",
        topics: "Pods, Deployments, Services, Ingress, Helm чарты, мониторинг Prometheus & Grafana, IaC Terraform."
      }
    ]
  },
  security: {
    title: "Cyber Security & Ethical Hacking",
    meta: "6 месяцев • Защита информации и аудит систем",
    promptAi: "Как начать путь в кибербезопасности и этичном хакинге?",
    modules: [
      {
        num: "Модуль 01 (Месяц 1)",
        title: "Основы сетей & Архитектура безопасности",
        topics: "Модель OSI, TCP/IP, Wireshark, сканирование Nmap, криптография (RSA, AES, TLS)."
      },
      {
        num: "Модуль 02 (Месяц 2-3)",
        title: "Анализ уязвимостей веб-приложений (OWASP Top 10)",
        topics: "SQL инъекции, XSS, CSRF, SSRF, обход аутентификации, Burp Suite Professional."
      },
      {
        num: "Модуль 03 (Месяц 4)",
        title: "Пентестинг инфраструктуры & Metasploit",
        topics: "Kali Linux, поиск эксплойтов, постэксплуатация, социальная инженерия, безопасность Active Directory."
      },
      {
        num: "Модуль 04 (Месяц 5-6)",
        title: "Аудит, защита систем & Blue Teaming",
        topics: "SIEM системы, реагирование на инциденты, защита от DDoS, подготовка к сертификациям CEH/CompTIA."
      }
    ]
  }
};

// Course Filtering & Search Logic
const filterTabs = document.querySelectorAll('.filter-tab');
const searchInput = document.getElementById('course-search-input');

function filterCourses() {
  const activeTab = document.querySelector('.filter-tab.active');
  const activeCategory = activeTab ? activeTab.getAttribute('data-filter') : 'all';
  const query = (searchInput && searchInput.value ? searchInput.value : '').toLowerCase().trim();
  const allCards = document.querySelectorAll('.course-card');

  allCards.forEach(card => {
    const cardCategory = card.getAttribute('data-category');
    const cardKeywords = (card.getAttribute('data-keywords') || '').toLowerCase();
    const titleEl = card.querySelector('.course-edujar-title, .card-h3');
    const cardTitle = titleEl ? titleEl.textContent.toLowerCase() : '';

    const matchesCategory = (activeCategory === 'all' || cardCategory === activeCategory);
    const matchesSearch = query === '' || cardKeywords.includes(query) || cardTitle.includes(query);

    if (matchesCategory && matchesSearch) {
      card.style.display = 'flex';
      card.style.opacity = '1';
    } else {
      card.style.display = 'none';
    }
  });
}

filterTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    filterTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    filterCourses();
  });
});

if (searchInput) {
  searchInput.addEventListener('input', filterCourses);
}

// Syllabus Modal Logic
const syllabusModal = document.getElementById('syllabus-modal');
const syllabusCloseBtn = document.getElementById('syllabus-close-btn');
const syllabusTitle = document.getElementById('syllabus-title');
const syllabusMeta = document.getElementById('syllabus-meta');
const syllabusContainer = document.getElementById('syllabus-modules-container');
const syllabusAskAiBtn = document.getElementById('syllabus-ask-ai-btn');

let currentActiveCourseId = 'frontend';

function openSyllabus(courseId) {
  const course = SYLLABUS_DATA[courseId];
  if (!course) return;

  currentActiveCourseId = courseId;
  syllabusTitle.textContent = course.title;
  syllabusMeta.textContent = course.meta;

  syllabusContainer.innerHTML = course.modules.map(mod => `
    <div class="syllabus-module-item">
      <div class="module-num">${mod.num}</div>
      <div class="module-title">${mod.title}</div>
      <div class="module-topics">${mod.topics}</div>
    </div>
  `).join('');

  syllabusModal.classList.add('active');
}

function closeSyllabus() {
  syllabusModal.classList.remove('active');
}

// Attach event listeners for all Syllabus buttons
document.querySelectorAll('.btn-syllabus').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const courseId = btn.getAttribute('data-course-id');
    if (courseId) openSyllabus(courseId);
  });
});

if (syllabusCloseBtn) {
  syllabusCloseBtn.addEventListener('click', closeSyllabus);
}

if (syllabusModal) {
  syllabusModal.addEventListener('click', (e) => {
    if (e.target === syllabusModal) closeSyllabus();
  });
}

if (syllabusAskAiBtn) {
  syllabusAskAiBtn.addEventListener('click', () => {
    closeSyllabus();
    const course = SYLLABUS_DATA[currentActiveCourseId];
    toggleChat(true);
    if (course && course.promptAi) {
      handleSendMessage(course.promptAi);
    }
  });
}

// Re-bind dynamic course ask buttons
document.querySelectorAll('.course-btn-ask').forEach(btn => {
  btn.addEventListener('click', () => {
    const query = btn.getAttribute('data-ask');
    toggleChat(true);
    handleSendMessage(query);
  });
});

/* ==========================================================================
   STAGE 2: HERO CYBER TERMINAL TAB SWITCHER
   ========================================================================== */

const terminalTabs = document.querySelectorAll('.t-tab-btn');
const terminalBody = document.getElementById('hero-terminal-content');

const TERMINAL_SNIPPETS = {
  frontend: `
    <div><span class="t-comment">// Учебный поток IT Academy</span></div>
    <div><span class="t-keyword">const</span> student = <span class="t-keyword">new</span> <span class="t-function">FutureSpecialist</span>({</div>
    <div style="padding-left: 18px;">track: <span class="t-string">"Frontend Web & Next.js"</span>,</div>
    <div style="padding-left: 18px;">practiceRatio: <span class="t-number">0.70</span>, <span class="t-comment">// 70% практики</span></div>
    <div style="padding-left: 18px;">coworkingAccess: <span class="t-string">"24/7 Unlimited"</span>,</div>
    <div style="padding-left: 18px;">mentorSupport: <span class="t-string">"Senior Lead EPAM"</span>,</div>
    <div style="padding-left: 18px;">aiAssistant: <span class="t-keyword">true</span> <span class="t-comment">// Gemini RAG</span></div>
    <div>});</div>
    <div style="margin-top: 10px;"><span class="t-keyword">await</span> student.<span class="t-function">launchCareer</span>();</div>
    <div style="color: #34d399; margin-top: 4px;">✔ 6 коммерческих проектов в портфолио</div>
    <div style="color: #38bdf8;">Первый оффер в IT: $700+<span class="t-cursor"></span></div>
  `,
  python: `
    <div><span class="t-comment"># Backend & AI Engineering Pipeline</span></div>
    <div><span class="t-keyword">from</span> it_academy <span class="t-keyword">import</span> FastApiApp, GeminiRAG</div>
    <div style="margin-top: 6px;"><span class="t-keyword">async def</span> <span class="t-function">build_production_service</span>():</div>
    <div style="padding-left: 18px;">app = FastApiApp(database=<span class="t-string">"PostgreSQL 16"</span>)</div>
    <div style="padding-left: 18px;">rag = GeminiRAG(model=<span class="t-string">"gemini-3-flash-preview"</span>)</div>
    <div style="padding-left: 18px;"><span class="t-keyword">await</span> app.deploy_docker_container()</div>
    <div style="padding-left: 18px;"><span class="t-keyword">return</span> {<span class="t-string">"status"</span>: <span class="t-string">"HighLoad Ready"</span>, <span class="t-string">"rps"</span>: <span class="t-number">5000</span>}</div>
    <div style="color: #34d399; margin-top: 8px;">✔ Сервис успешно запущен в облаке IT-Park</div>
    <div style="color: #c084fc;">Позиция: Python Backend Junior+ ($850/мес)<span class="t-cursor"></span></div>
  `,
  career: `
    <div><span class="t-comment">// Оффер выпускника IT Academy</span></div>
    <div>{</div>
    <div style="padding-left: 18px;"><span class="t-string">"candidate"</span>: <span class="t-string">"Выпускник Академии"</span>,</div>
    <div style="padding-left: 18px;"><span class="t-string">"company"</span>: <span class="t-string">"FinTech Unicorn Uzbekistan"</span>,</div>
    <div style="padding-left: 18px;"><span class="t-string">"position"</span>: <span class="t-string">"Software Engineer"</span>,</div>
    <div style="padding-left: 18px;"><span class="t-string">"initialSalary"</span>: <span class="t-string">"$750 - $1100"</span>,</div>
    <div style="padding-left: 18px;"><span class="t-string">"probationPeriod"</span>: <span class="t-string">"Passed 100%"</span>,</div>
    <div style="padding-left: 18px;"><span class="t-string">"careerSupport"</span>: <span class="t-keyword">true</span></div>
    <div>}</div>
    <div style="color: #fbbf24; margin-top: 6px;">Официальный диплом и верификация в базе</div>
    <div style="color: #38bdf8;">94% студентов получают оффер за 90 дней<span class="t-cursor"></span></div>
  `
};

if (terminalTabs && terminalBody) {
  terminalTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      terminalTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const termType = tab.getAttribute('data-term');
      if (TERMINAL_SNIPPETS[termType]) {
        terminalBody.innerHTML = TERMINAL_SNIPPETS[termType];
      }
    });
  });
}

/* ==========================================================================
   STAGE 7: MOBILE MENU DRAWER LOGIC
   ========================================================================== */
const mobileMenuBtn = document.getElementById('mobile-menu-toggle');
const mobileNavDrawer = document.getElementById('mobile-nav-drawer');
const mobileAskAiBtn = document.getElementById('mobile-ask-ai-btn');

if (mobileMenuBtn && mobileNavDrawer) {
  mobileMenuBtn.addEventListener('click', () => {
    mobileNavDrawer.classList.toggle('open');
  });

  // Close drawer on link click
  mobileNavDrawer.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileNavDrawer.classList.remove('open');
    });
  });
}

if (mobileAskAiBtn) {
  mobileAskAiBtn.addEventListener('click', () => {
    if (mobileNavDrawer) mobileNavDrawer.classList.remove('open');
    toggleChat(true);
  });
}

/* ==========================================================================
   STAGE 4: INTERACTIVE ORIENTATION QUIZ
   ========================================================================== */

const QUIZ_QUESTIONS = [
  {
    title: "Что вам ближе по духу и интересам?",
    options: [
      { text: "Создавать интерактивные сайты и красивые веб-сервисы", track: "frontend" },
      { text: "Разрабатывать сервера, базы данных и надежные API", track: "backend" },
      { text: "Исследовать логику пользователей, проектировать дизайн в Figma", track: "design" },
      { text: "Контролировать качество, тестировать код и автоматизировать", track: "qa" },
      { text: "Работать с нейросетями, алгоритмами и анализом данных", track: "ai" }
    ]
  },
  {
    title: "Какой у вас текущий опыт в технологиях?",
    options: [
      { text: "Абсолютный новичок, никогда раньше не писал код", trackBonus: "frontend" },
      { text: "Пробовал верстать HTML/CSS или смотрел уроки на YouTube", trackBonus: "frontend" },
      { text: "Знаю основы базового синтаксиса (Python, JS, C++)", trackBonus: "backend" },
      { text: "Работаю в смежной сфере (дизайн, маркетинг, аналитика)", trackBonus: "design" }
    ]
  },
  {
    title: "Какая ваша главная цель на ближайшие 6-8 месяцев?",
    options: [
      { text: "Сменить профессию и получить оффер Junior-разработчика", trackBonus: "frontend" },
      { text: "Запустить свой собственный IT-стартап или SaaS-сервис", trackBonus: "backend" },
      { text: "Выйти на международный фриланс и удаленную работу", trackBonus: "design" },
      { text: "Освоить востребованный технологический стек в FinTech / BigTech", trackBonus: "ai" }
    ]
  }
];

const QUIZ_RESULTS = {
  frontend: {
    track: "Frontend Разработка (React & Next.js)",
    desc: "Идеальный баланс логики и визуального творчества. Вы научитесь строить современные интерфейсы на Next.js 15, оживлять сайты анимациями и работать с API. Огромный спрос среди IT-компаний Узбекистана.",
    courseValue: "1800000"
  },
  backend: {
    track: "Python & Backend Engineering",
    desc: "Архитектура, надежность и мощь. Вы будете создавать высоконагруженные микросервисы, работать с PostgreSQL и Docker, а также подключать Gemini RAG к реальным проектам.",
    courseValue: "1900000"
  },
  design: {
    track: "UI/UX & Product Design",
    desc: "Проектирование цифровых продуктов. Вы освоите создание дизайн-систем в Figma, проведение CustDev-исследований (CJM) и подготовку макетов для передачи в разработку.",
    courseValue: "1700000"
  },
  qa: {
    track: "QA Automation Testing",
    desc: "Самый быстрый и надежный старт в IT. Вы освоите тестирование веб-приложений с помощью Playwright и Python, обеспечивая безупречное качество коммерческих сервисов.",
    courseValue: "1600000"
  },
  ai: {
    track: "Data Science & AI",
    desc: "Технологии будущего уже сегодня. Вы научитесь обучать нейросети на PyTorch, настраивать RAG-пайплайны с LLM и анализировать большие данные для бизнеса.",
    courseValue: "2100000"
  }
};

let currentQuizStep = 0;
let userQuizScores = { frontend: 0, backend: 0, design: 0, qa: 0, ai: 0 };

const quizQuestionBox = document.getElementById('quiz-question-box');
const quizTitleEl = document.getElementById('quiz-q-title');
const quizOptionsEl = document.getElementById('quiz-options-container');
const quizResultBox = document.getElementById('quiz-result-box');
const quizResTrack = document.getElementById('quiz-res-track');
const quizResDesc = document.getElementById('quiz-res-desc');
const quizRestartBtn = document.getElementById('quiz-restart-btn');
const quizStepText = document.getElementById('q-step-text');
const dot1 = document.getElementById('q-dot-1');
const dot2 = document.getElementById('q-dot-2');
const dot3 = document.getElementById('q-dot-3');

function renderQuizQuestion(step) {
  if (!quizQuestionBox || !quizTitleEl || !quizOptionsEl) return;

  const q = QUIZ_QUESTIONS[step];
  quizTitleEl.textContent = q.title;
  quizStepText.textContent = `Вопрос ${step + 1} из 3`;

  [dot1, dot2, dot3].forEach((dot, idx) => {
    if (dot) {
      dot.classList.toggle('active', idx === step);
    }
  });

  quizOptionsEl.innerHTML = '';
  q.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-opt-btn';
    btn.innerHTML = `
      <span>${opt.text}</span>
      <span style="color: var(--text-muted); font-size: 1.1rem;">→</span>
    `;
    btn.addEventListener('click', () => handleQuizOptionSelect(opt));
    quizOptionsEl.appendChild(btn);
  });
}

function handleQuizOptionSelect(opt) {
  if (opt.track) {
    userQuizScores[opt.track] = (userQuizScores[opt.track] || 0) + 2;
  }
  if (opt.trackBonus) {
    userQuizScores[opt.trackBonus] = (userQuizScores[opt.trackBonus] || 0) + 1;
  }

  currentQuizStep++;
  if (currentQuizStep < QUIZ_QUESTIONS.length) {
    renderQuizQuestion(currentQuizStep);
  } else {
    showQuizResult();
  }
}

function showQuizResult() {
  if (!quizQuestionBox || !quizResultBox) return;

  quizQuestionBox.style.display = 'none';
  quizResultBox.style.display = 'block';

  let highestTrack = 'frontend';
  let maxScore = -1;
  for (const [track, score] of Object.entries(userQuizScores)) {
    if (score > maxScore) {
      maxScore = score;
      highestTrack = track;
    }
  }

  const result = QUIZ_RESULTS[highestTrack] || QUIZ_RESULTS.frontend;
  quizResTrack.textContent = result.track;
  quizResDesc.textContent = result.desc;

  const calcSelect = document.getElementById('calc-course-select');
  if (calcSelect && result.courseValue) {
    calcSelect.value = result.courseValue;
    updateCalculator();
  }
}

function resetQuiz() {
  currentQuizStep = 0;
  userQuizScores = { frontend: 0, backend: 0, design: 0, qa: 0, ai: 0 };
  if (quizQuestionBox) quizQuestionBox.style.display = 'block';
  if (quizResultBox) quizResultBox.style.display = 'none';
  renderQuizQuestion(0);
}

if (quizRestartBtn) {
  quizRestartBtn.addEventListener('click', resetQuiz);
}

if (quizOptionsEl) {
  renderQuizQuestion(0);
}

/* ==========================================================================
   STAGE 4: INSTALLMENT CALCULATOR
   ========================================================================== */

const calcCourseSelect = document.getElementById('calc-course-select');
const termButtons = document.querySelectorAll('.term-btn');
const calcTotalSum = document.getElementById('calc-total-sum');
const calcDiscountSum = document.getElementById('calc-discount-sum');
const calcMonthlySum = document.getElementById('calc-monthly-sum');

let selectedTermMonths = 6;

function formatSom(num) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(num)) + ' сум';
}

function updateCalculator() {
  if (!calcCourseSelect || !calcTotalSum || !calcDiscountSum || !calcMonthlySum) return;

  const selectedOpt = calcCourseSelect.options[calcCourseSelect.selectedIndex];
  if (!selectedOpt) return;

  const monthlyBase = parseInt(selectedOpt.value, 10) || 1800000;
  const durationMonths = parseInt(selectedOpt.getAttribute('data-months'), 10) || 7;

  const totalCost = monthlyBase * durationMonths;
  const discount15 = totalCost * 0.15;
  const monthlyInstallment = totalCost / selectedTermMonths;

  calcTotalSum.textContent = formatSom(totalCost);
  calcDiscountSum.textContent = '-' + formatSom(discount15);
  calcMonthlySum.textContent = formatSom(monthlyInstallment) + '/мес';
}

if (calcCourseSelect) {
  calcCourseSelect.addEventListener('change', updateCalculator);
}

termButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    termButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedTermMonths = parseInt(btn.getAttribute('data-term'), 10) || 6;
    updateCalculator();
  });
});

updateCalculator();

/* ==========================================================================
   STAGE 6: LEAD ENROLLMENT FORM & UZBEK PHONE VALIDATION
   ========================================================================== */

const leadEnrollForm = document.getElementById('lead-enroll-form');
const leadPhoneInput = document.getElementById('lead-phone');
const leadNameInput = document.getElementById('lead-name');
const leadCourseSelect = document.getElementById('lead-course');
const enrollSuccessMsg = document.getElementById('enroll-success-msg');

if (leadPhoneInput) {
  leadPhoneInput.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (!val.startsWith('998')) {
      val = '998' + val;
    }
    val = val.substring(0, 12);

    let formatted = '+998';
    if (val.length > 3) {
      formatted += ' (' + val.substring(3, 5);
    }
    if (val.length > 5) {
      formatted += ') ' + val.substring(5, 8);
    }
    if (val.length > 8) {
      formatted += '-' + val.substring(8, 10);
    }
    if (val.length > 10) {
      formatted += '-' + val.substring(10, 12);
    }

    e.target.value = formatted;
  });

  leadPhoneInput.addEventListener('focus', (e) => {
    if (!e.target.value || e.target.value.trim() === '') {
      e.target.value = '+998 ';
    }
  });
}

if (leadEnrollForm) {
  leadEnrollForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = leadNameInput ? leadNameInput.value.trim() : '';
    const phone = leadPhoneInput ? leadPhoneInput.value.trim() : '';
    const course = leadCourseSelect ? leadCourseSelect.options[leadCourseSelect.selectedIndex].text : '';

    if (!name || phone.length < 17) {
      alert('Пожалуйста, введите корректный номер телефона Узбекистана (+998 XX XXX-XX-XX).');
      return;
    }

    if (enrollSuccessMsg) {
      enrollSuccessMsg.style.display = 'block';
      enrollSuccessMsg.innerHTML = `
        <strong>Спасибо, ${name}!</strong> Ваша заявка на курс <em>${course}</em> принята. Ментор свяжется с вами по номеру <code>${phone}</code> в течение 15 минут.
      `;
    }

    if (leadNameInput) leadNameInput.value = '';
    if (leadPhoneInput) leadPhoneInput.value = '+998 ';

    setTimeout(() => {
      if (enrollSuccessMsg) {
        enrollSuccessMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  });
}

/* ==========================================================================
   STAGE 6: FAQ ACCORDION LOGIC
   ========================================================================== */

const faqItems = document.querySelectorAll('.faq-item');

faqItems.forEach(item => {
  const trigger = item.querySelector('.faq-trigger');
  if (trigger) {
    trigger.addEventListener('click', () => {
      const isCurrentlyActive = item.classList.contains('active');
      faqItems.forEach(i => i.classList.remove('active'));
      if (!isCurrentlyActive) {
        item.classList.add('active');
      }
    });
  }
});

/* ==========================================================================
   LANGUAGE SWITCHER (RU <-> UZ)
   ========================================================================== */

const TRANSLATIONS = {
  ru: {
    hero_badge: "IT Academy Hub",
    hero_title_1: "Освойте IT-профессию",
    hero_title_experts: "на практике",
    hero_subtitle: "Изучайте программирование, дизайн и тестирование. Работайте над практическими заданиями и разбирайте проекты с наставниками.",
    hero_search_placeholder: "Чему вы хотите научиться? (Frontend, Python, Design...)",
    hero_search_btn: "Найти",
    hero_cta_explore: "Смотреть все 8 курсов",
    hero_cta_ai: "Спросить о программе",
    terminal_campus_status: "Кампус в Ташкенте: открыт 24/7",
    terminal_start_date: "Старт групп: 10 ноября",
    stat_live_courses: "Онлайн уроков & Практики",
    stat_category: "Направлений & Модулей",
    stat_reviews_count: "1,600+ отзывов в картах",
    stat_professionals: "Выпускников & IT-спецов",
    stat_views: "Просмотров & 24/7 Коворкинг",
    partners_heading: "Наши выпускники работают в ведущих компаниях Узбекистана и мира",
    categories_badge: "Специализации",
    categories_heading: "Выберите направление",
    categories_desc: "Нажмите на категорию, чтобы мгновенно отфильтровать программы обучения.",
    cat_design: "Дизайн",
    cat_dev: "Разработка",
    cat_backend: "Backend и Python",
    cat_mobile: "Мобильная разработка",
    cat_qa: "Тестирование",
    cat_ai: "Данные и AI",
    cat_devops: "DevOps и Cloud",
    cat_security: "Кибербезопасность",
    courses_badge: "Каталог программ",
    courses_heading: "Программы обучения",
    courses_desc: "Изучите направления, учебный план и стоимость обучения."
  },
  uz: {
    hero_badge: "IT Academy Hub",
    hero_title_1: "IT kasbini",
    hero_title_experts: "amaliyotda o'rganing",
    hero_subtitle: "Dasturlash, dizayn va testlashni o'rganing. Amaliy topshiriqlarni bajaring va loyihalarni mentorlar bilan tahlil qiling.",
    hero_search_placeholder: "Nimani o'rganmoqchisiz? (Frontend, Python, Dizayn...)",
    hero_search_btn: "Qidirish",
    hero_cta_explore: "Barcha 8 kursni ko'rish",
    hero_cta_ai: "Dastur haqida so'rash",
    terminal_campus_status: "Toshkentdagi kampus: 24/7 ochiq",
    terminal_start_date: "Guruhlar starti: 10-noyabr",
    stat_live_courses: "Onlayn darslar va amaliyot",
    stat_category: "Yo'nalishlar va modullar",
    stat_reviews_count: "1,600+ ijobiy baholar",
    stat_professionals: "Bitiruvchilar va mutaxassislar",
    stat_views: "Ko'rishlar & 24/7 Kovorking",
    partners_heading: "Bitiruvchilarimiz O'zbekiston va xalqaro yetakchi IT kompaniyalarida ishlaydi",
    categories_badge: "Mutaxassisliklar",
    categories_heading: "Yo'nalishni tanlang",
    categories_desc: "O'quv dasturlarini tezda saralash uchun toifani bosing.",
    cat_design: "Grafika va Dizayn",
    cat_dev: "Web Dasturlash",
    cat_backend: "Backend & Sun'iy Intellekt",
    cat_mobile: "Mobil Dasturlash",
    cat_qa: "QA Testlash",
    cat_ai: "Data Science & AI",
    cat_devops: "DevOps & Cloud",
    cat_security: "Kiberxavfsizlik",
    courses_badge: "Dasturlar katalogi",
    courses_heading: "O'quv dasturlari",
    courses_desc: "Yo'nalishlar, o'quv rejasi va ta'lim narxi bilan tanishing."
  }
};

function setLanguage(lang) {
  const currentTranslations = TRANSLATIONS[lang] || TRANSLATIONS.ru;
  document.documentElement.lang = lang;
  localStorage.setItem('site_lang', lang);

  // Update button active state
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
  });

  // Update all [data-i18n]
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (currentTranslations[key]) {
      el.textContent = currentTranslations[key];
    }
  });

  // Update all [data-i18n-ph]
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.getAttribute('data-i18n-ph');
    if (currentTranslations[key]) {
      el.setAttribute('placeholder', currentTranslations[key]);
    }
  });

  // Update navigation items
  const navLinks = document.querySelectorAll('.nav-item-link, .mobile-nav-link');
  if (navLinks.length >= 6) {
    if (lang === 'uz') {
      navLinks[0].childNodes[0].textContent = 'Kurslar ';
      navLinks[1].childNodes[0].textContent = 'Biz haqimizda ';
      navLinks[2].childNodes[0].textContent = '24/7 Kovorking ';
      navLinks[3].childNodes[0].textContent = 'Karyera ';
      navLinks[4].childNodes[0].textContent = 'Mentorlar ';
      if (navLinks[5]) navLinks[5].childNodes[0].textContent = 'Aloqa ';
    } else {
      navLinks[0].childNodes[0].textContent = 'Курсы ';
      navLinks[1].childNodes[0].textContent = 'О нас ';
      navLinks[2].childNodes[0].textContent = 'Коворкинг 24/7 ';
      navLinks[3].childNodes[0].textContent = 'Карьера ';
      navLinks[4].childNodes[0].textContent = 'Менторы ';
      if (navLinks[5]) navLinks[5].childNodes[0].textContent = 'Контакты ';
    }
  }

  // Update FAB text
  const fabLabel = document.querySelector('.fab-label');
  if (fabLabel) {
    fabLabel.textContent = lang === 'uz' ? 'AI Maslahatchi' : 'ИИ Консультант';
  }
}

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const lang = btn.getAttribute('data-lang');
    setLanguage(lang);
  });
});

// Initialize language from localStorage
const savedLang = localStorage.getItem('site_lang') || 'ru';
setLanguage(savedLang);

/* ==========================================================================
   HERO QUICK SEARCH
   ========================================================================== */

const heroQuickSearch = document.getElementById('hero-quick-search');
const heroSearchBtn = document.getElementById('hero-search-btn');

function executeHeroSearch() {
  if (!heroQuickSearch) return;
  const val = heroQuickSearch.value.trim();
  if (searchInput) {
    searchInput.value = val;
    filterCourses();
  }
  const coursesSec = document.getElementById('courses');
  if (coursesSec) {
    coursesSec.scrollIntoView({ behavior: 'smooth' });
  }
}

if (heroSearchBtn) {
  heroSearchBtn.addEventListener('click', executeHeroSearch);
}

if (heroQuickSearch) {
  heroQuickSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeHeroSearch();
    }
  });
}

/* ==========================================================================
   EXPLORE TOP CATEGORIES CLICKS
   ========================================================================== */

document.querySelectorAll('.category-card-item').forEach(card => {
  card.addEventListener('click', () => {
    const targetCat = card.getAttribute('data-cat-target');
    if (!targetCat) return;

    document.querySelectorAll('.category-card-item').forEach(c => c.classList.remove('active'));
    card.classList.add('active');

    const matchedTab = document.querySelector(`.filter-tab[data-filter="${targetCat}"]`);
    if (matchedTab) {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      matchedTab.classList.add('active');
    }

    if (searchInput) searchInput.value = '';
    filterCourses();

    const coursesSec = document.getElementById('courses');
    if (coursesSec) {
      coursesSec.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

/* ==========================================================================
   POPULAR COURSES SLIDER CONTROLS
   ========================================================================== */

const courseScrollLeft = document.getElementById('course-scroll-left');
const courseScrollRight = document.getElementById('course-scroll-right');
const coursesContainer = document.getElementById('courses-container');

if (courseScrollLeft && coursesContainer) {
  courseScrollLeft.addEventListener('click', () => {
    coursesContainer.scrollBy({ left: -380, behavior: 'smooth' });
  });
}

if (courseScrollRight && coursesContainer) {
  courseScrollRight.addEventListener('click', () => {
    coursesContainer.scrollBy({ left: 380, behavior: 'smooth' });
  });
}

if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.body.classList.add('motion-ready');
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });

  document.querySelectorAll(
    '.hero-center-container > *, .stats-ribbon-card, .category-card-item, .course-card, .section-trust .container > *, .quiz-card, .calc-card, .enroll-card, .faq-item'
  ).forEach((element, index) => {
    element.classList.add('reveal');
    element.style.setProperty('--reveal-delay', `${(index % 5) * 55}ms`);
    revealObserver.observe(element);
  });
}
