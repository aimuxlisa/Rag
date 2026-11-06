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
  // 1. Поиск релевантного контекста из базы знаний
  const retrievedDocs = retrieveContext(query);
  const contextText = retrievedDocs.map(d => `[Источник: ${d.title} (${d.source})]:\n${d.content.trim()}`).join("\n\n---\n\n");

  const systemInstruction = `Ты — элитный персональный ИИ-консультант практической IT-Академии (в стиле лучших образовательных платформ вроде PROWEB, IT Step, Tehnikum).
Твоя задача — профессионально, тепло, экспертно и емко помогать абитуриентам выбрать профессию, рассказывать о курсах, ценах, коворкинге, трудоустройстве и пробных уроках.
Общайся на том языке, на котором обратился пользователь (русский или узбекский).

Всегда опирайся на проверенную Базу Знаний Академии (RAG Context) приведенную ниже. Если в базе знаний есть конкретная цена, длительность или условие — обязательно приводи их. Если информации нет, честно предложи записаться на бесплатный пробный урок или связаться с карьерным консультантом по телефону +998 (71) 200-88-00.

Используй форматирование: эмодзи, списки, выделение ключевых слов жирным шрифтом.

БАЗА ЗНАНИЙ (RAG CONTEXT):
${contextText}
`;

  // Если API-ключ не указан, используем умный локальный генератор ответов на базе RAG
  if (!apiKey || apiKey.trim() === "") {
    return generateLocalRAGFallback(query, retrievedDocs);
  }

  // 2. Отправка в Google Gemini API (gemini-2.5-flash / gemini-1.5-flash)
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`;

  const contents = [];

  // Добавляем историю диалога (до 6 последних сообщений)
  chatHistory.slice(-6).forEach(msg => {
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

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Ошибка API: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      throw new Error("Пустой ответ от Gemini API");
    }

    return {
      text: candidateText,
      sources: retrievedDocs.map(d => ({ title: d.title, source: d.source })),
      isRealGemini: true
    };
  } catch (err) {
    console.warn("Gemini API Error, falling back to local RAG engine:", err);
    const fallback = generateLocalRAGFallback(query, retrievedDocs);
    fallback.errorWarning = `(Примечание: Запрос обработан локальным RAG-движком из-за сбоя внешнего API: ${err.message})`;
    return fallback;
  }
}

/**
 * Локальный симулятор RAG, если Gemini API ключ еще не сохранен пользователем
 */
function generateLocalRAGFallback(query, docs) {
  const q = query.toLowerCase();
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

  if (matchingUploadedLines.length > 0) {
    answer = `**По добавленным документам:**\n\n${matchingUploadedLines.join('\n')}`;
  } else if (q.includes("курс") || q.includes("frontend") || q.includes("веб") || q.includes("python") || q.includes("дизайн") || q.includes("qa") || q.includes("data science")) {
    const courseDoc = docs.find(doc => doc.id === 'courses');
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
    sources: docs.map(d => ({ title: d.title, source: d.source })),
    isRealGemini: false,
    isLocalFallback: true
  };
}
