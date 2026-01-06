// Task management functions

if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = '/api';
}
var API_BASE_URL = window.API_BASE_URL;

// Get cookie value by name
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Use centralized token functions from auth.js
// These functions are global and handle sessionStorage, cookies, and timezone correctly
// No need to redefine them here - they're available from auth.js

// Load tasks
async function loadTasks() {
    const tasksList = document.getElementById('tasksList');
    if (!tasksList) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/tasks/`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        
        if (response.ok) {
            const tasks = await response.json();
            displayTasks(tasks);
        } else {
            if (response.status === 401) {
                tasksList.innerHTML = '<p class="error">Не авторизован. Пожалуйста, <a href="/login/">войдите</a>.</p>';
            } else {
                tasksList.innerHTML = '<p class="error">Не удалось загрузить задачи. Пожалуйста, попробуйте снова.</p>';
            }
        }
    } catch (error) {
        tasksList.innerHTML = '<p class="error">Произошла ошибка при загрузке задач</p>';
        console.error('Load tasks error:', error);
    }
}

// Display tasks with nested support
function displayTasks(tasks) {
    const tasksList = document.getElementById('tasksList');
    if (!tasksList) return;
    
    if (tasks.length === 0) {
        tasksList.innerHTML = '<p>Пока нет задач. Создайте свою первую задачу!</p>';
        return;
    }
    
    // Filter out subtasks (they will be displayed under their parents)
    const topLevelTasks = tasks.filter(task => !task.parent_id);
    
    const tasksHTML = topLevelTasks.map(task => renderTask(task, tasks, 0)).join('');
    
    tasksList.innerHTML = tasksHTML;
}

// Render a single task with nested subtasks
function renderTask(task, allTasks, depth) {
    const indent = depth * 20;
    const statusClass = getStatusClass(task.status);
    const statusLabels = {
        'pending': 'ОЖИДАНИЕ',
        'in_progress': 'В РАБОТЕ',
        'done': 'ВЫПОЛНЕНО'
    };
    const statusLabel = task.status ? (statusLabels[task.status] || task.status.replace('_', ' ').toUpperCase()) : 'ОЖИДАНИЕ';
    
    // Find subtasks
    const subtasks = allTasks.filter(t => t.parent_id === task.id);
    const subtasksHTML = subtasks.map(subtask => renderTask(subtask, allTasks, depth + 1)).join('');
    
    const userInfo = task.user_info || task.created_by_info || {};
    const userName = userInfo.full_name || userInfo.name || 'Неизвестно';
    const userRole = userInfo.role_name || userInfo.role || 'N/A';
    
    return `
        <div class="task-card" data-task-id="${task.id}" style="margin-left: ${indent}px;">
            <div class="task-header">
                <h3>${escapeHtml(task.title)}</h3>
                <div class="task-actions">
                    <span class="task-status ${statusClass}">${statusLabel}</span>
                    <button class="btn btn-primary btn-small" onclick="updateTaskStatus(${task.id})">Обновить статус</button>
                    <button class="btn btn-primary btn-small" onclick="editTask(${task.id})">Редактировать</button>
                    <button class="btn btn-secondary btn-small" onclick="createSubtask(${task.id})">Добавить подзадачу</button>
                    <button class="btn btn-danger btn-small" onclick="deleteTask(${task.id})">Удалить</button>
                </div>
            </div>
            <p class="task-description">${escapeHtml(task.description || 'Нет описания')}</p>
            <div class="task-footer">
                <span class="task-author">Создано: ${escapeHtml(userName)} (${userRole})</span>
                <span class="task-date">${new Date(task.created_at).toLocaleString()}</span>
            </div>
            ${subtasksHTML}
        </div>
    `;
}

// Get CSS class for task status
function getStatusClass(status) {
    switch(status) {
        case 'done':
            return 'status-done';
        case 'in_progress':
            return 'status-in-progress';
        case 'pending':
        default:
            return 'status-pending';
    }
}

// Create task
async function createTask(parentId = null) {
    const titleInput = document.getElementById('taskTitle');
    const descriptionInput = document.getElementById('taskDescription');
    
    if (!titleInput || !descriptionInput) return;
    
    const taskData = {
        title: titleInput.value,
        description: descriptionInput.value,
        status: 'pending'
    };
    
    if (parentId) {
        taskData.parent_id = parentId;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/tasks/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify(taskData)
        });
        
        if (response.ok) {
            titleInput.value = '';
            descriptionInput.value = '';
            loadTasks();
        } else {
            const data = await response.json();
            alert(data.error || 'Не удалось создать задачу');
        }
    } catch (error) {
        alert('Произошла ошибка при создании задачи');
        console.error('Create task error:', error);
    }
}

// Create subtask
async function createSubtask(parentId) {
    const title = prompt('Введите название подзадачи:');
    if (!title) return;
    
    const description = prompt('Введите описание подзадачи (необязательно):') || '';
    
    const taskData = {
        title: title,
        description: description,
        status: 'pending',
        parent_id: parentId
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/tasks/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify(taskData)
        });
        
        if (response.ok) {
            loadTasks();
        } else {
            const data = await response.json();
            alert(data.error || 'Не удалось создать подзадачу');
        }
    } catch (error) {
        alert('Произошла ошибка при создании подзадачи');
        console.error('Create subtask error:', error);
    }
}

// Edit task
async function editTask(taskId) {
    try {
        // Fetch current task data
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        
        if (!response.ok) {
            const data = await response.json();
            alert(data.error || 'Не удалось загрузить детали задачи');
            return;
        }
        
        const task = await response.json();
        
        // Show edit form (using prompt for simplicity, can be replaced with modal)
        const newTitle = prompt('Введите новое название:', task.title || '');
        if (newTitle === null) return; // User cancelled
        
        const newDescription = prompt('Введите новое описание:', task.description || '');
        if (newDescription === null) return; // User cancelled
        
        // Update task
        await updateTask(taskId, {
            title: newTitle,
            description: newDescription
        });
    } catch (error) {
        alert('Произошла ошибка при редактировании задачи');
        console.error('Edit task error:', error);
    }
}

// Update task
async function updateTask(taskId, taskData) {
    try {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify(taskData)
        });
        
        if (response.ok) {
            loadTasks();
        } else {
            const data = await response.json();
            alert(data.error || 'Не удалось обновить задачу');
        }
    } catch (error) {
        alert('Произошла ошибка при обновлении задачи');
        console.error('Update task error:', error);
    }
}

// Update task status
async function updateTaskStatus(taskId) {
    const currentStatus = prompt('Введите новый статус (pending, in_progress, done):');
    if (!currentStatus || !['pending', 'in_progress', 'done'].includes(currentStatus)) {
        alert('Неверный статус. Должен быть: pending, in_progress или done');
        return;
    }
    
    await updateTask(taskId, { status: currentStatus });
}

// Delete task
async function deleteTask(taskId) {
    if (!confirm('Вы уверены, что хотите удалить эту задачу? Это также удалит все подзадачи.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/delete/`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        
        if (response.ok) {
            loadTasks();
        } else {
            const data = await response.json();
            alert(data.error || 'Не удалось удалить задачу');
        }
    } catch (error) {
        alert('Произошла ошибка при удалении задачи');
        console.error('Delete task error:', error);
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions globally available
window.createTask = createTask;
window.createSubtask = createSubtask;
window.deleteTask = deleteTask;
window.updateTaskStatus = updateTaskStatus;
window.editTask = editTask;
window.updateTask = updateTask;
window.loadTasks = loadTasks;
