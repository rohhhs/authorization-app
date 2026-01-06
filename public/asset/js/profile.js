// Profile management functions

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

// Get access token from sessionStorage first, then cookies
function getAccessToken() {
    // Check sessionStorage first (set from API response)
    const sessionToken = sessionStorage.getItem('access_token');
    if (sessionToken) {
        return sessionToken;
    }
    // Fallback to cookie (HttpOnly, may not be readable)
    return getCookie('access_token');
}

// Get expires_at from sessionStorage first, then cookies
function getExpiresAt() {
    // Check sessionStorage first
    const sessionExpires = sessionStorage.getItem('expires_at');
    if (sessionExpires) {
        return sessionExpires;
    }
    // Fallback to cookie
    return getCookie('access_token_expires_at');
}

// Check if token is expired
function isTokenExpired() {
    const expiresAt = getExpiresAt();
    if (!expiresAt) {
        return true; // If no expiration info, consider expired
    }
    
    try {
        // Parse expiration time - JavaScript Date handles ISO 8601 with timezone correctly
        // Server sends UTC time: "2026-01-05T22:58:02+00:00"
        // Date.parse() and new Date() handle this correctly, converting to local timezone
        // But we need to compare UTC timestamps to avoid timezone issues
        const expirationDate = new Date(expiresAt);
        
        // Get current UTC time in milliseconds
        const nowUTC = Date.now();
        
        // Get expiration UTC time in milliseconds
        const expirationUTC = expirationDate.getTime();
        
        // Add 5 second buffer to account for network delays and clock skew
        const bufferMs = 5000;
        
        // Compare: if expiration time (minus buffer) is less than or equal to now, it's expired
        return (expirationUTC - bufferMs) <= nowUTC;
    } catch (error) {
        console.error('Error parsing expiration date:', error, 'expiresAt:', expiresAt);
        return true; // If parsing fails, consider expired
    }
}

// Get authorization header
function getAuthHeaders() {
    // Try to get token from sessionStorage first, then cookie
    const token = getAccessToken();
    
    // Check if token exists and is not expired
    if (!token || isTokenExpired()) {
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

// Initialize profile page
async function initProfilePage() {
    // Strictly check for access token first - check sessionStorage, then cookies
    const accessToken = getAccessToken();
    if (!accessToken) {
        console.log('No access_token found. Redirecting to login.');
        // Store the attempted URL to redirect back after login
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login/?next=${returnUrl}`;
        return;
    }
    
    // Check if token is expired locally - try to refresh first using centralized function
    if (isTokenExpired()) {
        console.log('access_token is expired. Attempting to refresh...');
        // Use centralized refreshAccessToken() function from auth.js
        if (typeof refreshAccessToken === 'function') {
            const refreshed = await refreshAccessToken();
            if (!refreshed) {
                console.log('Token refresh failed. Redirecting to login.');
                const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
                window.location.href = `/login/?next=${returnUrl}`;
                return;
            }
            // Token refreshed successfully, continue with validation
        } else {
            // Fallback if refreshAccessToken is not available (shouldn't happen)
            console.error('refreshAccessToken function not available');
            const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/login/?next=${returnUrl}`;
            return;
        }
    }
    
    // Strictly validate token with backend - verify token is valid and get user info from PostgreSQL
    console.log('Validating access_token with backend...');
    const userInfo = await getUserInfo();
    
    if (!userInfo) {
        // Token is invalid, expired, or API call failed - redirect to login
        console.error('access_token validation failed - getUserInfo returned null');
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login/?next=${returnUrl}`;
        return;
    }
    
    if (!userInfo.email) {
        // User info missing email - redirect to login
        console.error('access_token validation failed - user info missing email. UserInfo:', userInfo);
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login/?next=${returnUrl}`;
        return;
    }
    
    // Validate that access_token matches the user email from PostgreSQL database
    // This ensures the token is valid and belongs to the authenticated user
    const dbEmail = userInfo.email;
    const storedEmail = sessionStorage.getItem('email');
    
    // Verify email from database matches stored email (if available)
    // Note: This is a soft check - if stored email doesn't match, we update it rather than redirecting
    // because the database is the authoritative source
    if (storedEmail && dbEmail !== storedEmail) {
        console.warn('Email mismatch between database and stored value. Updating stored email with database value.');
        // Don't redirect - just update the stored value
    }
    
    // Update sessionStorage with email from database (most authoritative source)
    if (dbEmail) {
        sessionStorage.setItem('email', dbEmail);
        console.log('Profile validation successful. User email:', dbEmail);
    }
    
    // Token is valid and user is authenticated - proceed with loading content
    // Load user profile and tasks
    await loadUserProfile();
    await loadTasks();
    
    // Check if user is administrator based on backend response (not GET parameter)
    if (userInfo && (userInfo.role_name === 'administrator' || userInfo.role === 'administrator')) {
        const adminSection = document.getElementById('adminSection');
        if (adminSection) {
            adminSection.style.display = 'block';
            loadUsers();
        }
    }
}

// Get user info
async function getUserInfo() {
    try {
        // Get token from sessionStorage first, then cookie
        let token = getAccessToken();
        if (!token) {
            console.error('No access token available for getUserInfo');
            return null;
        }
        
        // Check if token is expired and try to refresh it
        if (isTokenExpired()) {
            console.log('Token expired in getUserInfo, attempting refresh...');
            const refreshed = await refreshAccessToken();
            if (refreshed) {
                // Get the newly refreshed token
                token = getAccessToken();
            } else {
                console.error('Failed to refresh token in getUserInfo');
                return null;
            }
        }
        
        // Use async headers if available, otherwise use sync headers with fresh token
        let headers;
        if (typeof getAuthHeadersAsync === 'function') {
            headers = await getAuthHeadersAsync();
        } else {
            headers = getAuthHeaders();
            // If headers are empty, token might have expired during the check
            if (!headers.Authorization && token) {
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                };
            }
        }
        
        if (!headers.Authorization) {
            console.error('Failed to get authorization header - token may be expired or invalid');
            return null;
        }
        
        const response = await fetch(`${API_BASE_URL}/accounts/profile/`, {
            method: 'GET',
            headers: headers,
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            const userInfo = data.user || data;
            console.log('User info retrieved successfully:', userInfo.email);
            return userInfo;
        } else if (response.status === 401) {
            // Unauthorized - token is invalid or expired, try one more refresh
            console.log('Unauthorized (401) - attempting token refresh before retry...');
            const refreshed = await refreshAccessToken();
            if (refreshed) {
                // Retry with new token
                token = getAccessToken();
                if (token) {
                    headers = {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    };
                    const retryResponse = await fetch(`${API_BASE_URL}/accounts/profile/`, {
                        method: 'GET',
                        headers: headers,
                        credentials: 'include'
                    });
                    if (retryResponse.ok) {
                        const retryData = await retryResponse.json();
                        const retryUserInfo = retryData.user || retryData;
                        console.log('User info retrieved successfully after retry:', retryUserInfo.email);
                        return retryUserInfo;
                    }
                }
            }
            console.error('Unauthorized (401) - token is invalid or expired after refresh attempt');
            return null;
        } else {
            console.error('Failed to get user info. Status:', response.status);
            const errorData = await response.json().catch(() => ({}));
            console.error('Error data:', errorData);
            return null;
        }
    } catch (error) {
        console.error('Get user info error:', error);
        return null;
    }
}

// Load user profile
async function loadUserProfile() {
    const userInfoDiv = document.getElementById('userInfo');
    const nameInput = document.getElementById('profileName');
    const surnameInput = document.getElementById('profileSurname');
    const patronymInput = document.getElementById('profilePatronym');
    const birthDateInput = document.getElementById('profileBirthDate');
    const birthPlaceInput = document.getElementById('profileBirthPlace');
    const currentEmailInput = document.getElementById('currentEmail');
    
    try {
        const response = await fetch(`${API_BASE_URL}/accounts/profile/`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            const user = data.user || data;
            
            // Display user info
            if (userInfoDiv) {
                const roleName = user.role_name || user.role || 'N/A';
                const birthDate = user.birth_date ? new Date(user.birth_date).toLocaleDateString() : 'Не указано';
                const birthPlace = user.birth_place || 'Не указано';
                
                userInfoDiv.innerHTML = `
                    <p><strong>Email:</strong> ${escapeHtml(user.email)}</p>
                    <p><strong>Полное имя:</strong> ${escapeHtml(user.full_name || user.name + ' ' + user.surname)}</p>
                    <p><strong>Роль:</strong> ${escapeHtml(roleName)}</p>
                    <p><strong>Дата рождения:</strong> ${escapeHtml(birthDate)}</p>
                    <p><strong>Место рождения:</strong> ${escapeHtml(birthPlace)}</p>
                    <p><strong>Зарегистрирован:</strong> ${new Date(user.date_joined).toLocaleString()}</p>
                `;
            }
            
            // Fill form fields
            if (nameInput) nameInput.value = user.name || '';
            if (surnameInput) surnameInput.value = user.surname || '';
            if (patronymInput) patronymInput.value = user.patronym || '';
            if (birthDateInput) birthDateInput.value = user.birth_date || '';
            if (birthPlaceInput) birthPlaceInput.value = user.birth_place || '';
            if (currentEmailInput) currentEmailInput.value = user.email || '';
        } else {
            if (response.status === 401) {
                // Not authenticated, redirect to login with return URL
                const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
                window.location.href = `/login/?next=${returnUrl}`;
                return;
            } else {
                // Other error - show error message
                if (userInfoDiv) {
                    userInfoDiv.innerHTML = '<p class="error">Не удалось загрузить информацию о пользователе. Пожалуйста, попробуйте снова.</p>';
                }
            }
        }
    } catch (error) {
        console.error('Load profile error:', error);
        if (userInfoDiv) {
            userInfoDiv.innerHTML = '<p class="error">Произошла ошибка при загрузке информации о пользователе. Пожалуйста, обновите страницу.</p>';
        }
    }
}

// Update profile
async function updateProfile() {
    // Use utility function from auth.js if available, otherwise fallback to direct manipulation
    if (typeof clearError === 'function') {
        clearError('profileError');
    } else {
        const errorDiv = document.getElementById('profileError');
        if (errorDiv) errorDiv.textContent = '';
    }
    
    const profileData = {
        name: document.getElementById('profileName').value,
        surname: document.getElementById('profileSurname').value,
        patronym: document.getElementById('profilePatronym').value,
        birth_date: document.getElementById('profileBirthDate')?.value || '',
        birth_place: document.getElementById('profileBirthPlace')?.value || ''
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/accounts/profile/`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify(profileData)
        });
        
        if (response.ok) {
            const data = await response.json();
            alert('Профиль успешно обновлен');
            await loadUserProfile();
        } else {
            const data = await response.json();
            const errorMsg = data.error || data.message || 'Не удалось обновить профиль';
            if (typeof showError === 'function') {
                showError('profileError', errorMsg);
            } else {
                const errorDiv = document.getElementById('profileError');
                if (errorDiv) {
                    errorDiv.textContent = errorMsg;
                }
            }
        }
    } catch (error) {
        const errorMsg = 'Произошла ошибка при обновлении профиля';
        if (typeof showError === 'function') {
            showError('profileError', errorMsg);
        } else {
            const errorDiv = document.getElementById('profileError');
            if (errorDiv) {
                errorDiv.textContent = errorMsg;
            }
        }
        console.error('Update profile error:', error);
    }
}

// Change email
async function changeEmail() {
    // Use utility function from auth.js if available, otherwise fallback to direct manipulation
    if (typeof clearError === 'function') {
        clearError('emailError');
    } else {
        const errorDiv = document.getElementById('emailError');
        if (errorDiv) errorDiv.textContent = '';
    }
    
    const newEmail = document.getElementById('newEmail').value;
    const password = document.getElementById('emailPassword').value;
    
    // Client-side validation
    if (!newEmail || !password) {
        const errorMsg = 'Новый email и пароль обязательны';
        if (typeof showError === 'function') {
            showError('emailError', errorMsg);
        } else {
            const errorDiv = document.getElementById('emailError');
            if (errorDiv) {
                errorDiv.textContent = errorMsg;
            }
        }
        return;
    }
    
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
        const errorMsg = 'Пожалуйста, введите действительный адрес email';
        if (typeof showError === 'function') {
            showError('emailError', errorMsg);
        } else {
            const errorDiv = document.getElementById('emailError');
            if (errorDiv) {
                errorDiv.textContent = errorMsg;
            }
        }
        return;
    }
    
    const emailData = {
        new_email: newEmail,
        password: password
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/accounts/change-email/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify(emailData)
        });
        
        if (response.ok) {
            const data = await response.json();
            alert('Email успешно изменен. Пожалуйста, войдите снова, используя новый email.');
            
            // Clear form
            document.getElementById('newEmail').value = '';
            document.getElementById('emailPassword').value = '';
            
            // Update sessionStorage with new email
            if (data.new_email) {
                sessionStorage.setItem('email', data.new_email);
            }
            
            // Reload profile to show updated email
            await loadUserProfile();
        } else {
            const data = await response.json();
            const errorMsg = data.error || data.message || 'Не удалось изменить email';
            const finalErrorMsg = typeof errorMsg === 'object' ? Object.values(errorMsg).join(', ') : errorMsg;
            if (typeof showError === 'function') {
                showError('emailError', finalErrorMsg);
            } else {
                const errorDiv = document.getElementById('emailError');
                if (errorDiv) {
                    errorDiv.textContent = finalErrorMsg;
                }
            }
        }
    } catch (error) {
        const errorMsg = 'Произошла ошибка при изменении email';
        if (typeof showError === 'function') {
            showError('emailError', errorMsg);
        } else {
            const errorDiv = document.getElementById('emailError');
            if (errorDiv) {
                errorDiv.textContent = errorMsg;
            }
        }
        console.error('Change email error:', error);
    }
}

// Change password
async function changePassword() {
    // Use utility function from auth.js if available, otherwise fallback to direct manipulation
    if (typeof clearError === 'function') {
        clearError('passwordError');
    } else {
        const errorDiv = document.getElementById('passwordError');
        if (errorDiv) errorDiv.textContent = '';
    }
    
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const newPasswordRepeat = document.getElementById('newPasswordRepeat').value;
    
    // Client-side validation
    if (!oldPassword || !newPassword || !newPasswordRepeat) {
        const errorMsg = 'Все поля обязательны для заполнения';
        if (typeof showError === 'function') {
            showError('passwordError', errorMsg);
        } else {
            const errorDiv = document.getElementById('passwordError');
            if (errorDiv) {
                errorDiv.textContent = errorMsg;
            }
        }
        return;
    }
    
    if (newPassword !== newPasswordRepeat) {
        const errorMsg = 'Новые пароли не совпадают';
        if (typeof showError === 'function') {
            showError('passwordError', errorMsg);
        } else {
            const errorDiv = document.getElementById('passwordError');
            if (errorDiv) {
                errorDiv.textContent = errorMsg;
            }
        }
        return;
    }
    
    const passwordData = {
        old_password: oldPassword,
        new_password: newPassword,
        new_password_repeat: newPasswordRepeat
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/accounts/change-password/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify(passwordData)
        });
        
        if (response.ok) {
            alert('Пароль успешно изменен');
            // Clear form
            document.getElementById('oldPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('newPasswordRepeat').value = '';
        } else {
            const data = await response.json();
            const errorMsg = data.error || data.message || 'Не удалось изменить пароль';
            const finalErrorMsg = typeof errorMsg === 'object' ? Object.values(errorMsg).join(', ') : errorMsg;
            if (typeof showError === 'function') {
                showError('passwordError', finalErrorMsg);
            } else {
                const errorDiv = document.getElementById('passwordError');
                if (errorDiv) {
                    errorDiv.textContent = finalErrorMsg;
                }
            }
        }
    } catch (error) {
        const errorMsg = 'Произошла ошибка при изменении пароля';
        if (typeof showError === 'function') {
            showError('passwordError', errorMsg);
        } else {
            const errorDiv = document.getElementById('passwordError');
            if (errorDiv) {
                errorDiv.textContent = errorMsg;
            }
        }
        console.error('Change password error:', error);
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
window.initProfilePage = initProfilePage;
window.loadUserProfile = loadUserProfile;
window.updateProfile = updateProfile;
window.changeEmail = changeEmail;
window.changePassword = changePassword;