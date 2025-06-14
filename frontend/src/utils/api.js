// API utility for making HTTP requests
import { loadConfig } from './config.js';
import { showWarning } from './snackbar.js';

let apiConfig = null;

async function getApiConfig() {
  if (!apiConfig) {
    const config = await loadConfig();
    apiConfig = config.api;
  }
  return apiConfig;
}

function getAuthToken() {
  return localStorage.getItem('authToken');
}

function setAuthToken(token) {
  localStorage.setItem('authToken', token);
}

function removeAuthToken() {
  localStorage.removeItem('authToken');
}

async function makeRequest(endpoint, options = {}) {
  const config = await getApiConfig();
  const url = `${config.baseUrl}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: config.timeout
  };
  
  // Add auth token if available
  const token = getAuthToken();
  if (token) {
    defaultOptions.headers.Authorization = `Bearer ${token}`;
  }
  
  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  };
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), finalOptions.timeout);
    
    const response = await fetch(url, {
      ...finalOptions,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      let errorData = {};
      try {
        errorData = await response.json();
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError);
      }
      
      // Handle authentication errors specifically
      if (response.status === 401 || response.status === 403) {
        // Only redirect if we're not on the login page
        if (!window.location.pathname.includes('/login') && !window.location.pathname === '/') {
          removeAuthToken();
          showWarning('Your session has expired. Please login again.');
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        }
        throw new Error(errorData.message || 'Authentication failed');
      }
      
      // Handle validation errors (400)
      if (response.status === 400) {
        throw new Error(errorData.message || 'Invalid request data');
      }
      
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return null;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    
    // Handle authentication errors
    if (error.message.includes('401') || error.message.includes('Unauthorized') || 
        error.message.includes('jwt expired') || error.message.includes('Session expired')) {
      removeAuthToken();
      showWarning('Your session has expired. Please login again.');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
      return;
    }
    
    throw error;
  }
}

// API methods
const api = {
  // Authentication
  async login(credentials) {
    const response = await makeRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    
    if (response.token) {
      setAuthToken(response.token);
    }
    
    return response;
  },
  
  async logout() {
    try {
      await makeRequest('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      removeAuthToken();
    }
  },
  
  // Dashboard
  async getDashboardSummary() {
    return makeRequest('/dashboard/summary');
  },
  
  async getTopSoldModels() {
    return makeRequest('/dashboard/top-sold-models');
  },
  
  // Cars
  async getCars(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return makeRequest(`/cars${queryString ? `?${queryString}` : ''}`);
  },
  
  async getCar(id) {
    return makeRequest(`/cars/${id}`);
  },
  
  async createCar(carData) {
    return makeRequest('/cars', {
      method: 'POST',
      body: JSON.stringify(carData)
    });
  },
  
  async updateCar(id, carData) {
    return makeRequest(`/cars/${id}`, {
      method: 'PUT',
      body: JSON.stringify(carData)
    });
  },
  
  async deleteCar(id) {
    return makeRequest(`/cars/${id}`, {
      method: 'DELETE'
    });
  },
  
  // Maintenance
  async getMaintenanceRecords(carId) {
    return makeRequest(`/maintenance/car/${carId}`);
  },
  
  async getAllMaintenanceRecords() {
    return makeRequest('/maintenance');
  },
  
  async getMaintenanceRecord(id) {
    return makeRequest(`/maintenance/${id}`);
  },
  
  async createMaintenanceRecord(maintenanceData) {
    return makeRequest('/maintenance', {
      method: 'POST',
      body: JSON.stringify(maintenanceData)
    });
  },
  
  async updateMaintenanceRecord(id, maintenanceData) {
    return makeRequest(`/maintenance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(maintenanceData)
    });
  },
  
  async deleteMaintenanceRecord(id) {
    return makeRequest(`/maintenance/${id}`, {
      method: 'DELETE'
    });
  },
  
  async getMaintenanceCategories() {
    return makeRequest('/maintenance/categories');
  },
  
  // Reports
  async getInventoryReport(dateRange = {}) {
    const params = new URLSearchParams();
    if (dateRange.start) params.append('start_date', dateRange.start);
    if (dateRange.end) params.append('end_date', dateRange.end);
    return makeRequest(`/reports/inventory${params.toString() ? `?${params.toString()}` : ''}`);
  },
  
  async getSalesReport(dateRange = {}) {
    const params = new URLSearchParams();
    if (dateRange.start) params.append('start_date', dateRange.start);
    if (dateRange.end) params.append('end_date', dateRange.end);
    return makeRequest(`/reports/sales${params.toString() ? `?${params.toString()}` : ''}`);
  },
  
  async getMaintenanceReport(dateRange = {}) {
    const params = new URLSearchParams();
    if (dateRange.start) params.append('start_date', dateRange.start);
    if (dateRange.end) params.append('end_date', dateRange.end);
    return makeRequest(`/reports/maintenance${params.toString() ? `?${params.toString()}` : ''}`);
  },
  
  async getProfitReport(dateRange = {}) {
    const params = new URLSearchParams();
    if (dateRange.start) params.append('start_date', dateRange.start);
    if (dateRange.end) params.append('end_date', dateRange.end);
    return makeRequest(`/reports/profit${params.toString() ? `?${params.toString()}` : ''}`);
  }
};

export { api, getAuthToken, setAuthToken, removeAuthToken }; 