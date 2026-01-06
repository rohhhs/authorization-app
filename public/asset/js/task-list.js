// Task listing page functions

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

let allTasks = [];
let currentGroup = 'all';
let sortColumn = null;
let sortDirection = 'asc';

// Load tasks
async function loadTasks(group = 'all') {
    const container = document.getElementById('tasksContainer');
    container.innerHTML = '<div class="loading">Загрузка задач...</div>';
    
    try {
        // Use public endpoint that doesn't require authentication
        const url = `${API_BASE_URL}/tasks/public/`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (response.ok) {
            allTasks = await response.json();
            // Filter by group if needed (client-side filtering for public endpoint)
            if (group !== 'all') {
                allTasks = allTasks.filter(task => {
                    const roleName = task.user_info?.role_name || '';
                    return roleName === group;
                });
            }
            displayTasks(allTasks);
        } else {
            container.innerHTML = '<div class="error">Не удалось загрузить задачи</div>';
        }
    } catch (error) {
        container.innerHTML = '<div class="error">Произошла ошибка при загрузке задач</div>';
        console.error('Load tasks error:', error);
    }
}

// Display tasks in table
function displayTasks(tasks) {
    const container = document.getElementById('tasksContainer');
    
    if (tasks.length === 0) {
        container.innerHTML = '<div class="loading">Задачи не найдены</div>';
        return;
    }
    
    // Sort tasks if needed
    if (sortColumn) {
        tasks = [...tasks].sort((a, b) => {
            let aVal, bVal;
            
            switch(sortColumn) {
                case 'title':
                    aVal = a.title || '';
                    bVal = b.title || '';
                    break;
                case 'status':
                    aVal = a.status || '';
                    bVal = b.status || '';
                    break;
                case 'user':
                    aVal = (a.user_info?.full_name || a.user_info?.email || '') + (a.user_info?.role_name || '');
                    bVal = (b.user_info?.full_name || b.user_info?.email || '') + (b.user_info?.role_name || '');
                    break;
                case 'created':
                    aVal = new Date(a.created_at).getTime();
                    bVal = new Date(b.created_at).getTime();
                    break;
                default:
                    return 0;
            }
            
            if (typeof aVal === 'string') {
                return sortDirection === 'asc' 
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            } else {
                return sortDirection === 'asc' 
                    ? aVal - bVal
                    : bVal - aVal;
            }
        });
    }
    
    const statusLabels = {
        'pending': 'ОЖИДАНИЕ',
        'in_progress': 'В РАБОТЕ',
        'done': 'ВЫПОЛНЕНО'
    };
    
    const tableHTML = `
        <table class="tasks-table">
            <thead>
                <tr>
                    <th class="sortable ${sortColumn === 'title' ? (sortDirection === 'asc' ? 'sort-asc' : 'sort-desc') : ''}" 
                        onclick="sortTasks('title')">Название</th>
                    <th>Описание</th>
                    <th class="sortable ${sortColumn === 'status' ? (sortDirection === 'asc' ? 'sort-asc' : 'sort-desc') : ''}" 
                        onclick="sortTasks('status')">Статус</th>
                    <th class="sortable ${sortColumn === 'user' ? (sortDirection === 'asc' ? 'sort-asc' : 'sort-desc') : ''}" 
                        onclick="sortTasks('user')">Создано</th>
                    <th class="sortable ${sortColumn === 'created' ? (sortDirection === 'asc' ? 'sort-asc' : 'sort-desc') : ''}" 
                        onclick="sortTasks('created')">Дата создания</th>
                </tr>
            </thead>
            <tbody>
                ${tasks.map(task => {
                    const userInfo = task.user_info || {};
                    const userName = userInfo.full_name || userInfo.email || 'Неизвестно';
                    const userRole = userInfo.role_name || 'N/A';
                    const status = task.status || 'pending';
                    const statusLabel = statusLabels[status] || status.replace('_', ' ').toUpperCase();
                    
                    return `
                        <tr>
                            <td>${escapeHtml(task.title)}</td>
                            <td>${escapeHtml(task.description || 'Нет описания')}</td>
                            <td><span class="status-badge ${status}">${statusLabel}</span></td>
                            <td>
                                ${escapeHtml(userName)}
                                <span class="role-badge ${userRole}">${escapeHtml(userRole)}</span>
                            </td>
                            <td>${new Date(task.created_at).toLocaleString()}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = tableHTML;
}

// Filter by group
function filterByGroup(group) {
    currentGroup = group;
    
    // Update button states
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.group === group) {
            btn.classList.add('active');
        }
    });
    
    loadTasks(group);
}

// Sort tasks
function sortTasks(column) {
    if (sortColumn === column) {
        // Toggle direction
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }
    
    displayTasks(allTasks);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
    // Strictly check access_token on page load using centralized functions from auth.js
    // Use getAccessToken() which checks sessionStorage first, then cookies
    if (typeof getAccessToken === 'function') {
        const accessToken = getAccessToken();
        if (!accessToken) {
            console.log('No access_token found on task list page. Redirecting to login.');
            const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/login/?next=${returnUrl}`;
            return;
        }
        
        // Check if token is expired using centralized function
        if (typeof isTokenExpired === 'function' && isTokenExpired()) {
            console.log('access_token is expired on task list page. Redirecting to login.');
            const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/login/?next=${returnUrl}`;
            return;
        }
    } else {
        // Fallback if auth.js hasn't loaded yet
        const accessToken = getCookie('access_token');
        if (!accessToken) {
            console.log('No access_token found on task list page. Redirecting to login.');
            const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/login/?next=${returnUrl}`;
            return;
        }
    }
    
    // Load tasks
    loadTasks('all');
});

// Make functions globally available
window.filterByGroup = filterByGroup;
window.sortTasks = sortTasks;
