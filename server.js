const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const config = require("./config.js");

const app = express();

// Middleware
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// زيادة حد الـ body parsing
app.use(express.json({ 
  limit: '10mb',
  strict: true,
  type: 'application/json'
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// معالج أخطاء JSON parsing
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    console.error("❌ JSON parsing error:", error.message);
    return res.status(400).json({
      error: "Invalid JSON format",
      details: "The request body contains malformed JSON",
      timestamp: new Date().toISOString()
    });
  }
  next();
});

// تسجيل الطلبات للتشخيص
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log("Request body:", JSON.stringify(req.body, null, 2));
  }
  next();
});

// التأكد من أن جميع الاستجابات هي JSON صحيح
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    try {
      // التحقق من أن البيانات قابلة للتحويل إلى JSON
      JSON.stringify(data);
      res.setHeader('Content-Type', 'application/json');
      return originalJson.call(this, data);
    } catch (error) {
      console.error("❌ JSON serialization error:", error);
      res.setHeader('Content-Type', 'application/json');
      return originalJson.call(this, {
        error: "Internal server error",
        details: "Failed to serialize response",
        timestamp: new Date().toISOString()
      });
    }
  };
  next();
});

// Health check endpoint - مع معلومات إضافية للتشخيص
app.get("/api/health", (req, res) => {
  const healthData = { 
    status: "Server is running successfully", 
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 3001,
    environment: process.env.NODE_ENV || 'development',
    apiKeysConfigured: {
      gemini: !!config.GEMINI_API_KEY,
      serper: !!config.SERPER_API_KEY
    }
  };
  
  console.log("✅ Health check requested:", healthData);
  res.json(healthData);
});

// Chat endpoint to handle AI requests - مع معالجة محسنة للأخطاء
app.post("/api/chat", async (req, res) => {
  console.log("📨 Chat endpoint called");
  
  try {
    const { message, conversationHistory = [], needsSearch = false } = req.body;

    // التحقق من صحة البيانات المرسلة
    if (!message || typeof message !== 'string' || message.trim() === "") {
      console.log("❌ Invalid message received:", message);
      return res.status(400).json({ 
        error: "Message is required and must be a non-empty string",
        timestamp: new Date().toISOString()
      });
    }

    // التحقق من API key
    if (!config.GEMINI_API_KEY || config.GEMINI_API_KEY.trim() === "") {
      console.error("❌ Gemini API key is not configured");
      return res.status(500).json({ 
        error: "Gemini API key is not configured properly",
        timestamp: new Date().toISOString()
      });
    }

    console.log("✅ Request validation passed");

    let finalMessage = message;
    let searchResults = "";

    // Handle internet search if needed
    if (needsSearch && config.SERPER_API_KEY) {
      try {
        console.log("🔍 Performing search for:", message);
        
        const searchController = new AbortController();
        const searchTimeoutId = setTimeout(() => searchController.abort(), 10000);
        
        const searchResponse = await fetch(config.SERPER_API_URL, {
          method: "POST",
          headers: {
            "X-API-KEY": config.SERPER_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            q: message,
            gl: "ye",
            num: 3
          }),
          signal: searchController.signal
        });

        clearTimeout(searchTimeoutId);

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const results = searchData.organic?.slice(0, 3) || [];
          
          if (results.length > 0) {
            searchResults = "نتائج البحث الحديثة:\n\n";
            results.forEach((result, index) => {
              searchResults += `${index + 1}. العنوان: ${result.title}\n`;
              searchResults += `   الوصف: ${result.snippet}\n`;
              searchResults += `   المصدر: ${result.link}\n\n`;
            });

            finalMessage = `
السؤال:
${message}

${searchResults}

بناءً على هذه النتائج، أعطِ إجابة واضحة ومفيدة للمستخدم بدون عرض JSON أو روابط خام. استخدم المعلومات من نتائج البحث لتقديم إجابة دقيقة ومحدثة.
`;
            
            console.log("✅ Search completed successfully");
          } else {
            console.log("⚠️ No search results found");
          }
        } else {
          const errorText = await searchResponse.text();
          console.log("⚠️ Search request failed:", response.status, errorText);
        }
      } catch (searchError) {
        if (searchError.name === 'AbortError') {
          console.log("⚠️ Search request timed out");
        } else {
          console.error("⚠️ Search error:", searchError);
        }
      }
    }

    // System instructions
    const systemInstructions = `
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

    // Prepare conversation for API
    const apiContents = [
      { role: "user", parts: [{ text: systemInstructions }] },
      ...conversationHistory,
      { role: "user", parts: [{ text: finalMessage }] }
    ];

    // Make request to Gemini API
    const apiUrl = `${config.API_BASE_URL}/models/${config.MODEL_NAME}:generateContent?key=${config.GEMINI_API_KEY}`;
    
    console.log("🤖 Sending request to Gemini API...");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log("⏰ Request timeout - aborting");
      controller.abort();
    }, 45000); // 45 seconds timeout

    const aiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: apiContents,
        generationConfig: {
          temperature: config.TEMPERATURE,
          maxOutputTokens: config.MAX_TOKENS
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("❌ Gemini API error:", aiResponse.status, errorText);
      
      let errorMessage = "خطأ في الذكاء الاصطناعي";
      if (aiResponse.status === 400) {
        errorMessage = "طلب غير صحيح للذكاء الاصطناعي";
      } else if (aiResponse.status === 401) {
        errorMessage = "مفتاح API غير صحيح";
      } else if (aiResponse.status === 403) {
        errorMessage = "الوصول مرفوض - تحقق من مفتاح API";
      } else if (aiResponse.status === 429) {
        errorMessage = "تم تجاوز حد الاستخدام - حاول مرة أخرى لاحقاً";
      } else if (aiResponse.status >= 500) {
        errorMessage = "خطأ في خادم الذكاء الاصطناعي";
      }
      
      return res.status(500).json({ 
        error: errorMessage,
        details: `Gemini API ${aiResponse.status}: ${errorText}`,
        timestamp: new Date().toISOString()
      });
    }

    let responseData;
    try {
      responseData = await aiResponse.json();
    } catch (parseError) {
      console.error("❌ Failed to parse Gemini API response:", parseError);
      return res.status(500).json({
        error: "فشل في تحليل استجابة الذكاء الاصطناعي",
        details: "Invalid JSON response from Gemini API",
        timestamp: new Date().toISOString()
      });
    }

    console.log("✅ Received response from Gemini API");
    
    const responseText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText || responseText.trim() === "") {
      console.error("❌ Invalid API response structure:", responseData);
      return res.status(500).json({ 
        error: "استجابة فارغة من الذكاء الاصطناعي",
        details: "Gemini API returned empty or invalid response",
        timestamp: new Date().toISOString()
      });
    }

    // إرجاع الاستجابة بتنسيق JSON صحيح
    const successResponse = { 
      reply: responseText,
      fullResponse: responseData,
      timestamp: new Date().toISOString()
    };

    console.log("✅ Sending successful response to client");
    res.json(successResponse);

  } catch (error) {
    console.error("❌ Chat API unexpected error:", error);
    
    // التأكد من أن الخطأ يتم إرجاعه بتنسيق JSON صحيح
    if (!res.headersSent) {
      const errorResponse = { 
        error: "حدث خطأ غير متوقع",
        details: error.message || "Unknown error occurred",
        type: error.name || "UnknownError",
        timestamp: new Date().toISOString()
      };
      
      if (error.name === 'AbortError') {
        errorResponse.error = "انتهت مهلة الطلب";
        errorResponse.details = "Request timed out after 45 seconds";
      }
      
      res.status(500).json(errorResponse);
    }
  }
});

// Endpoint for generating English descriptions for images - مع معالجة محسنة
app.post("/api/image-description", async (req, res) => {
  console.log("🎨 Image description endpoint called");
  
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === "") {
      console.log("❌ Invalid prompt received:", prompt);
      return res.status(400).json({ 
        error: "Prompt is required and must be a non-empty string",
        timestamp: new Date().toISOString()
      });
    }

    if (!config.GEMINI_API_KEY || config.GEMINI_API_KEY.trim() === "") {
      console.error("❌ Gemini API key not configured for image description");
      return res.status(500).json({ 
        error: "Gemini API key is not configured properly",
        timestamp: new Date().toISOString()
      });
    }

    console.log("✅ Image description request validation passed");

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

    const apiUrl = `${config.API_BASE_URL}/models/${config.MODEL_NAME}:generateContent?key=${config.GEMINI_API_KEY}`;
    
    console.log("🤖 Requesting image description from Gemini...");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log("⏰ Image description request timeout");
      controller.abort();
    }, 25000);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: systemInstructions }] },
          { role: "user", parts: [{ text: prompt }] }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Gemini API error for image description:", response.status, errorText);
      
      return res.status(500).json({
        error: "فشل في إنشاء وصف الصورة",
        details: `Gemini API error: ${response.status}`,
        timestamp: new Date().toISOString()
      });
    }

    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      console.error("❌ Failed to parse image description response:", parseError);
      return res.status(500).json({
        error: "فشل في تحليل استجابة وصف الصورة",
        details: "Invalid JSON response from Gemini API",
        timestamp: new Date().toISOString()
      });
    }

    const description = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!description || description.trim() === "") {
      console.error("❌ Invalid image description response:", responseData);
      return res.status(500).json({
        error: "فشل في الحصول على وصف من الذكاء الاصطناعي",
        details: "Empty or invalid description from Gemini",
        timestamp: new Date().toISOString()
      });
    }

    console.log("✅ Generated image description successfully:", description.substring(0, 100) + "...");

    res.json({ 
      description: description.trim(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Image description API unexpected error:", error);
    
    if (!res.headersSent) {
      const errorResponse = {
        error: "خطأ غير متوقع في توليد وصف الصورة",
        details: error.message || "Unknown error occurred",
        type: error.name || "UnknownError",
        timestamp: new Date().toISOString()
      };
      
      if (error.name === 'AbortError') {
        errorResponse.error = "انتهت مهلة طلب وصف الصورة";
        errorResponse.details = "Image description request timed out";
      }
      
      res.status(500).json(errorResponse);
    }
  }
});

// معالج عام للأخطاء غير المتوقعة
app.use((error, req, res, next) => {
  console.error("❌ Unhandled server error:", error);
  
  if (!res.headersSent) {
    res.status(500).json({
      error: "خطأ داخلي في الخادم",
      details: error.message || "Internal server error occurred",
      type: error.name || "ServerError",
      timestamp: new Date().toISOString()
    });
  }
});

// معالج المسارات غير الموجودة لـ API
app.use('/api/*', (req, res) => {
  console.log(`❌ API route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: "API endpoint not found",
    path: req.path,
    method: req.method,
    availableEndpoints: ["/api/health", "/api/chat", "/api/image-description"],
    timestamp: new Date().toISOString()
  });
});

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Serve the React app for all other routes (fallback)
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  console.log(`📁 Serving index.html from: ${indexPath}`);
  
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error("❌ Error serving index.html:", err);
      res.status(404).json({
        error: "Frontend files not found",
        details: "The dist directory or index.html file is missing. Build the frontend first.",
        timestamp: new Date().toISOString()
      });
    }
  });
});

// معالج إغلاق graceful
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// معالج الأخطاء غير المعالجة
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Server running successfully on port ${PORT}`);
  console.log(`📱 Frontend available at: http://localhost:${PORT}`);
  console.log(`🔧 API endpoints available at: http://localhost:${PORT}/api/`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 Gemini API Key configured: ${config.GEMINI_API_KEY ? 'Yes ✅' : 'No ❌'}`);
  console.log(`🔍 Serper API Key configured: ${config.SERPER_API_KEY ? 'Yes ✅' : 'No ❌'}`);
  console.log('════════════════════════════════════════════');
  console.log('✅ Server is ready to handle requests');
  console.log('════════════════════════════════════════════');
});
