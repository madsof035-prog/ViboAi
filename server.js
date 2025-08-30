const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config(); // لتحميل مفاتيح من .env

const app = express();
app.use(cors());
app.use(express.json());

// مسار الملفات الثابتة (HTML/JS/CSS/Assets)
app.use(express.static(path.join(__dirname, "public"))); // ضع index.html وscript.js وstyle.css في مجلد public

// API لجلب مفاتيح الـAPI
app.get("/api/config", (req, res) => {
  res.json({
    OPENAI_KEY: process.env.OPENAI_KEY
  });
});

// أي مسار غير موجود يرجع index.html (لتشغيل روابط المستخدمين المميزة)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
