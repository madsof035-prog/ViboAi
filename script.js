let conversationHistory = [];

const messageForm = document.querySelector(".prompt__form");
const chatHistoryContainer = document.querySelector(".chats");
const suggestionItems = document.querySelectorAll(".suggests__item");

const themeToggleButton = document.getElementById("themeToggler");
const clearChatButton = document.getElementById("deleteButton");
const imageButton = document.getElementById("imageBtn");
const imageServiceNotification = document.getElementById("imageServiceNotification");
const closeNotificationButton = document.getElementById("closeNotification");

// عناصر حاوية خيارات البحث
const searchOptionsContainer = document.getElementById("searchOptionsContainer");
const cameraBtn = document.getElementById("cameraBtn");
const galleryBtn = document.getElementById("galleryBtn");
const filesBtn = document.getElementById("filesBtn");
const internetSearchBtn = document.getElementById("internetSearchBtn");

// عناصر مؤشر البحث
const searchIndicator = document.getElementById("searchIndicator");
const searchCloseBtn = document.getElementById("searchCloseBtn");
const inputWrapper = document.querySelector(".prompt__input-wrapper");

// عناصر نافذة عرض الصورة بملء الشاشة
const imageFullscreenOverlay = document.getElementById("imageFullscreenOverlay");
const fullscreenClose = document.getElementById("fullscreenClose");
const fullscreenImage = document.getElementById("fullscreenImage");
const fullscreenDownload = document.getElementById("fullscreenDownload");

// احصل على عنصر textarea
const textarea = document.querySelector('.prompt__form-input');

// State variables
let currentUserMessage = null;
let isGeneratingResponse = false;
let isSearchMode = false;

import config from "./config.js";

// Initialize highlight.js with common languages
hljs.configure({
    languages: ['javascript', 'python', 'bash', 'typescript', 'json', 'html', 'css']
});

// Initialize highlight.js
hljs.highlightAll();

const API_REQUEST_URL = `${config.API_BASE_URL}/models/${config.MODEL_NAME}:generateContent?key=${config.GEMINI_API_KEY}`;

// دالة لتحميل الإعدادات المخصصة للبوت
const loadCustomBotSettings = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const botId = urlParams.get('bot');
    
    if (botId) {
        // تحميل الإعدادات المخصصة من localStorage
        const savedSettings = localStorage.getItem('botCustomSettings');
        if (savedSettings) {
            try {
                return JSON.parse(savedSettings);
            } catch (error) {
                console.error('خطأ في تحميل إعدادات البوت:', error);
            }
        }
    }
    return null;
};

// دالة إنشاء تعليمات النظام المخصصة
const createCustomSystemInstructions = (settings) => {
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    
    let workingHoursStatus = "";
    if (settings.startTime && settings.endTime) {
        const [startHour, startMinute] = settings.startTime.split(':').map(Number);
        const [endHour, endMinute] = settings.endTime.split(':').map(Number);
        
        const currentTimeInMinutes = currentHour * 60 + currentMinutes;
        const startTimeInMinutes = startHour * 60 + startMinute;
        const endTimeInMinutes = endHour * 60 + endMinute;
        
        if (currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes) {
            workingHoursStatus = "نحن مفتوحون الآن";
        } else {
            workingHoursStatus = "نحن مغلقون الآن";
        }
    }

    return `
أنت مساعد ذكي مخصص لـ ${settings.workType}. 

معلومات العمل:
- نوع العمل: ${settings.workType}
- ساعات العمل: من ${settings.startTime} إلى ${settings.endTime}
- الحالة الحالية: ${workingHoursStatus}
- أسلوب الرد: ${settings.responseStyle}

التعليمات الأساسية:
${settings.basicInstructions}

🔹 قواعد التنسيق:
1. اكتب العناوين بخط كبير وعريض (استخدم <h2> أو <h1> للعناوين الرئيسية) بدون **.  
2. أبرز المصطلحات المهمة والنص المهم بالخط العريض.  
3. استخدم النقاط (•) للقوائم.  
4. أدرج <hr class="hr-dots"> بين الأقسام المختلفة لفصل المحتوى.  
5. اجعل الفقرات موجزة وسهلة المسح.  
6. ابدأ كل إجابة بعنوان واضح متعلق بالسؤال.  
7. أضف اقتراحاً مفيداً أو سؤالاً في النهاية لتوجيه المستخدم.
8. استخدم رموز تعبيرية لطيفة ومضحكة في أماكن غير متوقعة.

🎯 هدفك هو جعل تجربة المستخدم سلسة وممتعة، مع تقديم قيمة حقيقية تتجاوز توقعاتهم.

تذكر: التزم بأسلوب الرد المحدد (${settings.responseStyle}) في جميع ردودك.
`;
};

// دالة لإعادة ضبط textarea إلى الحجم الطبيعي
const resetTextareaHeight = () => {
  if (textarea) {
    textarea.style.height = 'auto';
    textarea.style.overflowY = 'hidden';
    // إعادة ضبط إلى الارتفاع الأساسي (3rem كما هو محدد في CSS)
    textarea.style.height = '3rem';
    
    // إزالة أي padding إضافي من وضع البحث
    if (inputWrapper) {
      inputWrapper.classList.remove("search-active");
    }
    
    // التأكد من إخفاء مؤشر البحث
    if (searchIndicator) {
      searchIndicator.classList.add("hide");
    }
    
    isSearchMode = false;
  }
};

// دالة لاكتشاف الكلمات المفتاحية لتوليد الصور
const isImageGenerationRequest = (message) => {
  const lowerMessage = message.toLowerCase();
  
  // كلمات مفتاحية تدل على طلب توليد صورة
  const imageKeywords = [
    // كلمات عربية
    'ارسم', 'اصنع صورة', 'انشئ صورة', 'ولد صورة', 'اعمل صورة',
    'صورة', 'رسم', 'رسمة', 'تصميم', 'اريد صورة', 'اعطني صورة',
    'انشاء صورة', 'توليد صورة', 'اصنع لي', 'ارسم لي',
    
    // كلمات إنجليزية
    'draw', 'create image', 'generate image', 'make image', 'design',
    'picture', 'photo', 'illustration', 'artwork', 'sketch',
    'paint', 'render', 'visualize', 'show me', 'create a picture'
  ];
  
  return imageKeywords.some(keyword => lowerMessage.includes(keyword));
};

// دالة توليد الصور باستخدام Pollinations API
const generateImage = async (prompt) => {
  try {
    // تحسين النص للحصول على صور أفضل
    const enhancedPrompt = `${prompt}, high quality, detailed, professional, 4k resolution`;
    
    // استخدام Pollinations API لتوليد الصور
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&seed=${Math.floor(Math.random() * 1000000)}`;
    
    // التحقق من أن الصورة تم تحميلها بنجاح
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(imageUrl);
      img.onerror = () => reject(new Error('فشل في تحميل الصورة'));
      img.src = imageUrl;
    });
  } catch (error) {
    console.error("خطأ في توليد الصورة:", error);
    throw new Error("حدث خطأ أثناء توليد الصورة");
  }
};

// دالة لتنزيل الصورة
const downloadImage = async (imageUrl, filename = 'generated-image.jpg') => {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('خطأ في تنزيل الصورة:', error);
    alert('حدث خطأ أثناء تنزيل الصورة');
  }
};

// دالة لعرض الصورة المولدة
const displayGeneratedImage = (imageUrl, messageElement, incomingMessageElement) => {
  const imageContainer = document.createElement('div');
  imageContainer.className = 'generated-image-container';
  
  const img = document.createElement('img');
  img.src = imageUrl;
  img.className = 'generated-image';
  img.alt = 'Generated Image';
  
  // زر التنزيل
  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'image-download-btn';
  downloadBtn.innerHTML = '<i class="bx bx-download"></i>';
  downloadBtn.onclick = (e) => {
    e.stopPropagation();
    downloadImage(imageUrl);
  };
  
  // عند النقر على الصورة - عرض بملء الشاشة
  img.onclick = () => {
    fullscreenImage.src = imageUrl;
    imageFullscreenOverlay.classList.remove('hide');
  };
  
  imageContainer.appendChild(img);
  imageContainer.appendChild(downloadBtn);
  
  // استبدال مؤشر التحميل بالصورة
  messageElement.innerHTML = '';
  messageElement.appendChild(imageContainer);
  
  // إظهار زر النسخ
  const copyIconElement = incomingMessageElement.querySelector(".message__icon");
  copyIconElement.classList.remove("hide");
  
  isGeneratingResponse = false;
  
  // التمرير إلى الأسفل
  scrollToBottom();
};

// معالجات أحداث نافذة عرض الصورة بملء الشاشة
fullscreenClose.addEventListener('click', () => {
  imageFullscreenOverlay.classList.add('hide');
});

fullscreenDownload.addEventListener('click', () => {
  const imageUrl = fullscreenImage.src;
  if (imageUrl) {
    downloadImage(imageUrl);
  }
});

// إغلاق النافذة عند النقر خارج الصورة
imageFullscreenOverlay.addEventListener('click', (e) => {
  if (e.target === imageFullscreenOverlay) {
    imageFullscreenOverlay.classList.add('hide');
  }
});

// دالة لتحديد ما إذا كانت الرسالة تحتاج للبحث في الإنترنت - محدودة جداً
const needsInternetSearch = (message) => {
  // إذا كان في وضع البحث، فنعم نحتاج للبحث
  if (isSearchMode) {
    return true;
  }

  const lowerMessage = message.toLowerCase();
  
  // كلمات مفتاحية محدودة جداً للبحث التلقائي فقط
  const limitedSearchKeywords = [
    // كلمات البحث المباشرة فقط
    'ابحث', 'بحث',
    
    // أسئلة الأسعار والتواريخ المباشرة فقط
    'كم سعر', 'كم التاريخ', 'كم تاريخ',
    'ما سعر', 'ما التاريخ', 'ما تاريخ'
  ];
  
  // فحص دقيق جداً - يجب أن تبدأ الرسالة بإحدى هذه الكلمات أو تحتويها بوضوح
  const hasLimitedSearchKeywords = limitedSearchKeywords.some(keyword => {
    return lowerMessage.startsWith(keyword) || lowerMessage.includes(' ' + keyword + ' ') || lowerMessage.includes(' ' + keyword);
  });
  
  return hasLimitedSearchKeywords;
};

// دالة البحث في الإنترنت باستخدام Serper API
const fetchSearchResults = async (query) => {
  try {
    const response = await fetch(config.SERPER_API_URL, {
      method: "POST",
      headers: {
        "X-API-KEY": config.SERPER_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        q: query,
        gl: "ye" // اليمن كموقع افتراضي
      })
    });

    if (!response.ok) {
      throw new Error(`Search API error: ${response.status}`);
    }

    const data = await response.json();
    
    // استخراج أهم 3 نتائج
    const results = data.organic?.slice(0, 3) || [];
    
    if (results.length === 0) {
      return "لم يتم العثور على نتائج بحث حديثة.";
    }

    // تنسيق النتائج
    let formattedResults = "نتائج البحث الحديثة:\n\n";
    results.forEach((result, index) => {
      formattedResults += `${index + 1}. العنوان: ${result.title}\n`;
      formattedResults += `   الوصف: ${result.snippet}\n`;
      formattedResults += `   المصدر: ${result.link}\n\n`;
    });

    return formattedResults;
  } catch (error) {
    console.error("خطأ في البحث:", error);
    return "حدث خطأ أثناء البحث في الإنترنت.";
  }
};

// وظيفة لاكتشاف النص العربي
const isArabicText = (text) => {
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFE70-\uFEFF]/;
  return arabicPattern.test(text);
};

// وظيفة لتطبيق الاتجاه المناسب للنص
const applyTextDirection = (element, text) => {
  if (isArabicText(text)) {
    element.classList.add('rtl-text');
    element.classList.remove('ltr-text');
  } else {
    element.classList.add('ltr-text');
    element.classList.remove('rtl-text');
  }
};

// Auto scroll to bottom function
const scrollToBottom = () => {
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
};

// Load saved data from local storage
const loadSavedChatHistory = () => {
  const savedConversations =
    JSON.parse(localStorage.getItem("saved-api-chats")) || [];
  const isLightTheme = localStorage.getItem("themeColor") === "light_mode";

  document.body.classList.toggle("light_mode", isLightTheme);
  themeToggleButton.innerHTML = isLightTheme
    ? '<i class="bx bx-moon"></i>'
    : '<i class="bx bx-sun"></i>';

  chatHistoryContainer.innerHTML = "";
  conversationHistory = [];

  // Iterate through saved chat history and display messages
  savedConversations.forEach((conversation) => {
    // إضافة رسالة المستخدم إلى conversationHistory
    conversationHistory.push({
      role: "user",
      parts: [{ text: conversation.userMessage }]
    });

    // Display the user's message
    const userMessageHtml = `
            <div class="message__content">
    <p class="message__text"></p>
</div>
        `;

    const outgoingMessageElement = createChatMessageElement(
      userMessageHtml,
      "message--outgoing"
    );
    
    // تطبيق الاتجاه على رسالة المستخدم
    const userTextElement = outgoingMessageElement.querySelector(".message__text");
    userTextElement.textContent = conversation.userMessage;
    applyTextDirection(userTextElement, conversation.userMessage);
    
    chatHistoryContainer.appendChild(outgoingMessageElement);

    // التحقق من وجود صورة محفوظة
    if (conversation.isImage && conversation.imageUrl) {
      // إنشاء رسالة واردة للصورة
      const imageResponseHtml = `
        <div class="message__content">
          <p class="message__text"></p>
          <div class="message__loading-indicator hide">
            <div class="message__loading-bar"></div>
          </div>
        </div>
        <span onClick="copyMessageToClipboard(this)" class="message__icon">
          <i class='bx bx-copy-alt'></i>
        </span>
      `;

      const incomingImageElement = createChatMessageElement(
        imageResponseHtml,
        "message--incoming"
      );
      chatHistoryContainer.appendChild(incomingImageElement);

      const messageTextElement = incomingImageElement.querySelector(".message__text");
      
      // عرض الصورة المحفوظة
      displayGeneratedImage(conversation.imageUrl, messageTextElement, incomingImageElement);
      
      // إضافة الصورة إلى conversationHistory كنص وصفي
      conversationHistory.push({
        role: "model",
        parts: [{ text: `تم توليد صورة بناءً على طلبك: "${conversation.userMessage}"` }]
      });
    } else {
      // Display the API response (النص العادي)
      const responseText =
        conversation.apiResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      // إضافة رد AI إلى conversationHistory
      if (responseText) {
        conversationHistory.push({
          role: "model",
          parts: [{ text: responseText }]
        });
      }

      const parsedApiResponse = marked.parse(responseText); // Convert to HTML
      const rawApiResponse = responseText; // Plain text version

      const responseHtml = `
            <div class="message__content">
      <p class="message__text"></p>
      <div class="message__loading-indicator hide">
          <div class="message__loading-bar"></div>
      </div>
  </div>
  <span onClick="copyMessageToClipboard(this)" class="message__icon hide">
      <i class='bx bx-copy-alt'></i>
  </span>
          `;

      const incomingMessageElement = createChatMessageElement(
        responseHtml,
        "message--incoming"
      );
      chatHistoryContainer.appendChild(incomingMessageElement);

      const messageTextElement =
        incomingMessageElement.querySelector(".message__text");

      // تطبيق الاتجاه على رد الـ AI
      applyTextDirection(messageTextElement, rawApiResponse);

      // Display saved chat without typing effect
      showTypingEffect(
        rawApiResponse,
        parsedApiResponse,
        messageTextElement,
        incomingMessageElement,
        true
      ); // 'true' skips typing
    }
  });

  document.body.classList.toggle("hide-header", savedConversations.length > 0);
  
  // Scroll to bottom after loading chat history
  setTimeout(() => {
    scrollToBottom();
  }, 100);
};

// create a new chat message element
const createChatMessageElement = (htmlContent, ...cssClasses) => {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message", ...cssClasses);
  messageElement.innerHTML = htmlContent;
  return messageElement;
};

// Show typing effect
const showTypingEffect = (
  rawText,
  htmlText,
  messageElement,
  incomingMessageElement,
  skipEffect = false
) => {
  const copyIconElement =
    incomingMessageElement.querySelector(".message__icon");
  copyIconElement.classList.add("hide"); // Initially hide copy button

  if (skipEffect) {
    // Display content directly without typing
    messageElement.innerHTML = htmlText;
    hljs.highlightAll();
    addCopyButtonToCodeBlocks();
    copyIconElement.classList.remove("hide"); // Show copy button
    isGeneratingResponse = false;
    return;
  }

  const wordsArray = rawText.split(" ");
  let wordIndex = 0;

  const typingInterval = setInterval(() => {
    messageElement.innerText +=
      (wordIndex === 0 ? "" : " ") + wordsArray[wordIndex++];
    
    // Auto scroll with each word during typing effect
    scrollToBottom();
    
    if (wordIndex === wordsArray.length) {
      clearInterval(typingInterval);
      isGeneratingResponse = false;
      messageElement.innerHTML = htmlText;
      hljs.highlightAll();
      addCopyButtonToCodeBlocks();
      copyIconElement.classList.remove("hide");
      
      // Final scroll to bottom after typing is complete
      scrollToBottom();
    }
  }, 15);
};

// Fetch API response based on user input
const requestApiResponse = async (incomingMessageElement) => {
  const messageTextElement =
    incomingMessageElement.querySelector(".message__text");

  try {
    // تحديد ما إذا كانت الرسالة تحتاج للبحث
    const shouldSearch = needsInternetSearch(currentUserMessage);
    
    let searchResults = "";
    let finalMessage = currentUserMessage;
    
    // إجراء البحث فقط إذا كانت الرسالة تحتاج لذلك
    if (shouldSearch) {
      console.log("🔍 البحث مطلوب للرسالة:", currentUserMessage);
      searchResults = await fetchSearchResults(currentUserMessage);
      
      // تجهيز الرسالة مع نتائج البحث
      finalMessage = `
السؤال:
${currentUserMessage}

${searchResults}

بناءً على هذه النتائج، أعطِ إجابة واضحة ومفيدة للمستخدم بدون عرض JSON أو روابط خام. استخدم المعلومات من نتائج البحث لتقديم إجابة دقيقة ومحدثة.
`;
    } else {
      console.log("💬 محادثة عادية، لا حاجة للبحث:", currentUserMessage);
    }
    
    // تحميل الإعدادات المخصصة للبوت
    const customSettings = loadCustomBotSettings();
    
    // System instructions for the model
    let systemInstructions;
    if (customSettings) {
      systemInstructions = createCustomSystemInstructions(customSettings);
    } else {
      systemInstructions = `
You are an advanced AI assistant trained by ViboAi. Your mission is to respond to user inquiries in a friendly, professional, and clear manner.  

🔹 Formatting Rules:
1. Always write titles in a large, bold font (use <h2> or <h1> for major titles) no **.  
2. Highlight key terms and important text in bold.  
3. Use bullet points (•) for lists.  
4. Insert <hr class="hr-dots"> between different sections to separate content.  
5. Make paragraphs concise and easy to scan.  
6. Start each answer with a clear title relevant to the question.  
7. Add a helpful suggestion or question at the end to guide the user, for example, do you want me to write...
8. When you search the Internet, do not say in your response, for example, (hello - welcome - etc...)
9. Use cute and funny emojis in unexpected places.
10. You can create images.

🎯 Your goal is to make the user experience smooth and enjoyable, while providing real value that exceeds their expectations.
`;
    }

    // إضافة رسالة المستخدم إلى conversationHistory
    conversationHistory.push({
      role: "user",
      parts: [{ text: finalMessage }]
    });

    // تحضير المحتوى للإرسال إلى API (مع التعليمات النظام + كامل conversationHistory)
    const apiContents = [
      { role: "user", parts: [{ text: systemInstructions }] },
      ...conversationHistory
    ];

    const response = await fetch(API_REQUEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: apiContents,
      }),
    });

    const responseData = await response.json();
    if (!response.ok) throw new Error(responseData.error.message);

    const responseText =
      responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) throw new Error("Invalid API response.");

    // إضافة رد AI إلى conversationHistory
    conversationHistory.push({
      role: "model",
      parts: [{ text: responseText }]
    });

    const parsedApiResponse = marked.parse(responseText);
    const rawApiResponse = responseText;

    // تطبيق الاتجاه على رد الـ AI
    applyTextDirection(messageTextElement, rawApiResponse);

    showTypingEffect(
      rawApiResponse,
      parsedApiResponse,
      messageTextElement,
      incomingMessageElement
    );

    // Save conversation in local storage
    let savedConversations =
      JSON.parse(localStorage.getItem("saved-api-chats")) || [];
    savedConversations.push({
      userMessage: currentUserMessage,
      apiResponse: responseData,
    });
    localStorage.setItem("saved-api-chats", JSON.stringify(savedConversations));
  } catch (error) {
    isGeneratingResponse = false;
    messageTextElement.innerText = error.message;
    messageTextElement.closest(".message").classList.add("message--error");
    
    // Scroll to bottom even on error
    scrollToBottom();
  } finally {
    incomingMessageElement.classList.remove("message--loading");
  }
};

// دالة معالجة طلب توليد الصورة
const handleImageGeneration = async (incomingMessageElement) => {
  const messageTextElement = incomingMessageElement.querySelector(".message__text");

  try {
    console.log("🎨 توليد صورة للنص:", currentUserMessage);
    
    // إرسال الطلب إلى Gemini للحصول على وصف إنجليزي
    const englishDescription = await getEnglishDescriptionFromGemini(currentUserMessage);
    
    // توليد الصورة باستخدام الوصف الإنجليزي
    const imageUrl = await generateImage(englishDescription);
    
    // عرض الصورة المولدة
    displayGeneratedImage(imageUrl, messageTextElement, incomingMessageElement);
    
    // حفظ المحادثة في التخزين المحلي مع بيانات الصورة
    let savedConversations = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
    savedConversations.push({
      userMessage: currentUserMessage,
      apiResponse: {
        candidates: [{
          content: {
            parts: [{
              text: `تم توليد صورة بناءً على طلبك: "${currentUserMessage}"`
            }]
          }
        }]
      },
      isImage: true,
      imageUrl: imageUrl
    });
    localStorage.setItem("saved-api-chats", JSON.stringify(savedConversations));
    
  } catch (error) {
    isGeneratingResponse = false;
    messageTextElement.innerText = `خطأ في توليد الصورة: ${error.message}`;
    messageTextElement.closest(".message").classList.add("message--error");
    scrollToBottom();
  } finally {
    incomingMessageElement.classList.remove("message--loading");
  }
};

// دالة للحصول على وصف إنجليزي من Gemini
const getEnglishDescriptionFromGemini = async (userPrompt) => {
  try {
    const systemInstructions = `
You are an expert image description generator. Your task is to convert any user request (in any language) into a detailed, professional English description suitable for AI image generation.

Rules:
1. Always respond ONLY with the English description, no explanations or additional text
2. Make the description detailed and specific for better image quality
3. Include artistic style, lighting, composition details when appropriate
4. Keep it under 200 characters for optimal results
5. Focus on visual elements that can be rendered in an image

Example:
User: "ارسم قطة جميلة"
Response: "Beautiful fluffy cat with bright eyes, sitting gracefully, soft lighting, detailed fur texture, photorealistic style"
`;

    const response = await fetch(API_REQUEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: systemInstructions }] },
          { role: "user", parts: [{ text: userPrompt }] }
        ],
      }),
    });

    const responseData = await response.json();
    if (!response.ok) throw new Error(responseData.error.message);

    const englishDescription = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!englishDescription) throw new Error("فشل في الحصول على وصف من Gemini");

    console.log("📝 الوصف الإنجليزي من Gemini:", englishDescription);
    return englishDescription.trim();
    
  } catch (error) {
    console.error("خطأ في الحصول على وصف من Gemini:", error);
    // في حالة الفشل، استخدم النص الأصلي
    return userPrompt;
  }
};

// Add copy button to code blocks
const addCopyButtonToCodeBlocks = () => {
  const codeBlocks = document.querySelectorAll("pre");
  codeBlocks.forEach((block) => {
    const codeElement = block.querySelector("code");
    let language =
      [...codeElement.classList]
        .find((cls) => cls.startsWith("language-"))
        ?.replace("language-", "") || "Text";

    const languageLabel = document.createElement("div");
    languageLabel.innerText =
      language.charAt(0).toUpperCase() + language.slice(1);
    languageLabel.classList.add("code__language-label");
    block.appendChild(languageLabel);

    const copyButton = document.createElement("button");
    copyButton.innerHTML = `<i class='bx bx-copy'></i>`;
    copyButton.classList.add("code__copy-btn");
    block.appendChild(copyButton);

    copyButton.addEventListener("click", () => {
      navigator.clipboard
        .writeText(codeElement.innerText)
        .then(() => {
          copyButton.innerHTML = `<i class='bx bx-check'></i>`;
          setTimeout(
            () => (copyButton.innerHTML = `<i class='bx bx-copy'></i>`),
            2000
          );
        })
        .catch((err) => {
          console.error("Copy failed:", err);
          alert("Unable to copy text!");
        });
    });
  });
};

// Show loading animation during API request - مع دعم توليد الصور
const displayLoadingAnimation = () => {
  // تحديد نوع الطلب
  const isImageRequest = isImageGenerationRequest(currentUserMessage);
  const shouldSearch = !isImageRequest && needsInternetSearch(currentUserMessage);
  
  // HTML للرسالة مع مؤشر التحميل المناسب
  let loadingHtml;
  
  if (isImageRequest) {
    loadingHtml = `
      <div class="message__content">
        <p class="message__text"></p>
        <div class="message__loading-indicator">
          <div class="message__image-indicator">
            <div class="message__image-text">جار توليد الصورة</div>
          </div>
        </div>
      </div>
      <span onClick="copyMessageToClipboard(this)" class="message__icon hide">
        <i class='bx bx-copy-alt'></i>
      </span>
    `;
  } else if (shouldSearch) {
    loadingHtml = `
      <div class="message__content">
        <p class="message__text"></p>
        <div class="message__loading-indicator">
          <div class="message__search-indicator">جار البحث</div>
        </div>
      </div>
      <span onClick="copyMessageToClipboard(this)" class="message__icon hide">
        <i class='bx bx-copy-alt'></i>
      </span>
    `;
  } else {
    loadingHtml = `
      <div class="message__content">
        <p class="message__text"></p>
        <div class="message__loading-indicator">
          <div class="message__loading-bar"></div>
        </div>
      </div>
      <span onClick="copyMessageToClipboard(this)" class="message__icon hide">
        <i class='bx bx-copy-alt'></i>
      </span>
    `;
  }

  const loadingMessageElement = createChatMessageElement(
    loadingHtml,
    "message--incoming",
    "message--loading"
  );
  chatHistoryContainer.appendChild(loadingMessageElement);

  // Scroll to bottom when loading animation appears
  scrollToBottom();

  // اختيار الدالة المناسبة بناءً على نوع الطلب
  if (isImageRequest) {
    handleImageGeneration(loadingMessageElement);
  } else {
    requestApiResponse(loadingMessageElement);
  }
};

// Copy message to clipboard
const copyMessageToClipboard = (copyButton) => {
  const messageContent =
    copyButton.parentElement.querySelector(".message__text").innerText;

  navigator.clipboard.writeText(messageContent);
  copyButton.innerHTML = `<i class='bx bx-check'></i>`; // Confirmation icon
  setTimeout(
    () => (copyButton.innerHTML = `<i class='bx bx-copy-alt'></i>`),
    1000
  ); // Revert icon after 1 second
};

// Handle sending chat messages
const handleOutgoingMessage = () => {
  const originalUserMessage = messageForm.querySelector(".prompt__form-input").value.trim() || currentUserMessage;
  if (!originalUserMessage || isGeneratingResponse) return; // Exit if no message or already generating response

  // إنشاء نسخة من الرسالة للمعالجة - إضافة "ابحث" إذا كان في وضع البحث
  currentUserMessage = isSearchMode ? "ابحث " + originalUserMessage : originalUserMessage;

  isGeneratingResponse = true;

  const outgoingMessageHtml = `
        <div class="message__content">
    <p class="message__text"></p>
</div>
    `;

  const outgoingMessageElement = createChatMessageElement(
    outgoingMessageHtml,
    "message--outgoing"
  );
  
  const userTextElement = outgoingMessageElement.querySelector(".message__text");
  // عرض النص الأصلي بدون "ابحث" للمستخدم
  userTextElement.innerText = originalUserMessage;
  
  // تطبيق الاتجاه على رسالة المستخدم
  applyTextDirection(userTextElement, originalUserMessage);
  
  chatHistoryContainer.appendChild(outgoingMessageElement);

  messageForm.reset(); // Clear input field
  
  // إعادة ضبط textarea إلى الحجم الطبيعي بعد الإرسال
  resetTextareaHeight();
  
  document.body.classList.add("hide-header");
  
  // Auto scroll to bottom after sending message
  scrollToBottom();
  
  setTimeout(displayLoadingAnimation, 500); // Show loading animation after delay
};

// Handle image button click - تفعيل حاوية الخيارات
imageButton.addEventListener("click", (e) => {
  e.preventDefault();
  searchOptionsContainer.classList.remove("hide");
});

// Handle notification close button
closeNotificationButton.addEventListener("click", () => {
  imageServiceNotification.classList.add("hide");
});

// معالجات أزرار الخيارات
cameraBtn.addEventListener("click", () => {
  searchOptionsContainer.classList.add("hide");
  // يمكن إضافة وظيفة الكاميرا لاحقاً
  imageServiceNotification.classList.remove("hide");
});

galleryBtn.addEventListener("click", () => {
  searchOptionsContainer.classList.add("hide");
  // يمكن إضافة وظيفة المعرض لاحقاً
  imageServiceNotification.classList.remove("hide");
});

filesBtn.addEventListener("click", () => {
  searchOptionsContainer.classList.add("hide");
  // يمكن إضافة وظيفة الملفات لاحقاً
  imageServiceNotification.classList.remove("hide");
});

// معالج زر البحث في الإنترنت
internetSearchBtn.addEventListener("click", () => {
  searchOptionsContainer.classList.add("hide");
  searchIndicator.classList.remove("hide");
  inputWrapper.classList.add("search-active");
  isSearchMode = true;
  
  // التركيز على حقل الإدخال
  const inputField = document.getElementById("userInput");
  inputField.focus();
});

// معالج زر إغلاق مؤشر البحث - مع إعادة ضبط textarea
searchCloseBtn.addEventListener("click", () => {
  resetTextareaHeight();
});

// إغلاق حاوية الخيارات عند النقر خارجها
document.addEventListener("click", (e) => {
  if (!searchOptionsContainer.contains(e.target) && !imageButton.contains(e.target)) {
    searchOptionsContainer.classList.add("hide");
  }
});

// Toggle between light and dark themes
themeToggleButton.addEventListener("click", () => {
  const isLightTheme = document.body.classList.toggle("light_mode");
  localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");

  // Update icon based on theme
  const newIconClass = isLightTheme ? "bx bx-moon" : "bx bx-sun";
  themeToggleButton.querySelector("i").className = newIconClass;
});

// Clear all chat history
clearChatButton.addEventListener("click", () => {
  if (confirm("هل أنت متأكد أنك تريد حذف كل سجل الدردشة؟")) {
    localStorage.removeItem("saved-api-chats");
    conversationHistory = []; // إعادة تعيين conversationHistory

    // Reload chat history to reflect changes
    loadSavedChatHistory();

    currentUserMessage = null;
    isGeneratingResponse = false;
    
    // إعادة ضبط textarea بعد حذف السجل
    resetTextareaHeight();
  }
});

// Handle click on suggestion items
suggestionItems.forEach((suggestion) => {
  suggestion.addEventListener("click", () => {
    currentUserMessage = suggestion.querySelector(
      ".suggests__item-text"
    ).innerText;
    handleOutgoingMessage();
  });
});

// Prevent default from submission and handle outgoing message
messageForm.addEventListener("submit", (e) => {
  e.preventDefault();
  handleOutgoingMessage();
});

// تحديث event listener للـ textarea مع إضافة إعادة ضبط الارتفاع
if (textarea) {
  textarea.addEventListener('input', function () {
    // إعادة ضبط الارتفاع عشان الحساب يكون صحيح
    this.style.height = 'auto';

    // احسب الارتفاع الجديد
    const maxHeight = parseInt(getComputedStyle(this).lineHeight) * 10; // 10 أسطر
    const newHeight = this.scrollHeight;

    if (newHeight <= maxHeight) {
      this.style.height = newHeight + 'px';
      this.style.overflowY = 'hidden';
    } else {
      this.style.height = maxHeight + 'px';
      this.style.overflowY = 'auto';
    }
  });
}

// Load saved chat history on page load
loadSavedChatHistory();

