// Centralized API Configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export default API_BASE_URL;

export const API_ENDPOINTS = {
    AUTH: {
        LOGIN: `${API_BASE_URL}/api/v1/auth/login`,
        REGISTER: `${API_BASE_URL}/api/v1/auth/register`,
        VERIFY_OTP: `${API_BASE_URL}/api/v1/auth/verify-otp`,
        RESEND_OTP: `${API_BASE_URL}/api/v1/auth/send-otp`,
        ME: `${API_BASE_URL}/api/v1/auth/me`,
        FORGOT_PASSWORD: `${API_BASE_URL}/api/v1/auth/forgot-password`,
        RESET_PASSWORD: `${API_BASE_URL}/api/v1/auth/reset-password`,
    },
    ADMIN: {
        ALL_USERS: `${API_BASE_URL}/api/all-users`,
        MASTER_ADD: `${API_BASE_URL}/api/master-add`,
        MASTER_STATUS: `${API_BASE_URL}/api/master-status`,
        SLAVE_ADD: `${API_BASE_URL}/api/slave-add`,
        SLAVE_DELETE: `${API_BASE_URL}/api/slave-delete`,
        ALL_SLAVES: `${API_BASE_URL}/api/all-slaves`,
        ALL_MASTERS: `${API_BASE_URL}/api/all-masters`,
    },
    USER: {
        PROFILE: `${API_BASE_URL}/api/v1/auth/me`,
        // Add other user specific endpoints here
    }
};
