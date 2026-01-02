import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_URL = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('session_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const authAPI = {
  getSession: async (sessionId) => {
    const res = await api.get('/auth/session', {
      headers: { 'X-Session-ID': sessionId }
    });
    return res.data;
  },
  
  getCurrentUser: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  
  logout: async () => {
    const res = await api.post('/auth/logout');
    localStorage.removeItem('session_token');
    return res.data;
  }
};

// Meetings
export const meetingsAPI = {
  getAll: async () => {
    const res = await api.get('/meetings');
    return res.data;
  },
  
  getById: async (id) => {
    const res = await api.get(`/meetings/${id}`);
    return res.data;
  },
  
  create: async (data) => {
    const res = await api.post('/meetings', data);
    return res.data;
  },
  
  update: async (id, data) => {
    const res = await api.put(`/meetings/${id}`, data);
    return res.data;
  },
  
  delete: async (id) => {
    const res = await api.delete(`/meetings/${id}`);
    return res.data;
  },
  
  start: async (id) => {
    const res = await api.post(`/meetings/${id}/start`);
    return res.data;
  },
  
  nextItem: async (id) => {
    const res = await api.post(`/meetings/${id}/next-item`);
    return res.data;
  },
  
  complete: async (id) => {
    const res = await api.post(`/meetings/${id}/complete`);
    return res.data;
  },
  
  updateNotes: async (id, notes) => {
    const res = await api.post(`/meetings/${id}/notes`, { notes });
    return res.data;
  }
};

// Tasks
export const tasksAPI = {
  getAll: async (meetingId = null) => {
    const params = meetingId ? { meeting_id: meetingId } : {};
    const res = await api.get('/tasks', { params });
    return res.data;
  },
  
  create: async (data) => {
    const res = await api.post('/tasks', data);
    return res.data;
  },
  
  update: async (id, data) => {
    const res = await api.put(`/tasks/${id}`, data);
    return res.data;
  },
  
  delete: async (id) => {
    const res = await api.delete(`/tasks/${id}`);
    return res.data;
  }
};

// Reports
export const reportsAPI = {
  getAll: async (meetingId = null) => {
    const params = meetingId ? { meeting_id: meetingId } : {};
    const res = await api.get('/reports', { params });
    return res.data;
  },
  
  generate: async (meetingId, options = {}) => {
    const res = await api.post('/reports/generate', {
      meeting_id: meetingId,
      include_all_participants: true,
      ...options
    });
    return res.data;
  },
  
  getMeetingReports: async (meetingId) => {
    const res = await api.get(`/reports/meeting/${meetingId}`);
    return res.data;
  }
};

// Stats
export const statsAPI = {
  get: async () => {
    const res = await api.get('/stats');
    return res.data;
  }
};

export default api;
