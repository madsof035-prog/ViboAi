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

// Initialize highlight.js with common languages
hljs.configure({
    languages: ['javascript', 'python', 'bash', 'typescript', 'json', 'html', 'css']
});

// Initialize highlight.js
hljs.highlightAll();

// API endpoint للخادم المحلي - مع معالجة أفضل للأخطاء
const API_BASE_URL = '/api';

// دالة للتحقق من حالة الخادم
const checkServerHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Server health check failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("✅ Server is healthy:", data);
    return true;
  } catch (error) {
    console.error("❌ Server health check failed:", error);
    return false;
  }
};

// دالة محسنة لمعالجة استجابات الخادم
const handleServerResponse = async (response) => {
  const contentType = response.headers.get('content-type');
  
  try {
    // التحقق من أن الاستجابة هي JSON
    if (!contentType || !contentType.includes('application/json')) {
      const textResponse = await response.text();
      console.error("Server returned non-JSON response:", textResponse);
      throw new Error(`الخادم أرجع استجابة غير صحيحة. النوع: ${contentType || 'unknown'}`);
    }
    
    // محاولة تحليل JSON
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `خطأ في الخادم: ${response.status}`);
    }
    
    return data;
  } catch (parseError) {
    if (parseError.name === 'SyntaxError') {
      // خطأ في تحليل JSON
      const textFallback = await response.text().catch(() => 'لا يمكن قراءة الاستجابة');
      console.error("JSON parsing failed. Response text:", textFallback);
      throw new Error("الخادم أرجع استجابة تالفة. تحقق من الاتصال بالخادم");
    }
    throw parseError;
  }
};

// دالة لإعادة ضبط textarea إلى الحجم الطبيعي
const resetTextareaHeight = () => {
  if (textarea) {
    textarea.style.height = 'auto';
    textarea.style.overflowY = 'hidden';
    textarea.style.height = '3rem';
    
    if (inputWrapper) {
      inputWrapper.classList.remove("search-active");
    }
    
    if (searchIndicator) {
      searchIndicator.classList.add("hide");
    }
    
    isSearchMode = false;
  }
};

// دالة لاكتشاف الكلمات المفتاحية لتوليد الصور
const isImageGenerationRequest = (message) => {
  const lowerMessage = message.toLowerCase();
  
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

// دالة توليد الصور باستخدام Pollinations API - مع معالجة أفضل للأخطاء
const generateImage = async (prompt) => {
  try {
    console.log("🎨 Generating image description for:", prompt);
    
    // الحصول على وصف إنجليزي من الخادم
    const response = await fetch(`${API_BASE_URL}/image-description`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    const data = await handleServerResponse(response);
    const enhancedPrompt = data.description;
    
    console.log("✅ Image description generated:", enhancedPrompt);
    
    // استخدام Pollinations API لتوليد الصور
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&seed=${Math.floor(Math.random() * 1000000)}`;
    
    // التحقق من أن الصورة تم تحميلها بنجاح
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        console.log("✅ Image loaded successfully");
        resolve(imageUrl);
      };
      img.onerror = () => {
        console.error("❌ Image failed to load");
        reject(new Error('فشل في تحميل الصورة من Pollinations'));
      };
      img.src = imageUrl;
      
      // مهلة زمنية للتحميل
      setTimeout(() => {
        reject(new Error('انتهت مهلة تحميل الصورة'));
      }, 30000);
    });
  } catch (error) {
    console.error("❌ Image generation error:", error);
    throw new Error(`فشل في توليد الصورة: ${error.message}`);
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
fullscreenClose?.addEventListener('click', () => {
  imageFullscreenOverlay.classList.add('hide');
});

fullscreenDownload?.addEventListener('click', () => {
  const imageUrl = fullscreenImage.src;
  if (imageUrl) {
    downloadImage(imageUrl);
  }
});

// إغلاق النافذة عند النقر خارج الصورة
imageFullscreenOverlay?.addEventListener('click', (e) => {
  if (e.target === imageFullscreenOverlay) {
    imageFullscreenOverlay.classList.add('hide');
  }
});

// دالة لتحديد ما إذا كانت الرسالة تحتاج للبحث في الإنترنت - محدودة جداً
const needsInternetSearch = (message) => {
  if (isSearchMode) {
    return true;
  }

  const lowerMessage = message.toLowerCase();
  
  const limitedSearchKeywords = [
    'ابحث', 'بحث',
    'كم سعر', 'كم التاريخ', 'كم تاريخ',
    'ما سعر', 'ما التاريخ', 'ما تاريخ'
  ];
  
  return limitedSearchKeywords.some(keyword => {
    return lowerMessage.startsWith(keyword) || 
           lowerMessage.includes(' ' + keyword + ' ') || 
           lowerMessage.includes(' ' + keyword);
  });
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
      const responseText = conversation.apiResponse?.reply || 
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

// Fetch API response from our server - مع معالجة محسنة للأخطاء
const requestApiResponse = async (incomingMessageElement) => {
  const messageTextElement = incomingMessageElement.querySelector(".message__text");

  try {
    // التحقق من حالة الخادم أولاً
    const serverHealthy = await checkServerHealth();
    if (!serverHealthy) {
      throw new Error("الخادم غير متاح حالياً. تحقق من أن الخادم يعمل بشكل صحيح");
    }

    // تحديد ما إذا كانت الرسالة تحتاج للبحث
    const shouldSearch = needsInternetSearch(currentUserMessage);
    
    console.log(shouldSearch ? "🔍 البحث مطلوب للرسالة:" : "💬 محادثة عادية، لا حاجة للبحث:", currentUserMessage);
    
    console.log("📤 Sending request to server...");
    
    // إرسال الطلب إلى الخادم المحلي بدلاً من Gemini مباشرة
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: currentUserMessage,
        conversationHistory: conversationHistory,
        needsSearch: shouldSearch
      }),
    });

    const responseData = await handleServerResponse(response);
    const responseText = responseData.reply;

    if (!responseText) {
      throw new Error("استجابة فارغة من الخادم");
    }

    console.log("✅ Received valid response from server");

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
    let savedConversations = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
    savedConversations.push({
      userMessage: currentUserMessage,
      apiResponse: responseData,
    });
    localStorage.setItem("saved-api-chats", JSON.stringify(savedConversations));

  } catch (error) {
    console.error("❌ Request API response error:", error);
    isGeneratingResponse = false;
    
    let errorMessage = "حدث خطأ أثناء معالجة الطلب";
    
    if (error.message.includes("fetch")) {
      errorMessage = "فشل في الاتصال بالخادم. تحقق من أن الخادم يعمل على المنفذ الصحيح";
    } else if (error.message.includes("JSON")) {
      errorMessage = "خطأ في تحليل استجابة الخادم. تحقق من إعدادات الخادم";
    } else {
      errorMessage = error.message;
    }
    
    messageTextElement.innerText = errorMessage;
    messageTextElement.closest(".message").classList.add("message--error");
    
    // Scroll to bottom even on error
    scrollToBottom();
  } finally {
    incomingMessageElement.classList.remove("message--loading");
  }
};

// دالة معالجة طلب توليد الصورة - مع معالجة أفضل للأخطاء
const handleImageGeneration = async (incomingMessageElement) => {
  const messageTextElement = incomingMessageElement.querySelector(".message__text");

  try {
    console.log("🎨 توليد صورة للنص:", currentUserMessage);
    
    // توليد الصورة (الذي يستخدم الخادم للحصول على الوصف الإنجليزي)
    const imageUrl = await generateImage(currentUserMessage);
    
    // عرض الصورة المولدة
    displayGeneratedImage(imageUrl, messageTextElement, incomingMessageElement);
    
    // حفظ المحادثة في التخزين المحلي مع بيانات الصورة
    let savedConversations = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
    savedConversations.push({
      userMessage: currentUserMessage,
      apiResponse: {
        reply: `تم توليد صورة بناءً على طلبك: "${currentUserMessage}"`
      },
      isImage: true,
      imageUrl: imageUrl
    });
    localStorage.setItem("saved-api-chats", JSON.stringify(savedConversations));
    
  } catch (error) {
    console.error("❌ Image generation error:", error);
    isGeneratingResponse = false;
    messageTextElement.innerText = `خطأ في توليد الصورة: ${error.message}`;
    messageTextElement.closest(".message").classList.add("message--error");
    scrollToBottom();
  } finally {
    incomingMessageElement.classList.remove("message--loading");
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
imageButton?.addEventListener("click", (e) => {
  e.preventDefault();
  searchOptionsContainer?.classList.remove("hide");
});

// Handle notification close button
closeNotificationButton?.addEventListener("click", () => {
  imageServiceNotification?.classList.add("hide");
});

// معالجات أزرار الخيارات
cameraBtn?.addEventListener("click", () => {
  searchOptionsContainer?.classList.add("hide");
  // يمكن إضافة وظيفة الكاميرا لاحقاً
  imageServiceNotification?.classList.remove("hide");
});

galleryBtn?.addEventListener("click", () => {
  searchOptionsContainer?.classList.add("hide");
  // يمكن إضافة وظيفة المعرض لاحقاً
  imageServiceNotification?.classList.remove("hide");
});

filesBtn?.addEventListener("click", () => {
  searchOptionsContainer?.classList.add("hide");
  // يمكن إضافة وظيفة الملفات لاحقاً
  imageServiceNotification?.classList.remove("hide");
});

// معالج زر البحث في الإنترنت
internetSearchBtn?.addEventListener("click", () => {
  searchOptionsContainer?.classList.add("hide");
  searchIndicator?.classList.remove("hide");
  inputWrapper?.classList.add("search-active");
  isSearchMode = true;
  
  // التركيز على حقل الإدخال
  const inputField = document.getElementById("userInput");
  inputField?.focus();
});

// معالج زر إغلاق مؤشر البحث - مع إعادة ضبط textarea
searchCloseBtn?.addEventListener("click", () => {
  resetTextareaHeight();
});

// إغلاق حاوية الخيارات عند النقر خارجها
document.addEventListener("click", (e) => {
  if (searchOptionsContainer && imageButton) {
    if (!searchOptionsContainer.contains(e.target) && !imageButton.contains(e.target)) {
      searchOptionsContainer.classList.add("hide");
    }
  }
});

// Toggle between light and dark themes
themeToggleButton?.addEventListener("click", () => {
  const isLightTheme = document.body.classList.toggle("light_mode");
  localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");

  // Update icon based on theme
  const newIconClass = isLightTheme ? "bx bx-moon" : "bx bx-sun";
  const iconElement = themeToggleButton.querySelector("i");
  if (iconElement) {
    iconElement.className = newIconClass;
  }
});

// Clear all chat history
clearChatButton?.addEventListener("click", () => {
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
messageForm?.addEventListener("submit", (e) => {
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

// التحقق من حالة الخادم عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async () => {
  console.log("🔄 Page loaded, checking server status...");
  await checkServerHealth();
});

// Load saved chat history on page load
loadSavedChatHistory();
