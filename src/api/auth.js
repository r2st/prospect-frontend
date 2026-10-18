import { api } from './client';

// Auth endpoints. Login/refresh set a `_skipAuthRefresh` marker so a 401 from
// them doesn't recurse through the token-refresh interceptor.
export const authApi = {
  login: (email, password) =>
    api
      .post('/auth/login', { email, password }, { _skipAuthRefresh: true })
      .then((r) => r.data),

  // Public self-service sign-up: creates an organization + its first admin and
  // returns the same token payload as login.
  register: ({ orgName, adminEmail, password, adminName }) =>
    api
      .post(
        '/auth/register',
        {
          org_name: orgName,
          admin_email: adminEmail,
          password,
          ...(adminName ? { admin_name: adminName } : {}),
        },
        { _skipAuthRefresh: true },
      )
      .then((r) => r.data),

  refresh: (refreshToken) =>
    api
      .post('/auth/refresh', { refresh_token: refreshToken }, { _skipAuthRefresh: true })
      .then((r) => r.data),

  changePassword: (currentPassword, newPassword) =>
    api
      .post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      .then((r) => r.data),

  me: () => api.get('/auth/me').then((r) => r.data),

  // Active users for the admin/manager "View as" switcher (403 for others).
  teamMembers: () => api.get('/auth/team-members').then((r) => r.data),
};

// Admin user-management endpoints (admin role only).
export const adminUsersApi = {
  list: () => api.get('/admin/users').then((r) => r.data),
  create: (payload) => api.post('/admin/users', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/admin/users/${id}`, payload).then((r) => r.data),
  // Soft delete: the account is deactivated and hidden; its history stays.
  remove: (id) => api.delete(`/admin/users/${id}`).then((r) => r.data),
  resetPassword: (id, newPassword, mustChangePassword = true) =>
    api
      .post(`/admin/users/${id}/reset-password`, {
        new_password: newPassword,
        must_change_password: mustChangePassword,
      })
      .then((r) => r.data),
};
