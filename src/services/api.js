import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 응답 인터셉터 (에러 처리)
api.interceptors.response.use(
  response => response.data,
  error => {
    const message = error.response?.data?.error?.message || error.message;
    console.error('API Error:', message);
    throw new Error(message);
  }
);

// ============ AI API ============

export const aiAPI = {
  /**
   * 자연어 프롬프트로 스키마 생성
   */
  generateSchema: async (prompt) => {
    return api.post('/ai/generate-schema', { prompt });
  },
  
  /**
   * 비정형 텍스트 파싱
   */
  parseText: async (text, menuId) => {
    return api.post('/ai/parse-text', { text, menuId });
  },
  
  /**
   * 파일 업로드 및 파싱
   */
  parseFile: async (file, menuId) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('menuId', menuId);
    
    return api.post('/ai/parse-file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  
  /**
   * 컬럼 매칭
   */
  matchColumns: async (sourceColumns, menuId) => {
    return api.post('/ai/match-columns', { sourceColumns, menuId });
  }
};

// ============ 메뉴 API ============

export const menuAPI = {
  /**
   * 모든 메뉴 조회
   */
  getAll: async () => {
    return api.get('/menus');
  },
  
  /**
   * 특정 메뉴 조회
   */
  getById: async (menuId) => {
    return api.get(`/menus/${menuId}`);
  },
  
  /**
   * 메뉴 생성
   */
  create: async (menuData) => {
    return api.post('/menus', menuData);
  },
  
  /**
   * 메뉴 삭제
   */
  delete: async (menuId) => {
    return api.delete(`/menus/${menuId}`);
  },
  
  /**
   * 메뉴 스키마 조회
   */
  getSchema: async (menuId) => {
    return api.get(`/menus/${menuId}/schema`);
  },
  
  /**
   * 통계 조회
   */
  getStats: async () => {
    return api.get('/menus/system/stats');
  }
};

// ============ 데이터 API ============

export const dataAPI = {
  /**
   * 데이터 조회
   */
  query: async (menuId, filters = {}) => {
    return api.get(`/data/${menuId}`, { params: filters });
  },
  
  /**
   * 단일 데이터 조회
   */
  getById: async (menuId, id) => {
    return api.get(`/data/${menuId}/${id}`);
  },
  
  /**
   * 데이터 생성
   */
  create: async (menuId, rowData) => {
    return api.post(`/data/${menuId}`, rowData);
  },
  
  /**
   * 데이터 수정
   */
  update: async (menuId, id, updates) => {
    return api.put(`/data/${menuId}/${id}`, updates);
  },
  
  /**
   * 데이터 삭제
   */
  delete: async (menuId, id) => {
    return api.delete(`/data/${menuId}/${id}`);
  },
  
  /**
   * 대량 데이터 삽입
   */
  bulkInsert: async (menuId, rows) => {
    return api.post(`/data/${menuId}/bulk`, { rows });
  }
};

// ============ Health Check ============

export const healthCheck = async () => {
  return api.get('/health');
};

export default api;

