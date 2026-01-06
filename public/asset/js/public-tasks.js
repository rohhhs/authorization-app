// Public tasks loading functions (no authentication required)

if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = '/api';
}
var API_BASE_URL = window.API_BASE_URL;

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load public tasks (no authentication required)
async function loadPublicTasks() {
    const publicTasksContainer = document.getElementById('publicTasksList');
    if (!publicTasksContainer) return;
    
    try {
        // Fetch public tasks without authentication headers
        const response = await fetch(`${API_BASE_URL}/tasks/public/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const tasks = await response.json();
            displayPublicTasks(tasks);
        } else {
            publicTasksContainer.innerHTML = '<p class="error">Не удалось загрузить задачи. Пожалуйста, попробуйте позже.</p>';
        }
    } catch (error) {
        publicTasksContainer.innerHTML = '<p class="error">Произошла ошибка при загрузке задач</p>';
        console.error('Load public tasks error:', error);
    }
}

// Display public tasks
function displayPublicTasks(tasks) {
    const publicTasksContainer = document.getElementById('publicTasksList');
    if (!publicTasksContainer) return;
    
    if (tasks.length === 0) {
        publicTasksContainer.innerHTML = '<p>В данный момент задач нет.</p>';
        return;
    }
    
    // Filter out deleted tasks and subtasks (show only top-level tasks)
    const topLevelTasks = tasks.filter(task => !task.parent_id && !task.is_deleted);
    
    if (topLevelTasks.length === 0) {
        publicTasksContainer.innerHTML = '<p>В данный момент задач нет.</p>';
        return;
    }
    
    const statusLabels = {
        'pending': 'ОЖИДАНИЕ',
        'in_progress': 'В РАБОТЕ',
        'done': 'ВЫПОЛНЕНО'
    };
    
    const tasksHTML = topLevelTasks.map(task => {
        const statusClass = getStatusClass(task.status);
        const statusLabel = task.status ? (statusLabels[task.status] || task.status.replace('_', ' ').toUpperCase()) : 'ОЖИДАНИЕ';
        
        const userInfo = task.user_info || task.created_by_info || {};
        const userName = userInfo.full_name || userInfo.name || 'Неизвестно';
        const userRole = userInfo.role_name || userInfo.role || 'N/A';
        
        return `
            <div class="task-card" data-task-id="${task.id}">
                <div class="task-header">
                    <h3>${escapeHtml(task.title)}</h3>
                    <span class="task-status ${statusClass}">${statusLabel}</span>
                </div>
                <p class="task-description">${escapeHtml(task.description || 'Нет описания')}</p>
                <div class="task-footer">
                    <span class="task-author">Создано: ${escapeHtml(userName)} (${userRole})</span>
                    <span class="task-date">${new Date(task.created_at).toLocaleString()}</span>
                </div>
            </div>
        `;
    }).join('');
    
    publicTasksContainer.innerHTML = tasksHTML;
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

// Make functions globally available
window.loadPublicTasks = loadPublicTasks;
