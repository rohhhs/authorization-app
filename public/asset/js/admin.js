// Administrator functions

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

// Ensure getAuthHeaders is available (from auth.js)
// If not available, define a fallback
if (typeof getAuthHeaders === 'undefined') {
    function getAuthHeaders() {
        const token = getCookie('access_token');
        if (!token) {
            return {
                'Content-Type': 'application/json',
                'Authorization': ''
            };
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }
}

// Load users list
async function loadUsers() {
    const usersList = document.getElementById('usersList');
    if (!usersList) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/users/`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        
        if (response.ok) {
            const users = await response.json();
            displayUsers(users);
        } else {
            usersList.innerHTML = '<p class="error">Не удалось загрузить пользователей</p>';
        }
    } catch (error) {
        usersList.innerHTML = '<p class="error">Произошла ошибка при загрузке пользователей</p>';
        console.error('Load users error:', error);
    }
}

// Display users
function displayUsers(users) {
    const usersList = document.getElementById('usersList');
    if (!usersList) return;
    
    if (users.length === 0) {
        usersList.innerHTML = '<p>Пользователи не найдены</p>';
        return;
    }
    
    const usersHTML = users.map(user => {
        let actionButtons = '';
        // Check both role_name and role fields (role_name from serializer, role for compatibility)
        const userRole = user.role_name || user.role || '';
        
        if (userRole === 'user') {
            actionButtons = `<button class="btn btn-primary btn-small" onclick="promoteUser(${user.id})">Повысить до модератора</button>`;
        } else if (userRole === 'moderator') {
            actionButtons = `<button class="btn btn-secondary btn-small" onclick="demoteUser(${user.id})">Понизить до пользователя</button>`;
        }
        
        return `
            <div class="user-card" data-user-id="${user.id}">
                <div class="user-header">
                    <h3>${escapeHtml(user.full_name || user.email)}</h3>
                    <span class="user-role-badge role-${userRole}">${escapeHtml(userRole)}</span>
                </div>
                <div class="user-info">
                    <p><strong>Email:</strong> ${escapeHtml(user.email)}</p>
                    <p><strong>Статус:</strong> ${user.is_active ? 'Активен' : 'Неактивен'}</p>
                    <p><strong>Зарегистрирован:</strong> ${new Date(user.date_joined).toLocaleString()}</p>
                </div>
                <div class="user-actions">
                    ${actionButtons}
                </div>
            </div>
        `;
    }).join('');
    
    usersList.innerHTML = usersHTML;
}

// Promote user to moderator
async function promoteUser(userId) {
    if (!confirm('Вы уверены, что хотите повысить этого пользователя до модератора?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}/promote/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            alert(data.message || 'Пользователь успешно повышен до модератора');
            loadUsers();
        } else {
            const data = await response.json();
            alert(data.error || 'Не удалось повысить пользователя');
        }
    } catch (error) {
        alert('Произошла ошибка при повышении пользователя');
        console.error('Promote user error:', error);
    }
}

// Demote moderator to user
async function demoteUser(userId) {
    if (!confirm('Вы уверены, что хотите понизить этого модератора до пользователя?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}/demote/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            alert(data.message || 'Модератор успешно понижен до пользователя');
            loadUsers();
        } else {
            const data = await response.json();
            alert(data.error || 'Не удалось понизить модератора');
        }
    } catch (error) {
        alert('Произошла ошибка при понижении модератора');
        console.error('Demote user error:', error);
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
window.loadUsers = loadUsers;
window.promoteUser = promoteUser;
window.demoteUser = demoteUser;
