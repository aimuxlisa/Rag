/**
 * RAG (Retrieval-Augmented Generation) Engine for IT Academy
 * Индексирует базу знаний учебного центра и обогащает промпты для Gemini API
 */

// Встроенная локальная база знаний (синхронизирована с файлами в knowledge/)
export let KNOWLEDGE_BASE = [
  {
    id: "courses",
    title: "Направления обучения и курсы",
    source: "knowledge/courses.txt",
    content: `
1. Frontend Разработка (Веб-разработка с нуля до PRO):
- Длительность: 7 месяцев (3 раза в неделю по 2 часа + безлимитный коворкинг).
- Стек: HTML5, CSS3, SCSS, JavaScript (ES6+), TypeScript, React.js, Next.js, Redux Toolkit, Tailwind CSS, Git, Webpack/Vite.
- Формат: Офлайн в Ташкенте и Онлайн в интерактивном формате.
- Стоимость: 1 800 000 сум/месяц (скидка 15% при единовременной оплате всего курса).
- Результат: 6 реальных проектов в портфолио, диплом государственного образца, гарантированное собеседование в IT-компании.

2. Python & Backend Разработка (с упором на AI & Fastapi/Django):
- Длительность: 8 месяцев.
- Стек: Python, ООП, PostgreSQL, Redis, Django, FastAPI, Docker, AsyncIO, основы Machine Learning & Gemini API.
- Формат: Офлайн / Онлайн.
- Стоимость: 1 900 000 сум/месяц.
- Результат: Создание высоконагруженных API, Telegram-ботов, микросервисов, портфолио на GitHub.

3. UI/UX & Product Design:
- Длительность: 5 месяцев.
- Инструменты: Figma, FigJam, Adobe Illustrator, Principle, Design Systems, UX Research, CustDev, Wireframing, Prototyping.
- Стоимость: 1 700 000 сум/месяц.
- Результат: 4 кейса на Behance/Dribbble, презентация реального мобильного и веб-продукта.

4. QA Automation & Manual Testing (Тестирование ПО):
- Длительность: 4 месяца.
- Стек: Тест-дизайн, Postman, SQL, Git, автоматизация на Python/Playwright, Selenium, Jira.
- Стоимость: 1 600 000 сум/месяц.
- Результат: Быстрый старт в IT, подготовка к международным сертификациям.

5. Data Science & Artificial Intelligence:
- Длительность: 9 месяцев.
- Стек: Python, Pandas, NumPy, Scikit-learn, PyTorch, LLMs, Prompt Engineering, RAG архитектуры.
- Стоимость: 2 100 000 сум/месяц.
- Результат: Создание собственных ИИ-решений, предсказательных моделей и агентов.

6. Mobile App Development (Flutter & Dart):
- Длительность: 6 месяцев.
- Стек: Dart, Flutter SDK, BLoC, Provider, Firebase, REST API, App Store & Google Play Deployment.
- Формат: Офлайн / Онлайн.
- Стоимость: 1 850 000 сум/месяц.
- Результат: 3 мобильных приложения для iOS и Android, опубликованных в сторах.

7. DevOps & Cloud Engineering:
- Длительность: 6 месяцев.
- Стек: Linux, Bash, Docker, Docker Compose, Kubernetes, CI/CD (GitHub Actions, GitLab CI), AWS, Nginx, Prometheus & Grafana.
- Формат: Офлайн / Онлайн.
- Стоимость: 2 000 000 сум/месяц.
- Результат: Навыки развертывания отказоустойчивой инфраструктуры, автоматизации релизов и мониторинга.

8. Cyber Security & Ethical Hacking:
- Длительность: 6 месяцев.
- Стек: Сетевые протоколы, Kali Linux, Wireshark, Metasploit, OWASP Top 10, аудит уязвимостей, криптография, защита веб-систем.
- Формат: Офлайн / Онлайн.
- Стоимость: 1 950 000 сум/месяц.
- Результат: Сертификат специалиста по информационной безопасности, навыки проведения penetration testing.
    `
  },
  {
    id: "center_info",
    title: "О нас, кампусы и карьерный центр",
    source: "knowledge/center_info.md",
    content: `
О нас:
Мы — ведущая практическая IT-академия нового поколения в Узбекистане, ориентированная на подготовку Junior+ / Middle специалистов по стандартам международных и локальных IT-компаний (на уровне PROWEB, IT Step, Tehnikum).

Преимущества:
- 70% практики, 30% теории: студенты выполняют реальные клиентские и продуктовые кейсы.
- Senior и Lead менторы с практическим опытом из EPAM, IT-Park, банков и финтех-компаний.
- Бесплатный кампус и коворкинг 24/7 со скоростным оптоволоконным интернетом и мощными ПК (Apple iMac / Core i7 32GB).
- Карьерный центр: подготовка резюме международного уровня, тренировочные HR и технические mock-собеседования, прямые рекомендации более чем в 60 IT-компаний партнеров.

Локации и контакты:
- Главный кампус: г. Ташкент, Мирзо-Улугбекский район (ориентир IT-Park / станция метро БИЙ).
- Филиал 2: г. Ташкент, Чиланзарский район.
- Телефон горячей линии: +998 (71) 200-88-00.
- Telegram / Instagram: @it_academy_uz.
- График работы: Ежедневно с 09:00 до 22:00.
    `
  },
  {
    id: "faq",
    title: "Частые вопросы (FAQ), рассрочка и дипломы",
    source: "knowledge/faq.md",
    content: `
1. Нужен ли свой ноутбук?
В учебных классах академии установлены мощные ПК и iMac. Для домашних заданий рекомендуется иметь ноутбук, но студенты могут пользоваться бесплатным открытым коворкингом академии в любое время.

2. Можно ли начать с нуля?
Да, 85% студентов начинают без предварительного опыта в программировании. Вводные модули закладывают основы логики, алгоритмов и цифровой грамотности.

3. Оплата и рассрочка:
Доступна помесячная оплата без процентов, а также официальная банковская рассрочка на 6–12 месяцев через партнеров (Anorbank, Uzum Nasiya, Payme). Скидка 15% при единовременной оплате всего курса.

4. Диплом и сертификация:
Выдается официальный номерной диплом и сертификат на узбекском и английском языках с QR-кодом верификации для работодателей.

5. Бесплатный пробный урок:
Каждую неделю проводятся открытые мастер-классы и индивидуальные пробные уроки с ведущими менторами для выбора профессии.
    `
  }
];

/**
 * Динамическое обновление базы знаний (например, из Google Drive)
 */
export function updateKnowledgeBase(newDocs, replaceAll = false) {
  if (replaceAll) {
    KNOWLEDGE_BASE = newDocs;
  } else {
    // Дополняем или заменяем документы по id
    newDocs.forEach(newDoc => {
      const idx = KNOWLEDGE_BASE.findIndex(d => d.id === newDoc.id);
      if (idx !== -1) {
        KNOWLEDGE_BASE[idx] = newDoc;
      } else {
        KNOWLEDGE_BASE.unshift(newDoc);
      }
    });
  }
  console.log(`[RAG] База знаний успешно обновлена: ${KNOWLEDGE_BASE.length} документов.`);
  return KNOWLEDGE_BASE;
}

/**
 * RAG Поисковый алгоритм: находит релевантные фрагменты базы знаний под запрос пользователя
 */
export function retrieveContext(query, topK = 2) {
  const normalizedQuery = query.toLowerCase();
  const words = normalizedQuery.split(/[\s,?.!]+/).filter(w => w.length > 2);

  const scoredDocs = KNOWLEDGE_BASE.map(doc => {
    let score = 0;
    const docLower = doc.content.toLowerCase();
    const titleLower = doc.title.toLowerCase();

    // Проверка ключевых терминов
    words.forEach(word => {
      const titleMatches = (titleLower.match(new RegExp(word, 'g')) || []).length;
      const contentMatches = (docLower.match(new RegExp(word, 'g')) || []).length;
      score += titleMatches * 5 + contentMatches * 1.5;
    });

    // Тематические бонусы
    if (normalizedQuery.includes("курс") || normalizedQuery.includes("frontend") || normalizedQuery.includes("python") || normalizedQuery.includes("стоим") || normalizedQuery.includes("цен")) {
      if (doc.id === "courses") score += 10;
    }
    if (normalizedQuery.includes("где") || normalizedQuery.includes("адрес") || normalizedQuery.includes("телефон") || normalizedQuery.includes("филиал") || normalizedQuery.includes("ментор")) {
      if (doc.id === "center_info") score += 10;
    }
    if (normalizedQuery.includes("рассрочк") || normalizedQuery.includes("ноутбук") || normalizedQuery.includes("сертификат") || normalizedQuery.includes("диплом") || normalizedQuery.includes("пробн")) {
      if (doc.id === "faq") score += 10;
    }

    return { ...doc, score };
  });

  scoredDocs.sort((a, b) => b.score - a.score);
  return scoredDocs.slice(0, topK);
}

/**
 * Вызов Gemini API с использованием RAG-контекста
 */
export async function generateGeminiRAGResponse({ query, apiKey, chatHistory = [] }) {
  const recentHistory = chatHistory.slice(-7);
  const lastHistoryMessage = recentHistory[recentHistory.length - 1];
  const historyBeforeCurrent = lastHistoryMessage?.role === 'user' && lastHistoryMessage.text?.trim() === query.trim()
    ? recentHistory.slice(0, -1)
    : recentHistory;
  const previousUserQuery = [...historyBeforeCurrent].reverse().find(message => message.role === 'user')?.text || '';
  const isFormatOnlyFollowUp = /^(?:ну\s+)?(?:дай\s+(?:мне\s+)?(?:(?:просто|только)\s+)?список|просто\s+список|только\s+(?:список|названия)|без\s+описани(?:я|й)|коротко|покороче)[.!?\s]*$/i.test(query.trim());
  const retrievalQuery = isFormatOnlyFollowUp && previousUserQuery
    ? `${previousUserQuery}\n${query}`
    : query;

  // 1. Поиск релевантного контекста из базы знаний
  const retrievedDocs = retrieveContext(retrievalQuery);
  const contextText = retrievedDocs.map(d => d.content.trim()).join("\n\n---\n\n");

  const systemInstruction = `Ты — элитный персональный ИИ-консультант практической IT-Академии (в стиле лучших образовательных платформ вроде PROWEB, IT Step, Tehnikum).
Твоя задача — профессионально, тепло и кратко помогать абитуриентам выбрать профессию, рассказывать о курсах, ценах, коворкинге, трудоустройстве и пробных уроках.
Общайся на том языке, на котором обратился пользователь (русский или узбекский).

Строго соблюдай запрошенный пользователем формат и объём. Если он просит «просто список», «только названия» или «без описаний», ответь только списком пунктов без вступления, пояснений и заключения. Для списка курсов, направлений или профессий по умолчанию указывай только названия; если пользователь отдельно просит цены или сроки, добавь только эти данные к названиям, без описаний.

Опирайся на Базу Знаний Академии и не выдумывай факты. Указывай цену, срок или условие, когда это нужно для прямого ответа на вопрос. Не называй файлы базы знаний и не добавляй источники, ссылки или блоки цитирования. Используй простое форматирование и не добавляй эмодзи без необходимости.

БАЗА ЗНАНИЙ (RAG CONTEXT):
${contextText}
`;

  const contents = [];

  // Добавляем до 6 предыдущих сообщений, не дублируя текущий запрос.
  historyBeforeCurrent.slice(-6).forEach(msg => {
    contents.push({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.text }]
    });
  });

  // Добавляем текущий запрос пользователя
  contents.push({
    role: "user",
    parts: [{ text: query }]
  });

  const requestBody = {
    system_instruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: contents,
    generationConfig: {
      maxOutputTokens: 1024,
    }
  };

  const clientApiKey = apiKey && apiKey.trim();
  const serverKeyAvailable = !clientApiKey && typeof window !== 'undefined' && ['http:', 'https:'].includes(window.location.protocol);
  if (!clientApiKey && !serverKeyAvailable) {
    return generateLocalRAGFallback(query, retrievedDocs, chatHistory);
  }

  // Используем ключ из браузера, если он задан; иначе ключ хранится только на сервере в .env.
  const endpoint = clientApiKey
    ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${encodeURIComponent(clientApiKey)}`
    : '/api/gemini';

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(25000)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (!clientApiKey && errorData.code === 'GEMINI_NOT_CONFIGURED') {
        return generateLocalRAGFallback(query, retrievedDocs, chatHistory);
      }
      throw new Error(errorData.error?.message || `Ошибка API: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      throw new Error("Пустой ответ от Gemini API");
    }

    return {
      text: candidateText,
      isRealGemini: true
    };
  } catch (err) {
    console.warn("Gemini API Error, falling back to local RAG engine:", err);
    const fallback = generateLocalRAGFallback(query, retrievedDocs, chatHistory);
    return fallback;
  }
}

/**
 * Локальный ответ на основе RAG, если Gemini API недоступен
 */
function generateLocalRAGFallback(query, docs, chatHistory = []) {
  const wantsSimpleList = /(?:просто\s+спис(?:ок|ком)|только\s+(?:список|названия)|без\s+описани|дай\s+(?:мне\s+)?(?:(?:просто|только)\s+)?список|перечисли|just\s+(?:a\s+)?list|list\s+only)/i.test(query);
  const previousUserQuery = [...chatHistory].reverse().find(message => message.role === 'user' && message.text?.trim() !== query.trim())?.text || '';
  const queryWithContext = wantsSimpleList && previousUserQuery ? `${query} ${previousUserQuery}` : query;
  const q = queryWithContext.toLowerCase();
  let answer = "";
  const uploadedDocs = docs.filter(doc => doc.id.startsWith('upload_'));
  const queryTerms = q.match(/[\p{L}\d]{3,}/gu) || [];
  const matchingUploadedLines = uploadedDocs
    .flatMap(doc => doc.content.split(/\r?\n\s*\r?\n/).map(block => block.trim()).filter(Boolean))
    .map(line => ({
      line,
      score: queryTerms.reduce((score, term) => score + (line.toLowerCase().includes(term) ? 1 : 0), 0)
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => item.line);

  const courseDoc = docs.find(doc => doc.id === 'courses');
  const isCourseList = /(?:курс|направлени|професс|специальност|программ)/i.test(q);

  if (wantsSimpleList && isCourseList && courseDoc) {
    const includePrice = /(?:цен|стоим|сколько\s+стоит)/i.test(query);
    const includeDuration = /(?:срок|длитель|сколько\s+длится)/i.test(query);
    const courseEntries = [...courseDoc.content.matchAll(/^\s*\d+\.\s+(.+)$/gm)];
    answer = courseEntries.map((entry, index) => {
      const nextEntry = courseEntries[index + 1];
      const end = nextEntry ? nextEntry.index : courseDoc.content.length;
      const lines = courseDoc.content.slice(entry.index, end).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      const title = entry[1].trim();
      const details = lines.filter(line =>
        (includePrice && /^Стоимость:/i.test(line)) ||
        (includeDuration && /^Длительность:/i.test(line))
      ).map(line => line.replace(/^[^:]+:\s*/, ''));
      return `• ${title}${details.length ? ` — ${details.join('; ')}` : ''}`;
    }).join('\n');
  } else if (wantsSimpleList && matchingUploadedLines.length > 0) {
    answer = matchingUploadedLines.map(line => `• ${line}`).join('\n');
  } else if (wantsSimpleList) {
    answer = 'Уточните, что именно перечислить.';
  } else if (matchingUploadedLines.length > 0) {
    answer = matchingUploadedLines.join('\n');
  } else if (q.includes("курс") || q.includes("frontend") || q.includes("веб") || q.includes("python") || q.includes("дизайн") || q.includes("qa") || q.includes("data science")) {
    answer = courseDoc
      ? `**Направления обучения и курсы:**\n\n${courseDoc.content.trim()}`
      : `**Направления обучения в IT-Академии:**\n\nСписок программ доступен в каталоге на сайте.`;

  } else if (q.includes("рассрочк") || q.includes("оплат") || q.includes("цен") || q.includes("скидк")) {
    answer = `💳 **Условия оплаты и скидки:**\n\n` +
      `• **Помесячная оплата:** Без переплат и скрытых комиссий.\n` +
      `• **Беспроцентная рассрочка:** На 6–12 месяцев через партнеров (Anorbank, Uzum Nasiya, Payme).\n` +
      `• **Скидка 15%:** При оплате полного курса одним платежом.\n\n` +
      `Хотите, я помогу рассчитать график платежей под выбранное направление?`;
  } else if (q.includes("где") || q.includes("адрес") || q.includes("контакт") || q.includes("филиал") || q.includes("телефон")) {
    answer = `📍 **Наши кампусы и контакты в Ташкенте:**\n\n` +
      `• **Главный кампус:** г. Ташкент, Мирзо-Улугбекский р-н (ориентир IT-Park / ст. м. БИЙ).\n` +
      `• **Филиал 2:** г. Ташкент, Чиланзарский р-н.\n` +
      `• 📞 **Телефон:** +998 (71) 200-88-00\n` +
      `• 🕒 **График:** Ежедневно с 09:00 до 22:00 (Коворкинг для студентов 24/7).\n` +
      `• ✈️ **Telegram:** @it_academy_uz`;
  } else if (q.includes("ноутбук") || q.includes("пк") || q.includes("компьютер")) {
    answer = `💻 **Техническое оснащение:**\n\n` +
      `В наших аудиториях установлены производительные компьютеры (Apple iMac и рабочие станции Core i7, 32GB RAM). Для занятий в классах ноутбук брать не обязательно! А для самостоятельной работы вам доступен наш бесплатный 24/7 коворкинг.`;
  } else if (q.includes("пробн") || q.includes("запис") || q.includes("старт") || q.includes("урок")) {
    answer = `🎁 **Бесплатный пробный урок:**\n\n` +
      `Вы можете посетить вводное занятие по любому из направлений (Frontend, Python, UI/UX, QA, Data Science) абсолютно бесплатно! Ментор познакомит вас с профессией и поможет написать первый код.\n\n` +
      `Оставьте свое имя и номер телефона прямо здесь в чате или через форму на сайте!`;
  } else {
    answer = `Здравствуйте! Я — интеллектуальный RAG-консультант IT-Академии. 🎓\n\n` +
      `Я подключен к базе знаний академии и помогу вам:\n` +
      `• Подобрать идеальное IT-направление под ваши цели;\n` +
      `• Узнать длительность, программу и стоимость курсов;\n` +
      `• Записаться на бесплатный пробный урок;\n` +
      `• Узнать про 24/7 коворкинг, трудоустройство и рассрочку.\n\n` +
      `*Задайте любой интересующий вас вопрос!*`;
  }

  return {
    text: answer,
    isRealGemini: false,
    isLocalFallback: true
  };
}
