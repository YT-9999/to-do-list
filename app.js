let apiKey = localStorage.getItem('siliconflow_api_key') || '';
let todos = JSON.parse(localStorage.getItem('todos')) || [];
let breakdownTasks = JSON.parse(localStorage.getItem('breakdownTasks')) || [];

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
    loadTodos();
    loadBreakdownTasks();
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

    if (!apiKey) {
        modal.classList.add('show');
    }

    saveBtn.addEventListener('click', () => {
        const key = input.value.trim();
        if (key) {
            apiKey = key;
            localStorage.setItem('siliconflow_api_key', key);
            modal.classList.remove('show');
            input.value = '';
        }
    });

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');
    });
}

function initTaskBreakdown() {
    const btn = document.getElementById('breakdown-btn');
    const input = document.getElementById('task-input');
    const result = document.getElementById('breakdown-result');

    btn.addEventListener('click', async () => {
        const task = input.value.trim();
        if (!task) {
            showError(result, '请输入任务内容');
            return;
        }

        if (!apiKey) {
            document.getElementById('api-key-modal').classList.add('show');
            return;
        }

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
        }
    });
}

async function breakdownTask(task) {
    const prompt = `请将以下任务拆分成多个极其简单、容易执行的最小步骤。每个步骤都要细到用户几乎不需要思考就能立即行动的程度。

任务：${task}

拆分要求：
1. 每个步骤必须是物理上可以立即执行的最小动作
2. 步骤要细到"掀开被子"、"坐起来"、"伸个懒腰"、"拿起手机"、"打开APP"这种程度
3. 避免抽象的描述，必须是具体的物理动作
4. 每个步骤都要极其简单，不需要任何心理准备就能完成
5. 步骤之间要有逻辑顺序，从最简单的开始
6. 步骤数量建议在5-15个之间

请以JSON数组格式返回，每个步骤是一个对象，包含：
- step: 步骤序号（从1开始）
- content: 步骤内容（简短明确，不超过15字，必须是具体的物理动作）

只返回JSON数组，不要其他内容。`;

    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'deepseek-ai/DeepSeek-V3',
            messages: [
                {
                    role: 'system',
                    content: '你是一个专业的任务拆分助手，擅长将复杂任务拆分成简单易执行的步骤。'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 2000
        })
    });

    if (!response.ok) {
        const error = await response.json();
        console.error('API错误详情:', error);
        console.error('状态码:', response.status);
        console.error('完整错误对象:', JSON.stringify(error, null, 2));
        throw new Error(error.error?.message || 'API请求失败');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    try {
        const steps = JSON.parse(content);
        return steps;
    } catch (e) {
        throw new Error('无法解析返回的步骤');
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

    btn.addEventListener('click', addTodo);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTodo();
        }
    });
}

function addTodo() {
    const input = document.getElementById('todo-input');
    const text = input.value.trim();

    if (!text) return;

    const todo = {
        id: Date.now(),
        text: text,
        completed: false,
        date: new Date().toISOString().split('T')[0]
    };

    todos.push(todo);
    saveTodos();
    renderTodos();
    input.value = '';
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
    const todayTodos = todos.filter(t => t.date === today);

    if (todayTodos.length === 0) {
        list.innerHTML = '<div class="empty-state">今天还没有添加任务，开始添加吧！</div>';
        return;
    }

    let html = '';
    todayTodos.forEach(todo => {
        html += `
            <div class="todo-item ${todo.completed ? 'completed' : ''}" data-todo-id="${todo.id}">
                <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
                <div class="todo-text">${todo.text}</div>
                <button class="todo-delete">删除</button>
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
