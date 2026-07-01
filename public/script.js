// ============================================================
// SAX AI - ПОЛНАЯ ЛОГИКА (голос + файлы + история)
// ============================================================

const API_URL = '/api/chat';

const userInput = document.getElementById('userInput');
const responseBox = document.getElementById('responseBox');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const attachBtn = document.getElementById('attachBtn');
const modelChips = document.querySelectorAll('.chip[data-model]');

let currentModel = 'chatgpt4o';
let attachedFiles = [];

// ============================================================
// ЭФФЕКТ ПЕЧАТАНИЯ
// ============================================================

function typeText(element, text, speed = 15) {
    return new Promise((resolve) => {
        let index = 0;
        element.innerHTML = '';
        element.style.display = 'block';

        function type() {
            if (index < text.length) {
                let char = text.charAt(index);
                element.innerHTML += char === '\n' ? '<br>' : char;
                index++;
                setTimeout(type, speed);
            } else {
                resolve();
            }
        }
        type();
    });
}

// ============================================================
// СОХРАНЕНИЕ ИСТОРИИ
// ============================================================

function saveMessage(role, content) {
    const history = JSON.parse(localStorage.getItem('saxChatHistory') || '[]');
    history.push({ role, content, timestamp: new Date().toISOString() });
    if (history.length > 100) history.shift();
    localStorage.setItem('saxChatHistory', JSON.stringify(history));
}

function loadHistory() {
    const history = JSON.parse(localStorage.getItem('saxChatHistory') || '[]');
    if (history.length === 0) {
        responseBox.innerHTML = '📜 История пуста. Начни диалог!';
        responseBox.style.display = 'block';
        return;
    }
    const lastMessages = history.slice(-10);
    let html = '<strong>📜 Последние сообщения:</strong><br><br>';
    for (const msg of lastMessages) {
        const icon = msg.role === 'user' ? '👤' : '🤖';
        const time = new Date(msg.timestamp).toLocaleTimeString();
        html += `${icon} <strong>${msg.role === 'user' ? 'Вы' : 'SAX AI'}</strong> (${time}):<br>`;
        html += `${msg.content}<br><br>`;
    }
    responseBox.innerHTML = html;
    responseBox.style.display = 'block';
}

function clearHistory() {
    if (confirm('🗑️ Удалить всю историю чатов?')) {
        localStorage.removeItem('saxChatHistory');
        responseBox.innerHTML = '🗑️ История очищена!';
        responseBox.style.display = 'block';
    }
}

// ============================================================
// ОТПРАВКА СООБЩЕНИЯ
// ============================================================

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text && attachedFiles.length === 0) {
        responseBox.innerHTML = '⚠️ Напиши сообщение или прикрепи файл!';
        responseBox.style.display = 'block';
        return;
    }

    responseBox.innerHTML = '⏳ Думаю...';
    responseBox.style.display = 'block';

    try {
        const formData = new FormData();
        formData.append('message', text);
        formData.append('model', currentModel);
        for (const file of attachedFiles) {
            formData.append('files', file);
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            saveMessage('user', text);
            saveMessage('assistant', data.reply);
            await typeText(responseBox, data.reply, 15);
        } else {
            responseBox.innerHTML = `❌ Ошибка: ${data.error || 'Неизвестная ошибка'}`;
        }

    } catch (error) {
        responseBox.innerHTML = `
            ❌ Ошибка соединения с сервером.<br>
            <span style="font-size:13px; color:#5d6a85;">
            Проверь, что сервер запущен.
            </span>
        `;
    }

    userInput.value = '';
    attachedFiles = [];
    attachBtn.style.background = 'transparent';
    attachBtn.style.color = '#7b8599';
}

// ============================================================
// МОДЕЛИ
// ============================================================

modelChips.forEach(chip => {
    chip.addEventListener('click', function() {
        modelChips.forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        currentModel = this.dataset.model;
        responseBox.innerHTML = `🔄 Переключено на <strong>${this.textContent.trim()}</strong>`;
        responseBox.style.display = 'block';
    });
});

// ============================================================
// 🎤 ГОЛОС (РАБОТАЕТ)
// ============================================================

let isListening = false;
let recognition = null;

micBtn.addEventListener('click', function() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('❌ Браузер не поддерживает голосовой ввод.');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!recognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'ru-RU';
        recognition.continuous = false;

        recognition.onresult = function(event) {
            const final = event.results[0][0].transcript;
            userInput.value = final;
            setTimeout(() => sendMessage(), 300);
        };

        recognition.onend = function() {
            isListening = false;
            micBtn.style.background = 'transparent';
            micBtn.style.color = '#7b8599';
        };
    }

    if (isListening) {
        recognition.stop();
    } else {
        recognition.start();
        isListening = true;
        micBtn.style.background = 'rgba(108, 92, 231, 0.3)';
        micBtn.style.color = '#6c5ce7';
        responseBox.innerHTML = '🎤 Слушаю... Говорите!';
        responseBox.style.display = 'block';
    }
});

// ============================================================
// 📎 ФАЙЛЫ (РАБОТАЕТ)
// ============================================================

attachBtn.addEventListener('click', function() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = 'image/*,.pdf,.txt,.md,.doc,.docx';

    fileInput.addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        for (const file of files) {
            if (file.size > 10 * 1024 * 1024) {
                alert(`❌ Файл "${file.name}" слишком большой (макс. 10MB)`);
                return;
            }
        }

        attachedFiles = [...attachedFiles, ...files];
        const fileNames = files.map(f => f.name).join(', ');
        responseBox.innerHTML = `✅ Прикреплено: ${fileNames}`;
        responseBox.style.display = 'block';
        attachBtn.style.background = 'rgba(108, 92, 231, 0.3)';
        attachBtn.style.color = '#6c5ce7';

        setTimeout(() => {
            if (responseBox.innerHTML.includes('Прикреплено')) {
                responseBox.innerHTML = '';
                responseBox.style.display = 'none';
            }
        }, 3000);
    });

    fileInput.click();
});

// ============================================================
// ОБРАБОТЧИКИ
// ============================================================

sendBtn.addEventListener('click', sendMessage);

userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

document.getElementById('newChatBtn').addEventListener('click', () => {
    responseBox.innerHTML = '✨ Новая беседа начата! Задай вопрос.';
    responseBox.style.display = 'block';
    userInput.value = '';
    attachedFiles = [];
    attachBtn.style.background = 'transparent';
    attachBtn.style.color = '#7b8599';
});

document.getElementById('historyBtn').addEventListener('click', function() {
    const menu = confirm('📜 Показать историю? Нажми "ОК" для просмотра, "Отмена" для очистки.');
    if (menu) {
        loadHistory();
    } else {
        clearHistory();
    }
});

window.addEventListener('load', () => {
    responseBox.innerHTML = '👋 Привет! Я SAX AI. Чем могу помочь?';
    responseBox.style.display = 'block';
});
