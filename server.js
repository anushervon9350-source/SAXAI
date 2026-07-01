// ============================================================
// SAX AI - СЕРВЕР ДЛЯ RENDER (без multer)
// ============================================================

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// ============================================================
// API РОУТЫ
// ============================================================

// --- Чат ---
app.post('/api/chat', async (req, res) => {
    try {
        const { message, model } = req.body;

        console.log(`📩 Сообщение: "${message}"`);

        // Проверка на создателя
        if (isAskingAboutCreator(message)) {
            return res.json({
                success: true,
                reply: 'Меня создала компания SAX. 🚀',
                creator: true
            });
        }

        // Отправка в выбранную модель
        const targetModel = model || 'chatgpt4o';
        let reply = '';

        switch (targetModel) {
            case 'chatgpt4o':
            case 'gpt52':
                reply = await askOpenAI(message);
                break;
            case 'gemini':
                reply = await askGemini(message);
                break;
            case 'grok':
                reply = await askGrok(message);
                break;
            default:
                reply = '🤖 Модель временно недоступна.';
        }

        res.json({ success: true, reply, model: targetModel });

    } catch (error) {
        console.error('❌ Ошибка:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Внутренняя ошибка'
        });
    }
});

// --- Статус ---
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        name: 'SAX AI',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function isAskingAboutCreator(text) {
    if (!text) return false;
    const lower = text.toLowerCase().trim();
    if (lower.length < 2) return false;

    const triggers = [
        'создатель', 'создал', 'кто тебя создал', 'кто создал', 'твой создатель',
        'creator', 'who created you', 'who made you', 'your creator',
        'créateur', 'qui t\'a créé', 'chi ti ha creato', 'creador',
        'schöpfer', 'wer hat dich erschaffen', 'criador', 'quem te criou',
        'مبدع', 'من خلقك', 'יוצר', 'מי ברא אותך', 'творец',
        'разработчик', 'developer', 'author', 'отец', 'папа'
    ];

    return triggers.some(trigger => lower.includes(trigger.toLowerCase()));
}

// --- OpenAI ---
async function askOpenAI(prompt) {
    const OpenAI = require('openai');
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500
    });

    return response.choices[0].message.content || 'Пустой ответ от OpenAI';
}

// --- Gemini ---
async function askGemini(prompt) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro' });

    const result = await model.generateContent({
        contents: [{ parts: [{ text: prompt }] }]
    });

    return result.response.text() || 'Пустой ответ от Gemini';
}

// --- Grok ---
async function askGrok(prompt) {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROK_API_KEY}`
        },
        body: JSON.stringify({
            model: 'grok-4.3',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Пустой ответ от Grok';
}

// ============================================================
// ЗАПУСК СЕРВЕРА
// ============================================================

app.listen(PORT, () => {
    console.log('========================================');
    console.log(`🚀 SAX AI Server запущен!`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api/chat`);
    console.log(`========================================`);
});

module.exports = app;
