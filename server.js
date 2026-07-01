// ============================================================
// SAX AI - СЕРВЕР ДЛЯ VERCEL
// ============================================================

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// --- Статика ---
app.use(express.static('public'));

// --- Multer для файлов ---
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10485760 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 
                        'application/pdf', 'text/plain', 'text/markdown'];
        if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Неподдерживаемый тип файла'));
        }
    }
});

// ============================================================
// API РОУТЫ
// ============================================================

// --- Чат ---
app.post('/api/chat', upload.array('files', 5), async (req, res) => {
    try {
        const { message, model } = req.body;
        const files = req.files || [];

        console.log(`📩 Сообщение: "${message}"`);
        console.log(`📎 Файлов: ${files.length}`);

        // Проверка на создателя
        if (isAskingAboutCreator(message)) {
            return res.json({
                success: true,
                reply: 'Меня создала компания SAX. 🚀',
                creator: true
            });
        }

        // Отправка в API
        const targetModel = model || 'chatgpt4o';
        let reply = '';

        switch (targetModel) {
            case 'chatgpt4o':
            case 'gpt52':
                reply = await askOpenAI(message, files);
                break;
            case 'gemini':
                reply = await askGemini(message, files);
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
async function askOpenAI(prompt, files) {
    const OpenAI = require('openai');
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });

    let messages = [{ role: 'user', content: prompt }];

    const images = files.filter(f => f.mimetype.startsWith('image/'));
    if (images.length > 0) {
        const content = [
            { type: 'text', text: prompt || 'Опиши это изображение' }
        ];

        for (const img of images) {
            const base64 = img.buffer.toString('base64');
            content.push({
                type: 'image_url',
                image_url: { url: `data:${img.mimetype};base64,${base64}` }
            });
        }

        messages = [{ role: 'user', content: content }];
    }

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 500
    });

    return response.choices[0].message.content || 'Пустой ответ от OpenAI';
}

// --- Gemini ---
async function askGemini(prompt, files) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro' });

    const parts = [{ text: prompt || 'Опиши прикреплённые файлы' }];

    for (const file of files) {
        if (file.mimetype.startsWith('image/')) {
            parts.push({
                inline_data: {
                    mime_type: file.mimetype,
                    data: file.buffer.toString('base64')
                }
            });
        } else {
            const text = file.buffer.toString('utf-8');
            parts.push({ text: `\n[Файл: ${file.originalname}]\n${text}` });
        }
    }

    const result = await model.generateContent({
        contents: [{ parts: parts }]
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
// ЭКСПОРТ ДЛЯ VERCEL
// ============================================================

module.exports = app;
