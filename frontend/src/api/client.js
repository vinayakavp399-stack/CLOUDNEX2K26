const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api/v1`
  : '/api/v1';

function isSessionAdmin() {
  try {
    const raw = sessionStorage.getItem('cloudnex_user');
    if (!raw) return false;
    const u = JSON.parse(raw);
    return u?.role === 'admin';
  } catch {
    return false;
  }
}

function getContextRole(endpoint) {
  if (endpoint && typeof endpoint === 'string' && endpoint.startsWith('/admin')) return 'admin';
  if (typeof window !== 'undefined') {
    const p = window.location.pathname.toLowerCase();
    if (p.includes('/admin')) return 'admin';
  }
  return 'participant';
}

export function getAuthToken(roleOrEndpoint) {
  const role = roleOrEndpoint && typeof roleOrEndpoint === 'string' && roleOrEndpoint.startsWith('/')
    ? getContextRole(roleOrEndpoint)
    : roleOrEndpoint;

  // Check tab-scoped sessionStorage first
  const sessionToken = sessionStorage.getItem('cloudnex_token');
  if (role === 'admin') {
    const adminSession = sessionStorage.getItem('cloudnex_admin_token');
    if (adminSession) return adminSession;
    if (sessionToken && isSessionAdmin()) return sessionToken;
    const adminLocal = localStorage.getItem('cloudnex_admin_token');
    if (adminLocal) return adminLocal;
  } else if (role === 'participant') {
    const partSession = sessionStorage.getItem('cloudnex_participant_token');
    if (partSession) return partSession;
    if (sessionToken && !isSessionAdmin()) return sessionToken;
    const partLocal = localStorage.getItem('cloudnex_participant_token');
    if (partLocal) return partLocal;
  }

  if (sessionToken) return sessionToken;

  if (typeof window !== 'undefined' && window.location.pathname.toLowerCase().includes('/admin')) {
    return localStorage.getItem('cloudnex_admin_token') || localStorage.getItem('cloudnex_token');
  }
  return localStorage.getItem('cloudnex_participant_token') || localStorage.getItem('cloudnex_token');
}

export function setAuthToken(token, role) {
  if (token) {
    sessionStorage.setItem('cloudnex_token', token);
    if (role === 'admin') {
      sessionStorage.setItem('cloudnex_admin_token', token);
      localStorage.setItem('cloudnex_admin_token', token);
    } else if (role === 'participant') {
      sessionStorage.setItem('cloudnex_participant_token', token);
      localStorage.setItem('cloudnex_participant_token', token);
    }
    localStorage.setItem('cloudnex_token', token);
  } else {
    sessionStorage.removeItem('cloudnex_token');
    localStorage.removeItem('cloudnex_token');
    if (role === 'admin' || !role) {
      sessionStorage.removeItem('cloudnex_admin_token');
      localStorage.removeItem('cloudnex_admin_token');
    }
    if (role === 'participant' || !role) {
      sessionStorage.removeItem('cloudnex_participant_token');
      localStorage.removeItem('cloudnex_participant_token');
    }
  }
}

export function getUserData(role) {
  try {
    const isAdminPath = typeof window !== 'undefined' && window.location.pathname.toLowerCase().includes('/admin');
    const targetRole = role || (isAdminPath ? 'admin' : null);

    if (targetRole === 'admin') {
      const adminSession = sessionStorage.getItem('cloudnex_admin_user');
      if (adminSession) return JSON.parse(adminSession);
      const adminLocal = localStorage.getItem('cloudnex_admin_user');
      if (adminLocal) return JSON.parse(adminLocal);
    } else if (targetRole === 'participant') {
      const partSession = sessionStorage.getItem('cloudnex_participant_user');
      if (partSession) return JSON.parse(partSession);
      const partLocal = localStorage.getItem('cloudnex_participant_user');
      if (partLocal) return JSON.parse(partLocal);
    }

    const sessionRaw = sessionStorage.getItem('cloudnex_user');
    if (sessionRaw) return JSON.parse(sessionRaw);

    const localRaw = localStorage.getItem('cloudnex_user');
    return localRaw ? JSON.parse(localRaw) : null;
  } catch {
    return null;
  }
}

export function setUserData(user) {
  if (user) {
    const str = JSON.stringify(user);
    sessionStorage.setItem('cloudnex_user', str);
    if (user.role === 'admin') {
      sessionStorage.setItem('cloudnex_admin_user', str);
      localStorage.setItem('cloudnex_admin_user', str);
    } else {
      sessionStorage.setItem('cloudnex_participant_user', str);
      localStorage.setItem('cloudnex_participant_user', str);
    }
    localStorage.setItem('cloudnex_user', str);
  } else {
    sessionStorage.removeItem('cloudnex_user');
    sessionStorage.removeItem('cloudnex_admin_user');
    sessionStorage.removeItem('cloudnex_participant_user');
    localStorage.removeItem('cloudnex_user');
    localStorage.removeItem('cloudnex_admin_user');
    localStorage.removeItem('cloudnex_participant_user');
  }
}

async function request(endpoint, options = {}) {
  const token = getAuthToken(endpoint);
  const headers = {
    ...(options.headers || {})
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If not FormData, default to application/json
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = (data && data.detail) || (typeof data === 'string' ? data : 'API Request failed');
    if (response.status === 401) {
      const endpointRole = getContextRole(endpoint);
      if (endpointRole === 'admin') {
        sessionStorage.removeItem('cloudnex_admin_token');
        localStorage.removeItem('cloudnex_admin_token');
        sessionStorage.removeItem('cloudnex_admin_user');
        localStorage.removeItem('cloudnex_admin_user');
      }
    }
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  auth: {
    login: async (username, password) => {
      return request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
    },
    register: async (teamData) => {
      return request('/auth/register-participant', {
        method: 'POST',
        body: JSON.stringify(teamData)
      });
    },
    me: async () => {
      return request('/auth/me');
    },
    logout: async () => {
      return request('/auth/logout', {
        method: 'POST'
      });
    }
  },
  rounds: {
    getAll: async () => {
      return request('/rounds');
    },
    getOne: async (roundNumber) => {
      return request(`/rounds/${roundNumber}`);
    }
  },
  submissions: {
    getMy: async () => {
      return request('/submissions/my');
    },
    submit: async (formData) => {
      return request('/submissions', {
        method: 'POST',
        body: formData
      });
    }
  },
  admin: {
    getOverview: async () => {
      return request('/admin/overview');
    },
    openRound: async (roundNumber, deadlineMinutes = 180, publishProblem = false) => {
      return request(`/admin/rounds/${roundNumber}/open?deadline_minutes=${deadlineMinutes}&publish_problem=${publishProblem}`, {
        method: 'POST'
      });
    },
    closeRound: async (roundNumber) => {
      return request(`/admin/rounds/${roundNumber}/close`, {
        method: 'POST'
      });
    },
    reopenRound: async (roundNumber, deadlineMinutes = 60) => {
      return request(`/admin/rounds/${roundNumber}/reopen?deadline_minutes=${deadlineMinutes}`, {
        method: 'POST'
      });
    },
    toggleSubmissions: async (roundNumber, open = true) => {
      return request(`/admin/rounds/${roundNumber}/submissions/toggle?open=${open}`, {
        method: 'POST'
      });
    },
    publishProblems: async (roundNumber = 1) => {
      return request(`/admin/rounds/${roundNumber}/publish-problems`, {
        method: 'POST'
      });
    },
    unpublishProblems: async (roundNumber = 1) => {
      return request(`/admin/rounds/${roundNumber}/unpublish-problems`, {
        method: 'POST'
      });
    },
    setResultsTimer: async (roundNumber = 3, seconds = 60, action = 'set') => {
      return request(`/admin/rounds/${roundNumber}/results-timer?seconds=${seconds}&action=${action}`, {
        method: 'POST'
      });
    },
    updateProblem: async (roundNumber, problemData) => {
      return request(`/admin/rounds/${roundNumber}/problem`, {
        method: 'PUT',
        body: JSON.stringify(problemData)
      });
    },
    getTeams: async () => {
      return request('/admin/teams');
    },
    getSubmissions: async (roundNumber = null) => {
      const query = roundNumber ? `?round_number=${roundNumber}` : '';
      return request(`/admin/submissions${query}`);
    },
    getEvaluations: async (roundNumber = null) => {
      const query = roundNumber ? `?round_number=${roundNumber}` : '';
      return request(`/admin/evaluations${query}`);
    },
    evaluate: async (evaluationData) => {
      return request('/admin/evaluations', {
        method: 'POST',
        body: JSON.stringify(evaluationData)
      });
    },
    qualify: async (qualificationData) => {
      return request('/admin/elimination/qualify', {
        method: 'POST',
        body: JSON.stringify(qualificationData)
      });
    },
    getAuditLogs: async () => [],
    getAllocationConfig: async () => {
      return request('/admin/allocation/config');
    },
    updateAllocationConfig: async (config) => {
      return request('/admin/allocation/config', {
        method: 'POST',
        body: JSON.stringify(config)
      });
    },
    getAllocationStats: async () => {
      return request('/admin/allocation/stats');
    },
    allocateProblems: async (force = false) => {
      return request(`/admin/allocation/allocate?force=${force}`, {
        method: 'POST'
      });
    },
    resetAllocation: async (confirmText = 'RESET', reason = 'Admin manual reset') => {
      return request('/admin/allocation/reset', {
        method: 'POST',
        body: JSON.stringify({ confirm_text: confirmText, reason })
      });
    },
    getProblemStatements: async () => {
      return request('/admin/problem-statements');
    },
    saveProblemStatements: async (problems) => {
      return request('/admin/problem-statements', {
        method: 'POST',
        body: JSON.stringify(problems)
      });
    },
    updateProblemStatement: async (problemId, problemData) => {
      return request(`/admin/problem-statements/${problemId}`, {
        method: 'PUT',
        body: JSON.stringify(problemData)
      });
    },
    setWinnerAnnouncement: async (action = 'set', seconds = 10, winnerTeamId = null, runnerUpTeamId = null) => {
      let url = `/admin/winner-announcement?action=${action}&seconds=${seconds}`;
      if (winnerTeamId) url += `&winner_team_id=${encodeURIComponent(winnerTeamId)}`;
      if (runnerUpTeamId) url += `&runner_up_team_id=${encodeURIComponent(runnerUpTeamId)}`;
      return request(url, {
        method: 'POST'
      });
    },
    resetEvent: async (confirmText = 'RESET') => {
      return request('/admin/reset-event', {
        method: 'POST',
        body: JSON.stringify({ confirm_text: confirmText })
      });
    },
    getWinnerAnnouncement: async () => {
      return request('/admin/winner-announcement');
    }
  },
  winner: {
    get: async () => {
      return request('/leaderboard/winner-announcement');
    }
  },
  leaderboard: {
    get: async () => {
      return request('/leaderboard');
    },
    updateSettings: async (settingsData) => {
      return request('/leaderboard/settings', {
        method: 'POST',
        body: JSON.stringify(settingsData)
      });
    }
  }
};
