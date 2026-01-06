// Authentication utility functions

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

// Get stored tokens from cookies
function getTokens() {
    return {
        access: getCookie('access_token'),
        refresh: getCookie('refresh_token')
    };
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

// Get authorization header (async version that can refresh token)
async function getAuthHeadersAsync() {
    // Try to get token from sessionStorage first, then cookie
    let token = getAccessToken();
    
    // Check if token exists and is not expired
    if (!token) {
        return {
            'Content-Type': 'application/json',
            'Authorization': ''
        };
    }
    
    // If token is expired, try to refresh it
    if (isTokenExpired()) {
        console.log('Token expired in getAuthHeaders, attempting refresh...');
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            token = getAccessToken(); // Get the newly refreshed token
        } else {
            return {
                'Content-Type': 'application/json',
                'Authorization': ''
            };
        }
    }
    
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// Get authorization header (synchronous version for backward compatibility)
function getAuthHeaders() {
    // Try to get token from sessionStorage first, then cookie
    const token = getAccessToken();
    
    // Check if token exists and is not expired
    // Note: This synchronous version cannot refresh tokens
    // Use getAuthHeadersAsync() in async contexts for automatic refresh
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

// Get session metadata
function getSessionMetadata() {
    return {
        screen_size: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        language: navigator.language || 'en-US',
        extra_metadata: {}
    };
}

// Error message utility functions
function showError(elementId, message) {
    const errorDiv = document.getElementById(elementId);
    if (errorDiv) {
        errorDiv.textContent = message;
        // Element will be visible automatically when it has content (CSS handles this)
    }
}

function clearError(elementId) {
    const errorDiv = document.getElementById(elementId);
    if (errorDiv) {
        errorDiv.textContent = '';
        // Element will be hidden automatically when empty (CSS handles this)
    }
}

// Redirect authenticated users away from auth pages
async function redirectIfAuthenticated() {
    const accessToken = sessionStorage.getItem('access_token') || getCookie('access_token');
    const expiresAt = sessionStorage.getItem('expires_at') || getCookie('access_token_expires_at');
    const refreshToken = sessionStorage.getItem('refresh_token') || getCookie('refresh_token');
    
    // Check if all tokens exist
    if (accessToken && expiresAt && refreshToken) {
        // Check if token is not expired
        if (!isTokenExpired()) {
            // User is authenticated, redirect to profile
            window.location.href = '/profile/index.html';
            return true;
        }
    }
    return false;
}

// Register function
async function register() {
    const form = document.getElementById('registerForm');
    clearError('registerError');
    
    const formData = {
        name: document.getElementById('name').value,
        surname: document.getElementById('surname').value,
        patronym: document.getElementById('patronym').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        password_repeat: document.getElementById('password_repeat').value
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/accounts/register/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include', // Include cookies
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Get tokens from API response body (server sends them explicitly)
            const accessToken = data.access_token || '';
            const refreshToken = data.refresh_token || '';
            const expiresAt = data.expires_at || '';
            const userEmail = data.email || data.user?.email || '';
            
            // Store tokens in sessionStorage
            if (accessToken) {
                sessionStorage.setItem('access_token', accessToken);
            }
            if (refreshToken) {
                sessionStorage.setItem('refresh_token', refreshToken);
            }
            if (expiresAt) {
                sessionStorage.setItem('expires_at', expiresAt);
            }
            if (userEmail) {
                sessionStorage.setItem('email', userEmail);
            }
            
            // Log tokens to console
            console.log('Registration successful. Authentication tokens stored:');
            console.log('access_token:', accessToken || 'Not available');
            console.log('expires_at:', expiresAt || 'Not available');
            console.log('refresh_token:', refreshToken || 'Not available');
            console.log('email:', userEmail || 'Not available');
            
            // Update navbar before redirect
            await updateNavbarForAuth();
            
            // Tokens are set as cookies by the server - redirect to profile
            window.location.href = '/profile/index.html';
        } else {
            // Handle error response
            const errorMsg = typeof data.error === 'string' ? data.error : 
                           (data.error && typeof data.error === 'object' ? Object.values(data.error).join(', ') : 
                           data.message || 'Registration failed');
            showError('registerError', errorMsg);
        }
    } catch (error) {
        showError('registerError', 'Произошла ошибка при регистрации');
        console.error('Registration error:', error);
    }
}

// Login function
async function login() {
    clearError('loginError');
    
    // Get session metadata
    const sessionMetadata = getSessionMetadata();
    
    const formData = {
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        screen_size: sessionMetadata.screen_size,
        timezone: sessionMetadata.timezone,
        language: sessionMetadata.language,
        extra_metadata: sessionMetadata.extra_metadata
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/accounts/login/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include', // Include cookies
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Get tokens from API response body (server sends them explicitly)
            const accessToken = data.access_token || '';
            const refreshToken = data.refresh_token || '';
            const expiresAt = data.expires_at || '';
            const userEmail = data.email || data.user?.email || '';
            
            // Store tokens in sessionStorage
            if (accessToken) {
                sessionStorage.setItem('access_token', accessToken);
            }
            if (refreshToken) {
                sessionStorage.setItem('refresh_token', refreshToken);
            }
            if (expiresAt) {
                sessionStorage.setItem('expires_at', expiresAt);
            }
            if (userEmail) {
                sessionStorage.setItem('email', userEmail);
            }
            
            // Log tokens to console
            console.log('Login successful. Authentication tokens stored:');
            console.log('access_token:', accessToken || 'Not available');
            console.log('expires_at:', expiresAt || 'Not available');
            console.log('refresh_token:', refreshToken || 'Not available');
            console.log('email:', userEmail || 'Not available');
            
            // Update navbar before redirect
            await updateNavbarForAuth();
            
            // Tokens are set as cookies by the server - redirect to profile
            window.location.href = '/profile/index.html';
        } else {
            // Handle error response
            const errorMsg = typeof data.error === 'string' ? data.error : 
                           (data.error && typeof data.error === 'object' ? Object.values(data.error).join(', ') : 
                           data.message || 'Login failed');
            showError('loginError', errorMsg);
        }
    } catch (error) {
        showError('loginError', 'Произошла ошибка при входе');
        console.error('Login error:', error);
    }
}

// Logout function
async function logout() {
    // Get tokens from sessionStorage first, then cookies
    const accessToken = getAccessToken();
    const refreshToken = sessionStorage.getItem('refresh_token') || getCookie('refresh_token');
    
    try {
        await fetch(`${API_BASE_URL}/accounts/logout/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': accessToken ? `Bearer ${accessToken}` : ''
            },
            credentials: 'include', // Include cookies
            body: JSON.stringify({ refresh_token: refreshToken || '' })
        });
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        // Clear all sessionStorage items
        sessionStorage.removeItem('access_token');
        sessionStorage.removeItem('refresh_token');
        sessionStorage.removeItem('expires_at');
        sessionStorage.removeItem('email');
        
        // Clear cookies manually (server also clears them, but ensure client-side clearing)
        document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'access_token_expires_at=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        
        // Update navbar to show login/register
        await updateNavbarForAuth();
        // Cookies are cleared by the server, but redirect anyway
        window.location.href = '/';
    }
}

// Delete account function
async function deleteAccount() {
    try {
        const response = await fetch(`${API_BASE_URL}/accounts/delete/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include' // Include cookies
        });
        
        if (response.ok) {
            alert('Аккаунт успешно удален');
            window.location.href = '/';
        } else {
            const data = await response.json();
            alert(data.error || 'Не удалось удалить аккаунт');
        }
    } catch (error) {
        alert('Произошла ошибка при удалении аккаунта');
        console.error('Delete account error:', error);
    }
}

// Refresh lock to prevent concurrent refresh calls
// Use var instead of let to allow redeclaration when script loads multiple times
var refreshPromise = null;
var isRefreshing = false;

// Refresh access token using refresh token
async function refreshAccessToken() {
    // If refresh is already in progress, return the existing promise
    if (isRefreshing && refreshPromise) {
        console.log('Token refresh already in progress, waiting for completion...');
        return refreshPromise;
    }
    
    // Get refresh token from sessionStorage first, then cookie
    const refreshToken = sessionStorage.getItem('refresh_token') || getCookie('refresh_token');
    
    if (!refreshToken) {
        console.log('No refresh token available for token refresh');
        return false;
    }
    
    // Set refresh lock
    isRefreshing = true;
    
    // Create refresh promise
    refreshPromise = (async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/accounts/token/refresh/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ refresh_token: refreshToken })
            });
            
            const data = await response.json();
            
            if (response.ok && data.access_token) {
                // Update sessionStorage with new tokens
                if (data.access_token) {
                    sessionStorage.setItem('access_token', data.access_token);
                }
                if (data.refresh_token) {
                    sessionStorage.setItem('refresh_token', data.refresh_token);
                }
                if (data.expires_at) {
                    sessionStorage.setItem('expires_at', data.expires_at);
                }
                if (data.email) {
                    sessionStorage.setItem('email', data.email);
                }
                
                console.log('Access token refreshed successfully');
                return true;
            } else {
                console.error('Token refresh failed:', data.error || 'Unknown error');
                return false;
            }
        } catch (error) {
            console.error('Token refresh error:', error);
            return false;
        } finally {
            // Release refresh lock
            isRefreshing = false;
            refreshPromise = null;
        }
    })();
    
    return refreshPromise;
}

// Validate access token via API call
async function validateAccessToken() {
    const accessToken = getAccessToken();
    
    // If no token, validation fails
    if (!accessToken) {
        return false;
    }
    
    // Check if token is expired locally first (optimization)
    if (isTokenExpired()) {
        // Try to refresh the token before giving up
        console.log('Access token expired, attempting to refresh...');
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
            return false;
        }
        // After refresh, token should be valid now
    }
    
    // Validate token by making API call
    try {
        const response = await fetch(`${API_BASE_URL}/accounts/profile/`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        
        // Token is valid if API call succeeds (200/201)
        return response.ok;
    } catch (error) {
        // Network error or other issues - consider token invalid
        console.error('Token validation error:', error);
        return false;
    }
}

// Strictly check access token and redirect if invalid
// This function should be called on all protected pages
async function requireAuth(redirectToLogin = true) {
    const accessToken = getCookie('access_token');
    
    if (!accessToken) {
        if (redirectToLogin) {
            const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/login/?next=${returnUrl}`;
        }
        return false;
    }
    
    if (isTokenExpired()) {
        if (redirectToLogin) {
            const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/login/?next=${returnUrl}`;
        }
        return false;
    }
    
    // Validate with backend
    const isValid = await validateAccessToken();
    if (!isValid && redirectToLogin) {
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login/?next=${returnUrl}`;
    }
    
    return isValid;
}

// Update navbar based on authentication status
async function updateNavbarForAuth() {
    const navMenu = document.getElementById('navMenu');
    if (!navMenu) return;
    
    // Check for access_token in sessionStorage first, then cookies
    const accessToken = getAccessToken();
    if (!accessToken) {
        console.log('No access_token specified. Displaying Login and Register links.');
    }
    
    // Validate token via API call
    const isAuthenticated = await validateAccessToken();
    
    // Show Profile/Logout only if token is validated successfully
    if (isAuthenticated) {
        // User is authenticated - show Profile and Logout
        const existingLinks = navMenu.querySelectorAll('.nav-link, .btn-link');
        existingLinks.forEach(link => {
            if (link.textContent.trim() === 'Login' || link.textContent.trim() === 'Register') {
                link.remove();
            }
        });
        
        // Check if Profile link already exists
        let profileLink = navMenu.querySelector('a[href*="profile"]');
        if (!profileLink) {
            profileLink = document.createElement('a');
            profileLink.href = '/profile/index.html';
            profileLink.className = 'nav-link';
            profileLink.textContent = 'Профиль';
            navMenu.insertBefore(profileLink, navMenu.firstChild.nextSibling);
        }
        
        // Check if Logout button already exists
        let logoutBtn = navMenu.querySelector('#logoutBtn');
        if (!logoutBtn) {
            logoutBtn = document.createElement('button');
            logoutBtn.id = 'logoutBtn';
            logoutBtn.className = 'nav-link btn-link';
            logoutBtn.textContent = 'Выйти';
            logoutBtn.addEventListener('click', function() {
                logout();
            });
            navMenu.appendChild(logoutBtn);
        }
    } else {
        // User is not authenticated - show Login and Register
        const existingLinks = navMenu.querySelectorAll('a[href*="profile"], #logoutBtn');
        existingLinks.forEach(link => link.remove());
        
        // Check if Login link already exists
        let loginLink = navMenu.querySelector('a[href="/login/"]');
        if (!loginLink) {
            loginLink = document.createElement('a');
            loginLink.href = '/login/';
            loginLink.className = 'nav-link';
            loginLink.textContent = 'Войти';
            navMenu.appendChild(loginLink);
        }
        
        // Check if Register link already exists
        let registerLink = navMenu.querySelector('a[href="/register/"]');
        if (!registerLink) {
            registerLink = document.createElement('a');
            registerLink.href = '/register/';
            registerLink.className = 'nav-link';
            registerLink.textContent = 'Регистрация';
            navMenu.appendChild(registerLink);
        }
    }
}

// Logout button handler
document.addEventListener('DOMContentLoaded', async function() {
    // Update navbar on page load
    await updateNavbarForAuth();
    
    // Setup logout button handler (may be added dynamically)
    setupLogoutButtonHandler();
});

// Setup logout button handler (call after navbar is updated)
function setupLogoutButtonHandler() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        // Remove existing event listeners by cloning and replacing
        const newLogoutBtn = logoutBtn.cloneNode(true);
        logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
        
        newLogoutBtn.addEventListener('click', function() {
            logout();
        });
    }
}
