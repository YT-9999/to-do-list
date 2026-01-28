let apiKey = localStorage.getItem('siliconflow_api_key') || '';
let todos = JSON.parse(localStorage.getItem('todos')) || [];
let breakdownTasks = JSON.parse(localStorage.getItem('breakdownTasks')) || [];
let moodRecords = JSON.parse(localStorage.getItem('moodRecords')) || [];
let chatHistories = JSON.parse(localStorage.getItem('chatHistories')) || [];
let selectedRating = 0;
let chatHistory = [];
let currentMood = '';
let currentView = 'today';

const apiProviders = {
    siliconflow: {
        name: '硅基流动',
        endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
        model: 'Pro/deepseek-ai/DeepSeek-V3.2'
    },
    deepseek: {
        name: 'DeepSeek官方',
        endpoint: 'https://api.deepseek.com/v1/chat/completions',
        model: 'deepseek-chat'
    },
    openai: {
        name: 'OpenAI',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-3.5-turbo'
    },
    custom: {
        name: '自定义',
        endpoint: '',
        model: ''
    }
};

let apiConfig = JSON.parse(localStorage.getItem('apiConfig')) || {
    provider: 'siliconflow',
    endpoint: apiProviders.siliconflow.endpoint,
    model: apiProviders.siliconflow.model,
    apiKey: ''
};

const encouragements = [
    '太棒了！你完成了一个任务！',
    '做得好！继续保持！',
    '你真棒！每一步都在进步！',
    '优秀！离目标又近了一步！',
    '加油！你做得很好！',
    '太厉害了！继续保持这个势头！',
    '完美！你完成了这个任务！',
    '很棒！你值得表扬！',
    '好样的！你正在变得更好！',
    '优秀！为你感到骄傲！',
    '千里之行，始于足下。',
    '不积跬步，无以至千里。',
    '坚持就是胜利！',
    '每天进步一点点！',
    '你比想象中更强大！'
];

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initTaskBreakdown();
    initTaskList();
    initApiKeyModal();
    initMoodRecord();
    initChatModal();
    initSidebar();
    initHistoryModals();
    initManageDataModal();
    loadTodos();
    loadBreakdownTasks();
    loadMoodRecords();
    updateDateTime();
    setInterval(updateDateTime, 1000);
});

function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });
}

function initApiKeyModal() {
    const modal = document.getElementById('api-key-modal');
    const saveBtn = document.getElementById('save-api-key');
    const closeBtn = document.getElementById('close-api-modal');
    const input = document.getElementById('api-key-input');
    const settingsBtn = document.getElementById('settings-btn');
    const providerSelect = document.getElementById('api-provider');
    const endpointInput = document.getElementById('api-endpoint');
    const modelInput = document.getElementById('api-model');

    if (!apiConfig.apiKey) {
        modal.classList.add('show');
    }

    settingsBtn.addEventListener('click', () => {
        providerSelect.value = apiConfig.provider;
        endpointInput.value = apiConfig.endpoint;
        modelInput.value = apiConfig.model;
        input.value = apiConfig.apiKey;
        modal.classList.add('show');
    });

    providerSelect.addEventListener('change', () => {
        const provider = providerSelect.value;
        if (provider !== 'custom') {
            endpointInput.value = apiProviders[provider].endpoint;
            modelInput.value = apiProviders[provider].model;
        }
    });

    saveBtn.addEventListener('click', () => {
        const key = input.value.trim();
        const provider = providerSelect.value;
        const endpoint = endpointInput.value.trim();
        const model = modelInput.value.trim();

        if (!key) {
            alert('请输入API密钥');
            return;
        }

        if (!endpoint) {
            alert('请输入API端点');
            return;
        }

        if (!model) {
            alert('请输入模型名称');
            return;
        }

        apiConfig = {
            provider: provider,
            endpoint: endpoint,
            model: model,
            apiKey: key
        };

        localStorage.setItem('apiConfig', JSON.stringify(apiConfig));
        localStorage.setItem('siliconflow_api_key', key);
        
        modal.classList.remove('show');
        input.value = '';
    });

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');
    });
}

function initTaskBreakdown() {
    const btn = document.getElementById('breakdown-btn');
    const input = document.getElementById('task-input');
    const result = document.getElementById('breakdown-result');
    let isLoading = false;

    btn.addEventListener('click', async () => {
        const task = input.value.trim();
        if (!task) {
            showError(result, '请输入任务内容');
            return;
        }

        if (!apiConfig.apiKey) {
            document.getElementById('api-key-modal').classList.add('show');
            return;
        }

        if (isLoading) return; // 防止重复点击
        isLoading = true;
        
        // 保存原始按钮文本
        const originalText = btn.textContent;
        btn.textContent = '拆分中...';
        btn.disabled = true;

        showLoading(result);

        try {
            const steps = await breakdownTask(task);
            breakdownTasks = {
                task: task,
                steps: steps,
                completed: steps.map(() => false)
            };
            saveBreakdownTasks();
            renderBreakdownTasks();
        } catch (error) {
            showError(result, '任务拆分失败：' + error.message);
        } finally {
            // 恢复按钮状态
            isLoading = false;
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });
}

async function breakdownTask(task) {
    // 检查缓存
    const cacheKey = generateCacheKey('breakdown', task);
    const cachedResult = getCache(cacheKey);
    if (cachedResult) {
        console.log('使用缓存的任务拆分结果');
        return cachedResult;
    }

    // 优化后的prompt，保持效果的同时提高执行效率
    const prompt = `# 任务拆分要求\n\n任务：${task}\n\n## 核心要求\n1. 拆分成5-15个极其简单的最小物理动作步骤\n2. 步骤要细到"掀开被子"、"坐起来"这种具体程度\n3. 从最简单的动作开始，保持逻辑顺序\n4. 每个步骤不超过15字，具体明确\n\n## 输出格式\n请只返回JSON数组，每个步骤包含：\n- step: 序号（从1开始）\n- content: 步骤内容\n\n示例输出：\n[{"step": 1, "content": "走到书桌前"}, {"step": 2, "content": "坐下"}]`;

    const response = await callAI(prompt, '你是专业的任务拆分助手，擅长将复杂任务拆分成简单易执行的具体物理动作步骤。');

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const errorMessage = error.error?.message || `API请求失败`;
        throw new Error(errorMessage);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    try {
        const steps = JSON.parse(content);
        // 缓存结果
        setCache(cacheKey, steps);
        return steps;
    } catch (e) {
        throw new Error('无法解析返回的步骤');
    }
}

async function callAI(prompt, systemMessage, retries = 0) {
    if (!apiConfig.apiKey) {
        throw new Error('请先配置API密钥');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90秒超时，根据用户要求提高超时时间

    try {
        const response = await fetch(apiConfig.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiConfig.apiKey}`
            },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [
                    {
                        role: 'system',
                        content: systemMessage
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000 // 减少token数提高响应速度
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            const errorMessage = error.error?.message || `API请求失败 (${response.status})`;
            
            // 重试机制
            if (retries < 2) {
                console.log(`请求失败，正在重试 (${retries + 1}/3)...`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒后重试
                return callAI(prompt, systemMessage, retries + 1);
            }
            
            throw new Error(errorMessage);
        }

        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            throw new Error('请求超时，请稍后重试');
        }
        
        // 网络错误重试
        if (retries < 2 && (error.message.includes('网络') || error.message.includes('Network'))) {
            console.log(`网络错误，正在重试 (${retries + 1}/3)...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return callAI(prompt, systemMessage, retries + 1);
        }
        
        throw error;
    }
}

function renderBreakdownTasks() {
    const result = document.getElementById('breakdown-result');
    
    if (!breakdownTasks.steps || breakdownTasks.steps.length === 0) {
        result.innerHTML = '<div class="empty-state">还没有拆分的任务，请输入任务开始拆分</div>';
        return;
    }

    let html = '<div class="steps-container">';
    breakdownTasks.steps.forEach((step, index) => {
        const isCompleted = breakdownTasks.completed[index];
        html += `
            <div class="step-item ${isCompleted ? 'completed' : ''}" data-index="${index}">
                <div class="step-number">${step.step}</div>
                <div class="step-content">${step.content}</div>
                <input type="checkbox" class="step-checkbox" ${isCompleted ? 'checked' : ''}>
            </div>
        `;
    });
    html += '</div>';
    
    html += '<button id="reset-breakdown" style="margin-top: 20px;">重新开始</button>';
    
    result.innerHTML = html;

    document.querySelectorAll('.step-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const index = parseInt(e.target.closest('.step-item').dataset.index);
            breakdownTasks.completed[index] = e.target.checked;
            saveBreakdownTasks();
            renderBreakdownTasks();
        });
    });

    document.getElementById('reset-breakdown')?.addEventListener('click', () => {
        breakdownTasks = {
            task: '',
            steps: [],
            completed: []
        };
        saveBreakdownTasks();
        renderBreakdownTasks();
        document.getElementById('task-input').value = '';
    });
}

function saveBreakdownTasks() {
    localStorage.setItem('breakdownTasks', JSON.stringify(breakdownTasks));
}

function loadBreakdownTasks() {
    breakdownTasks = JSON.parse(localStorage.getItem('breakdownTasks')) || {
        task: '',
        steps: [],
        completed: []
    };
    renderBreakdownTasks();
}

function initTaskList() {
    const btn = document.getElementById('add-todo-btn');
    const input = document.getElementById('todo-input');
    const startTimeInput = document.getElementById('todo-start-time');
    const endTimeInput = document.getElementById('todo-end-time');
    const stars = document.querySelectorAll('.star');

    btn.addEventListener('click', addTodo);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTodo();
        }
    });

    stars.forEach(star => {
        star.addEventListener('click', () => {
            const rating = parseInt(star.dataset.rating);
            selectedRating = rating;
            updateStarRating(rating);
        });
    });
}

function updateStarRating(rating) {
    const stars = document.querySelectorAll('.star');
    stars.forEach(star => {
        const starRating = parseInt(star.dataset.rating);
        if (starRating <= rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

function addTodo() {
    const input = document.getElementById('todo-input');
    const text = input.value.trim();
    const startTime = document.getElementById('todo-start-time').value;
    const endTime = document.getElementById('todo-end-time').value;

    if (!text) return;

    const todo = {
        id: Date.now(),
        text: text,
        completed: false,
        date: new Date().toISOString().split('T')[0],
        startTime: startTime || '',
        endTime: endTime || '',
        priority: selectedRating
    };

    todos.push(todo);
    saveTodos();
    renderTodos();
    
    input.value = '';
    document.getElementById('todo-start-time').value = '';
    document.getElementById('todo-end-time').value = '';
    updateStarRating(0);
    selectedRating = 0;
}

function toggleTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (todo) {
        todo.completed = !todo.completed;
        saveTodos();
        renderTodos();

        if (todo.completed) {
            showEncouragement(id);
        }
    }
}

function deleteTodo(id) {
    todos = todos.filter(t => t.id !== id);
    saveTodos();
    renderTodos();
}

function breakdownTodo(todoId) {
    const todo = todos.find(t => t.id === todoId);
    if (!todo) return;

    document.getElementById('task-input').value = todo.text;
    
    const taskBreakdownTab = document.querySelector('[data-tab="task-breakdown"]');
    taskBreakdownTab.click();
    
    const breakdownBtn = document.getElementById('breakdown-btn');
    breakdownBtn.click();
}

function showEncouragement(id) {
    const encouragement = encouragements[Math.floor(Math.random() * encouragements.length)];
    const modal = document.getElementById('encouragement-modal');
    const textElement = document.getElementById('encouragement-text');
    
    textElement.textContent = encouragement;
    modal.classList.add('show');

    const closeBtn = document.getElementById('close-encouragement-modal');
    closeBtn.onclick = () => {
        modal.classList.remove('show');
    };

    setTimeout(() => {
        modal.classList.remove('show');
    }, 5000);
}

function renderTodos() {
    const list = document.getElementById('todo-list');
    const today = new Date().toISOString().split('T')[0];
    let todayTodos = todos.filter(t => t.date === today);

    if (todayTodos.length === 0) {
        list.innerHTML = '<div class="empty-state">今天还没有添加任务，开始添加吧！</div>';
        return;
    }

    todayTodos.sort((a, b) => {
        if (a.startTime && b.startTime) {
            if (a.startTime !== b.startTime) {
                return a.startTime.localeCompare(b.startTime);
            }
        }
        return b.priority - a.priority;
    });

    let html = '';
    todayTodos.forEach(todo => {
        const stars = '★'.repeat(todo.priority);
        const timeInfo = (todo.startTime || todo.endTime) ? 
            `<span class="task-time">${todo.startTime}${todo.endTime ? ' - ' + todo.endTime : ''}</span>` : '';
        
        html += `
            <div class="todo-item ${todo.completed ? 'completed' : ''}" data-todo-id="${todo.id}">
                <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
                <div class="todo-content">
                    <div class="todo-text">${todo.text}</div>
                    <div class="todo-meta">
                        ${timeInfo}
                        <span class="task-stars">${stars}</span>
                    </div>
                </div>
                <div class="todo-actions">
                    <button class="todo-breakdown-btn" data-todo-id="${todo.id}">拆分</button>
                    <button class="todo-delete">删除</button>
                </div>
            </div>
        `;
    });

    list.innerHTML = html;

    document.querySelectorAll('.todo-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const id = parseInt(e.target.closest('.todo-item').dataset.todoId);
            toggleTodo(id);
        });
    });

    document.querySelectorAll('.todo-breakdown-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.dataset.todoId);
            breakdownTodo(id);
        });
    });

    document.querySelectorAll('.todo-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.closest('.todo-item').dataset.todoId);
            deleteTodo(id);
        });
    });
}

function saveTodos() {
    localStorage.setItem('todos', JSON.stringify(todos));
}

function loadTodos() {
    todos = JSON.parse(localStorage.getItem('todos')) || [];
    renderTodos();
}

function showLoading(container) {
    container.innerHTML = '<div class="loading">正在拆分任务，请稍候...</div>';
}

function showError(container, message) {
    container.innerHTML = `<div class="error">${message}</div>`;
}

function initMoodRecord() {
    const saveMoodBtn = document.getElementById('save-mood-btn');
    const saveDiaryBtn = document.getElementById('save-diary-btn');
    const moodDate = document.getElementById('mood-date');
    let isMoodLoading = false;

    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    moodDate.textContent = today.toLocaleDateString('zh-CN', options);

    saveMoodBtn.addEventListener('click', async () => {
        const moodInput = document.getElementById('mood-input');
        const moodText = moodInput.value.trim();
        
        if (!moodText) {
            alert('请输入情绪记录');
            return;
        }

        if (isMoodLoading) return; // 防止重复点击
        isMoodLoading = true;
        
        // 保存原始按钮文本
        const originalText = saveMoodBtn.textContent;
        saveMoodBtn.textContent = '分析中...';
        saveMoodBtn.disabled = true;

        try {
            const isNegative = await checkMoodSentiment(moodText);
            
            const today = new Date().toISOString().split('T')[0];
            const existingRecord = moodRecords.find(r => r.date === today);
            
            if (existingRecord) {
                existingRecord.mood = moodText;
                existingRecord.isNegative = isNegative;
            } else {
                moodRecords.push({
                    date: today,
                    mood: moodText,
                    diary: '',
                    isNegative: isNegative
                });
            }
            
            saveMoodRecords();
            renderMoodHistory();
            moodInput.value = '';

            if (isNegative) {
                currentMood = moodText;
                document.getElementById('chat-modal').classList.add('show');
            } else {
                const today = new Date().toISOString().split('T')[0];
                if (chatHistory.length > 0) {
                    saveChatHistory(today, chatHistory);
                    chatHistory = [];
                }
            }
        } catch (error) {
            console.error('情绪分析失败:', error);
            alert('情绪分析失败，请稍后重试');
        } finally {
            // 恢复按钮状态
            isMoodLoading = false;
            saveMoodBtn.textContent = originalText;
            saveMoodBtn.disabled = false;
        }
    });

    saveDiaryBtn.addEventListener('click', () => {
        const diaryInput = document.getElementById('diary-input');
        const diaryText = diaryInput.value.trim();
        
        if (!diaryText) {
            alert('请输入随笔内容');
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const existingRecord = moodRecords.find(r => r.date === today);
        
        if (existingRecord) {
            existingRecord.diary = diaryText;
        } else {
            moodRecords.push({
                date: today,
                mood: '',
                diary: diaryText,
                isNegative: false
            });
        }
        
        saveMoodRecords();
        renderMoodHistory();
        diaryInput.value = '';

        if (chatHistory.length > 0) {
            saveChatHistory(today, chatHistory);
            chatHistory = [];
        }
    });
}

async function checkMoodSentiment(moodText) {
    if (!apiConfig.apiKey) {
        return false;
    }

    // 检查缓存
    const cacheKey = generateCacheKey('mood', moodText);
    const cachedResult = getCache(cacheKey);
    if (cachedResult !== null) {
        console.log('使用缓存的情绪分析结果');
        return cachedResult;
    }

    try {
        const prompt = `请分析以下情绪描述，判断是否为负面、消极或平淡的情绪。判断标准要严格一些，只要稍微不算是好的情绪都算负面情绪。

情绪描述：${moodText}

请只返回"true"或"false"：
- true：表示是负面、消极或平淡的情绪
- false：表示是积极、快乐或良好的情绪

只返回true或false，不要其他任何内容。`;

        const response = await callAI(prompt, '你是一个情绪分析专家，擅长判断情绪的正负面。');

        if (!response.ok) {
            console.error('情绪判断失败');
            return false;
        }

        const data = await response.json();
        const result = data.choices[0].message.content.trim().toLowerCase();
        const isNegative = result === 'true';
        
        // 缓存结果
        setCache(cacheKey, isNegative);
        return isNegative;
    } catch (error) {
        console.error('情绪判断出错:', error);
        return false;
    }
}

function initChatModal() {
    const chatModal = document.getElementById('chat-modal');
    const needChatBtn = document.getElementById('need-chat-btn');
    const noNeedChatBtn = document.getElementById('no-need-chat-btn');
    const psychologistModal = document.getElementById('psychologist-modal');
    const closePsychologistBtn = document.getElementById('close-psychologist');
    const sendChatBtn = document.getElementById('send-chat-btn');
    const chatInput = document.getElementById('chat-input');

    needChatBtn.addEventListener('click', () => {
        chatModal.classList.remove('show');
        psychologistModal.classList.add('show');
        chatHistory = [];
        startPsychologistChat();
    });

    noNeedChatBtn.addEventListener('click', () => {
        chatModal.classList.remove('show');
    });

    closePsychologistBtn.addEventListener('click', () => {
        psychologistModal.classList.remove('show');
        if (chatHistory.length > 0) {
            const today = new Date().toISOString().split('T')[0];
            saveChatHistory(today, chatHistory);
        }
        chatHistory = [];
    });

    sendChatBtn.addEventListener('click', async () => {
        const userMessage = chatInput.value.trim();
        if (!userMessage) return;

        // 防止重复点击
        if (sendChatBtn.disabled) return;
        sendChatBtn.disabled = true;
        const originalText = sendChatBtn.textContent;
        sendChatBtn.textContent = '思考中...';

        addChatMessage('user', userMessage);
        chatHistory.push({ role: 'user', content: userMessage });
        chatInput.value = '';

        try {
            const aiResponse = await getPsychologistResponse(chatHistory);
            addChatMessage('ai', aiResponse);
            chatHistory.push({ role: 'assistant', content: aiResponse });
        } catch (error) {
            console.error('AI回复失败:', error);
            addChatMessage('ai', '抱歉，我的回复遇到了问题，请稍后再试。');
            chatHistory.push({ role: 'assistant', content: '抱歉，我的回复遇到了问题，请稍后再试。' });
        } finally {
            // 恢复按钮状态
            sendChatBtn.textContent = originalText;
            sendChatBtn.disabled = false;
        }
    });

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatBtn.click();
        }
    });
}

async function startPsychologistChat() {
    const initialMessage = `你好，我是你的心理咨询师。我注意到你今天的心情似乎不太好，能和我聊聊发生了什么吗？我会一步一步地引导你找出心情不好的原因，并帮助你解决问题。`;
    
    addChatMessage('ai', initialMessage);
    chatHistory.push({ role: 'assistant', content: initialMessage });
}

async function getPsychologistResponse(history) {
    if (!apiConfig.apiKey) {
        return '抱歉，需要API密钥才能进行对话。请先设置API密钥。';
    }

    try {
        const systemPrompt = `你是一位资深的心理医生和安慰者，擅长通过提问引导用户找出心情不好的原因，并帮助用户解决问题。

你的工作流程：
1. 主动提问，引导用户分享更多细节
2. 仔细倾听用户的回答，关注细节
3. 根据用户的回答，提出更深入的问题，刨析要尽可能细致入微
4. 在彻底找出心情不好的原因后，引导用户去解决这个问题
5. 对用户进行安慰和鼓励，给予积极的心理支持

你的风格：
- 温暖、耐心、专业
- 善于倾听和共情
- 提问要有层次感，从表面到深入
- 避免说教，多用引导和启发
- 语言要亲切自然，像朋友一样

请始终保持积极、支持的态度，帮助用户走出负面情绪。`;

        const response = await fetch(apiConfig.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiConfig.apiKey}`
            },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    ...history
                ],
                temperature: 0.8,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('AI对话错误:', error);
            return '抱歉，我现在无法回复。请稍后再试。';
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('AI对话出错:', error);
        return '抱歉，发生了错误。请稍后再试。';
    }
}

function addChatMessage(type, message) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    messageDiv.textContent = message;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function saveMoodRecords() {
    localStorage.setItem('moodRecords', JSON.stringify(moodRecords));
}

function loadMoodRecords() {
    moodRecords = JSON.parse(localStorage.getItem('moodRecords')) || [];
    renderMoodHistory();
}

function renderMoodHistory() {
    const historyContainer = document.getElementById('mood-history');
    
    if (moodRecords.length === 0) {
        historyContainer.innerHTML = '<div class="empty-state">还没有情绪记录，开始记录吧！</div>';
        return;
    }

    const sortedRecords = [...moodRecords].sort((a, b) => new Date(b.date) - new Date(a.date));

    let html = '';
    sortedRecords.forEach(record => {
        const date = new Date(record.date);
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        const formattedDate = date.toLocaleDateString('zh-CN', options);
        
        html += `
            <div class="mood-history-item ${record.isNegative ? 'negative' : ''}">
                <div class="mood-history-header">
                    <span class="mood-history-date">${formattedDate}</span>
                </div>
                ${record.mood ? `<div class="mood-history-mood">${record.mood}</div>` : ''}
                ${record.diary ? `<div class="mood-history-diary">${record.diary}</div>` : ''}
            </div>
        `;
    });

    historyContainer.innerHTML = html;
}

function updateDateTime() {
    const now = new Date();
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Shanghai' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' };
    
    const dateStr = now.toLocaleDateString('zh-CN', dateOptions);
    const timeStr = now.toLocaleTimeString('zh-CN', timeOptions);
    
    const dateDisplay = document.getElementById('current-date');
    const timeDisplay = document.getElementById('current-time');
    
    if (dateDisplay) dateDisplay.textContent = dateStr;
    if (timeDisplay) timeDisplay.textContent = timeStr;
}

function initSidebar() {
    const navBtns = document.querySelectorAll('.sidebar-nav-btn');
    
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentView = view;
            
            if (view === 'today') {
                const taskListTab = document.querySelector('[data-tab="task-list"]');
                if (taskListTab) taskListTab.click();
            } else if (view === 'history-tasks') {
                openHistoryTasksModal();
            } else if (view === 'history-moods') {
                openHistoryMoodsModal();
            }
        });
    });
}

function initHistoryModals() {
    const historyTasksModal = document.getElementById('history-tasks-modal');
    const historyMoodsModal = document.getElementById('history-moods-modal');
    const closeHistoryTasks = document.getElementById('close-history-tasks');
    const closeHistoryMoods = document.getElementById('close-history-moods');
    const selectAllTasksBtn = document.getElementById('select-all-tasks');
    const deleteSelectedTasksBtn = document.getElementById('delete-selected-tasks');
    const selectAllMoodsBtn = document.getElementById('select-all-moods');
    const deleteSelectedMoodsBtn = document.getElementById('delete-selected-moods');
    
    closeHistoryTasks.addEventListener('click', () => {
        historyTasksModal.classList.remove('show');
        resetSidebarNav();
    });
    
    closeHistoryMoods.addEventListener('click', () => {
        historyMoodsModal.classList.remove('show');
        resetSidebarNav();
    });
    
    if (selectAllTasksBtn) {
        selectAllTasksBtn.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('#history-tasks-content input[type="checkbox"]');
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            checkboxes.forEach(cb => cb.checked = !allChecked);
        });
    }
    
    if (deleteSelectedTasksBtn) {
        deleteSelectedTasksBtn.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('#history-tasks-content input[type="checkbox"]:checked');
            if (checkboxes.length === 0) {
                alert('请先选择要删除的任务');
                return;
            }
            
            if (confirm(`确定要删除选中的${checkboxes.length}个任务吗？此操作不可恢复。`)) {
                const selectedDates = Array.from(checkboxes).map(cb => cb.dataset.date);
                todos = todos.filter(todo => !selectedDates.includes(todo.date));
                saveTodos();
                renderTodos();
                alert(`已删除${checkboxes.length}个任务`);
                
                showTasksByDate(selectedDates[0]);
            }
        });
    }
    
    if (selectAllMoodsBtn) {
        selectAllMoodsBtn.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('#history-moods-content input[type="checkbox"]');
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            checkboxes.forEach(cb => cb.checked = !allChecked);
        });
    }
    
    if (deleteSelectedMoodsBtn) {
        deleteSelectedMoodsBtn.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('#history-moods-content input[type="checkbox"]:checked');
            if (checkboxes.length === 0) {
                alert('请先选择要删除的记录');
                return;
            }
            
            if (confirm(`确定要删除选中的${checkboxes.length}条记录吗？此操作不可恢复。`)) {
                const selectedDates = Array.from(checkboxes).map(cb => cb.dataset.date);
                moodRecords = moodRecords.filter(record => !selectedDates.includes(record.date));
                chatHistories = chatHistories.filter(chat => !selectedDates.includes(chat.date));
                saveMoodRecords();
                localStorage.setItem('chatHistories', JSON.stringify(chatHistories));
                renderMoodHistory();
                alert(`已删除${checkboxes.length}条记录`);
                
                showMoodsByDate(selectedDates[0]);
            }
        });
    }
}

function resetSidebarNav() {
    const navBtns = document.querySelectorAll('.sidebar-nav-btn');
    navBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === 'today') {
            btn.classList.add('active');
        }
    });
    currentView = 'today';
}

function openHistoryTasksModal() {
    const modal = document.getElementById('history-tasks-modal');
    const datesContainer = document.getElementById('history-tasks-dates');
    const contentContainer = document.getElementById('history-tasks-content');
    
    const uniqueDates = [...new Set(todos.map(todo => todo.date))].sort((a, b) => new Date(b) - new Date(a));
    
    if (uniqueDates.length === 0) {
        datesContainer.innerHTML = '<div class="history-empty">暂无历史任务</div>';
        contentContainer.innerHTML = '';
        modal.classList.add('show');
        return;
    }
    
    let datesHtml = '';
    uniqueDates.forEach(date => {
        const dateObj = new Date(date);
        const options = { month: 'short', day: 'numeric', weekday: 'short' };
        const formattedDate = dateObj.toLocaleDateString('zh-CN', options);
        datesHtml += `<div class="history-date-item" data-date="${date}">${formattedDate}</div>`;
    });
    
    datesContainer.innerHTML = datesHtml;
    contentContainer.innerHTML = '<div class="history-empty">请选择日期查看任务</div>';
    
    datesContainer.querySelectorAll('.history-date-item').forEach(item => {
        item.addEventListener('click', () => {
            const date = item.dataset.date;
            showTasksByDate(date);
            
            datesContainer.querySelectorAll('.history-date-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });
    
    modal.classList.add('show');
}

function showTasksByDate(date) {
    const contentContainer = document.getElementById('history-tasks-content');
    const dateTasks = todos.filter(todo => todo.date === date);
    
    const dateObj = new Date(date);
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    const formattedDate = dateObj.toLocaleDateString('zh-CN', options);
    
    if (dateTasks.length === 0) {
        contentContainer.innerHTML = '<div class="history-empty">该日期没有任务</div>';
        return;
    }
    
    const completedCount = dateTasks.filter(t => t.completed).length;
    const totalCount = dateTasks.length;
    
    let html = `<div class="history-date-title">${formattedDate}（完成：${completedCount}/${totalCount}）</div>`;
    
    dateTasks.sort((a, b) => {
        if (a.startTime && b.startTime) {
            if (a.startTime !== b.startTime) {
                return a.startTime.localeCompare(b.startTime);
            }
        }
        return b.priority - a.priority;
    });
    
    dateTasks.forEach(todo => {
        const stars = '★'.repeat(todo.priority);
        const timeInfo = (todo.startTime || todo.endTime) ? 
            `<span class="task-time">${todo.startTime}${todo.endTime ? ' - ' + todo.endTime : ''}</span>` : '';
        
        html += `
            <div class="todo-item ${todo.completed ? 'completed' : ''}">
                <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''} data-date="${todo.date}">
                <div class="todo-content">
                    <div class="todo-text">${todo.text}</div>
                    <div class="todo-meta">
                        ${timeInfo}
                        <span class="task-stars">${stars}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    contentContainer.innerHTML = html;
}

function openHistoryMoodsModal() {
    const modal = document.getElementById('history-moods-modal');
    const datesContainer = document.getElementById('history-moods-dates');
    const contentContainer = document.getElementById('history-moods-content');
    
    const uniqueDates = [...new Set(moodRecords.map(record => record.date))].sort((a, b) => new Date(b) - new Date(a));
    
    if (uniqueDates.length === 0) {
        datesContainer.innerHTML = '<div class="history-empty">暂无历史情绪记录</div>';
        contentContainer.innerHTML = '';
        modal.classList.add('show');
        return;
    }
    
    let datesHtml = '';
    uniqueDates.forEach(date => {
        const dateObj = new Date(date);
        const options = { month: 'short', day: 'numeric', weekday: 'short' };
        const formattedDate = dateObj.toLocaleDateString('zh-CN', options);
        datesHtml += `<div class="history-date-item" data-date="${date}">${formattedDate}</div>`;
    });
    
    datesContainer.innerHTML = datesHtml;
    contentContainer.innerHTML = '<div class="history-empty">请选择日期查看情绪记录</div>';
    
    datesContainer.querySelectorAll('.history-date-item').forEach(item => {
        item.addEventListener('click', () => {
            const date = item.dataset.date;
            showMoodsByDate(date);
            
            datesContainer.querySelectorAll('.history-date-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });
    
    modal.classList.add('show');
}

function showMoodsByDate(date) {
    const contentContainer = document.getElementById('history-moods-content');
    const record = moodRecords.find(r => r.date === date);
    
    const dateObj = new Date(date);
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    const formattedDate = dateObj.toLocaleDateString('zh-CN', options);
    
    if (!record) {
        contentContainer.innerHTML = '<div class="history-empty">该日期没有情绪记录</div>';
        return;
    }
    
    let html = `<div class="history-date-title">${formattedDate}</div>`;
    
    if (record.mood && record.mood.trim()) {
        html += `
            <div class="mood-history-item ${record.isNegative ? 'negative' : ''}">
                <input type="checkbox" class="mood-checkbox" data-date="${date}">
                <div class="mood-history-content">
                    <div class="mood-history-mood">${record.mood}</div>
                </div>
            </div>
        `;
    }
    
    if (record.diary && record.diary.trim()) {
        html += `
            <div class="mood-history-item">
                <input type="checkbox" class="mood-checkbox" data-date="${date}">
                <div class="mood-history-diary">${record.diary}</div>
            </div>
        `;
    }
    
    const chatHistory = chatHistories.find(ch => ch.date === date);
    if (chatHistory && chatHistory.messages && chatHistory.messages.length > 0) {
        html += `
            <div class="chat-history-item">
                <div class="chat-history-header">
                    <span class="chat-history-date">AI对话记录</span>
                    <button class="view-chat-btn" data-date="${date}">查看对话</button>
                </div>
            </div>
        `;
    }
    
    contentContainer.innerHTML = html;
    
    contentContainer.querySelectorAll('.view-chat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const date = btn.dataset.date;
            showChatHistory(date);
        });
    });
}

function showChatHistory(date) {
    const chatHistory = chatHistories.find(ch => ch.date === date);
    
    if (!chatHistory || !chatHistory.messages) {
        alert('该日期没有对话记录');
        return;
    }
    
    const psychologistModal = document.getElementById('psychologist-modal');
    const chatMessages = document.getElementById('chat-messages');
    
    chatMessages.innerHTML = '';
    
    chatHistory.messages.forEach(msg => {
        addChatMessage(msg.role === 'assistant' ? 'ai' : 'user', msg.content);
    });
    
    psychologistModal.classList.add('show');
}

function initManageDataModal() {
    const modal = document.getElementById('manage-data-modal');
    const closeBtn = document.getElementById('close-manage-data');
    const manageDataBtn = document.getElementById('manage-data-btn');
    const manageTabs = document.querySelectorAll('.manage-tab');
    const manageContents = document.querySelectorAll('.manage-content');
    const selectAllBtn = document.getElementById('manage-select-all');
    const deleteSelectedBtn = document.getElementById('manage-delete-selected');
    let currentManageTab = 'tasks';
    
    manageDataBtn.addEventListener('click', () => {
        modal.classList.add('show');
        renderManageContent('tasks');
    });
    
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');
    });
    
    manageTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            manageTabs.forEach(t => t.classList.remove('active'));
            manageContents.forEach(c => c.style.display = 'none');
            tab.classList.add('active');
            currentManageTab = tab.dataset.manageTab;
            renderManageContent(currentManageTab);
        });
    });
    
    selectAllBtn.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.manage-item-checkbox:checked');
        const allChecked = Array.from(document.querySelectorAll('.manage-item-checkbox')).every(cb => cb.checked);
        document.querySelectorAll('.manage-item-checkbox').forEach(cb => cb.checked = !allChecked);
    });
    
    deleteSelectedBtn.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.manage-item-checkbox:checked');
        if (checkboxes.length === 0) {
            alert('请先选择要删除的记录');
            return;
        }
        
        if (confirm(`确定要删除选中的${checkboxes.length}条记录吗？此操作不可恢复。`)) {
            if (currentManageTab === 'tasks') {
                const selectedDates = Array.from(checkboxes).map(cb => cb.dataset.date);
                todos = todos.filter(todo => !selectedDates.includes(todo.date));
                saveTodos();
                renderTodos();
                alert(`已删除${checkboxes.length}个任务`);
                renderManageContent('tasks');
            } else if (currentManageTab === 'moods') {
                const selectedDates = Array.from(checkboxes).map(cb => cb.dataset.date);
                moodRecords = moodRecords.filter(record => !selectedDates.includes(record.date));
                saveMoodRecords();
                renderMoodHistory();
                alert(`已删除${checkboxes.length}条记录`);
                renderManageContent('moods');
            } else if (currentManageTab === 'chats') {
                const selectedDates = Array.from(checkboxes).map(cb => cb.dataset.date);
                chatHistories = chatHistories.filter(chat => !selectedDates.includes(chat.date));
                localStorage.setItem('chatHistories', JSON.stringify(chatHistories));
                alert(`已删除${checkboxes.length}条对话记录`);
                renderManageContent('chats');
            }
        }
    });
}

function renderManageContent(tab) {
    const tasksContent = document.getElementById('manage-tasks-content');
    const moodsContent = document.getElementById('manage-moods-content');
    const chatsContent = document.getElementById('manage-chats-content');
    
    tasksContent.style.display = 'none';
    moodsContent.style.display = 'none';
    chatsContent.style.display = 'none';
    
    if (tab === 'tasks') {
        renderManageTasks();
        tasksContent.style.display = 'block';
    } else if (tab === 'moods') {
        renderManageMoods();
        moodsContent.style.display = 'block';
    } else if (tab === 'chats') {
        renderManageChats();
        chatsContent.style.display = 'block';
    }
}

function renderManageTasks() {
    const content = document.getElementById('manage-tasks-content');
    const uniqueDates = [...new Set(todos.map(todo => todo.date))].sort((a, b) => new Date(b) - new Date(a));
    
    if (uniqueDates.length === 0) {
        content.innerHTML = '<div class="history-empty">暂无历史任务</div>';
        return;
    }
    
    let html = '';
    uniqueDates.forEach(date => {
        const dateObj = new Date(date);
        const options = { month: 'short', day: 'numeric', weekday: 'short' };
        const formattedDate = dateObj.toLocaleDateString('zh-CN', options);
        const dateTasks = todos.filter(todo => todo.date === date);
        const completedCount = dateTasks.filter(t => t.completed).length;
        const totalCount = dateTasks.length;
        
        html += `
            <div class="manage-item">
                <input type="checkbox" class="manage-item-checkbox" data-date="${date}">
                <div class="manage-item-content">
                    <div class="manage-item-date">${formattedDate}</div>
                    <div class="manage-item-count">完成：${completedCount}/${totalCount}</div>
                </div>
            </div>
        `;
    });
    
    content.innerHTML = html;
}

function renderManageMoods() {
    const content = document.getElementById('manage-moods-content');
    const uniqueDates = [...new Set(moodRecords.map(record => record.date))].sort((a, b) => new Date(b) - new Date(a));
    
    if (uniqueDates.length === 0) {
        content.innerHTML = '<div class="history-empty">暂无历史情绪记录</div>';
        return;
    }
    
    let html = '';
    uniqueDates.forEach(date => {
        const dateObj = new Date(date);
        const options = { month: 'short', day: 'numeric', weekday: 'short' };
        const formattedDate = dateObj.toLocaleDateString('zh-CN', options);
        const record = moodRecords.find(r => r.date === date);
        
        html += `
            <div class="manage-item">
                <input type="checkbox" class="manage-item-checkbox" data-date="${date}">
                <div class="manage-item-content">
                    <div class="manage-item-date">${formattedDate}</div>
                    <div class="manage-item-count">${record.mood ? '有情绪' : '无情绪'}</div>
                </div>
            </div>
        `;
    });
    
    content.innerHTML = html;
}

function renderManageChats() {
    const content = document.getElementById('manage-chats-content');
    const uniqueDates = [...new Set(chatHistories.map(chat => chat.date))].sort((a, b) => new Date(b) - new Date(a));
    
    if (uniqueDates.length === 0) {
        content.innerHTML = '<div class="history-empty">暂无AI对话记录</div>';
        return;
    }
    
    let html = '';
    uniqueDates.forEach(date => {
        const dateObj = new Date(date);
        const options = { month: 'short', day: 'numeric', weekday: 'short' };
        const formattedDate = dateObj.toLocaleDateString('zh-CN', options);
        const chat = chatHistories.find(ch => ch.date === date);
        const messageCount = chat ? chat.messages.length : 0;
        
        html += `
            <div class="manage-item">
                <input type="checkbox" class="manage-item-checkbox" data-date="${date}">
                <div class="manage-item-content">
                    <div class="manage-item-date">${formattedDate}</div>
                    <div class="manage-item-count">${messageCount}条消息</div>
                </div>
            </div>
        `;
    });
    
    content.innerHTML = html;
}

// 缓存管理函数
function getCache(key) {
    const cache = JSON.parse(localStorage.getItem('ai_cache')) || {};
    const item = cache[key];
    
    // 检查缓存是否过期（24小时）
    if (item && (Date.now() - item.timestamp) < 24 * 60 * 60 * 1000) {
        return item.data;
    }
    
    // 缓存过期，删除
    if (item) {
        delete cache[key];
        localStorage.setItem('ai_cache', JSON.stringify(cache));
    }
    
    return null;
}

function setCache(key, data) {
    const cache = JSON.parse(localStorage.getItem('ai_cache')) || {};
    cache[key] = {
        data: data,
        timestamp: Date.now()
    };
    localStorage.setItem('ai_cache', JSON.stringify(cache));
}

function clearCache() {
    localStorage.removeItem('ai_cache');
}

// 生成缓存键
function generateCacheKey(prefix, content) {
    // 使用内容的哈希作为缓存键的一部分
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `${prefix}_${hash}`;
}

function saveChatHistory(date, messages) {
    const existingIndex = chatHistories.findIndex(ch => ch.date === date);
    
    if (existingIndex !== -1) {
        chatHistories[existingIndex].messages = messages;
    } else {
        chatHistories.push({
            date: date,
            messages: messages
        });
    }
    
    localStorage.setItem('chatHistories', JSON.stringify(chatHistories));
}
