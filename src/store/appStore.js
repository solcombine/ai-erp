import { create } from 'zustand';

/**
 * 전역 상태 관리
 */
const useAppStore = create((set, get) => ({
  // 메뉴 목록
  menus: [],
  
  // 현재 활성 메뉴
  activeMenu: null,
  
  // 현재 메뉴의 데이터
  currentData: [],
  
  // 현재 메뉴의 스키마
  currentSchema: null,
  
  // 로딩 상태
  loading: false,
  
  // 에러 메시지
  error: null,
  
  // ============ Actions ============
  
  /**
   * 메뉴 목록 설정
   */
  setMenus: (menus) => set({ menus }),
  
  /**
   * 메뉴 추가
   */
  addMenu: (menu) => set((state) => ({
    menus: [...state.menus, menu]
  })),
  
  /**
   * 메뉴 삭제
   */
  removeMenu: (menuId) => set((state) => ({
    menus: state.menus.filter(m => m.id !== menuId),
    activeMenu: state.activeMenu?.id === menuId ? null : state.activeMenu
  })),
  
  /**
   * 활성 메뉴 설정
   */
  setActiveMenu: (menu) => set({ 
    activeMenu: menu,
    currentSchema: menu?.schema || null
  }),
  
  /**
   * 현재 데이터 설정
   */
  setCurrentData: (data) => set({ currentData: data }),
  
  /**
   * 데이터 추가
   */
  addData: (row) => set((state) => ({
    currentData: [...state.currentData, row]
  })),
  
  /**
   * 데이터 수정
   */
  updateData: (id, updates) => set((state) => ({
    currentData: state.currentData.map(row => 
      row.id === id ? { ...row, ...updates } : row
    )
  })),
  
  /**
   * 데이터 삭제
   */
  deleteData: (id) => set((state) => ({
    currentData: state.currentData.filter(row => row.id !== id)
  })),
  
  /**
   * 대량 데이터 추가
   */
  addBulkData: (rows) => set((state) => ({
    currentData: [...state.currentData, ...rows]
  })),
  
  /**
   * 스키마 설정
   */
  setCurrentSchema: (schema) => set({ currentSchema: schema }),
  
  /**
   * 로딩 상태 설정
   */
  setLoading: (loading) => set({ loading }),
  
  /**
   * 에러 설정
   */
  setError: (error) => set({ error }),
  
  /**
   * 에러 초기화
   */
  clearError: () => set({ error: null }),
  
  /**
   * 전체 초기화
   */
  reset: () => set({
    menus: [],
    activeMenu: null,
    currentData: [],
    currentSchema: null,
    loading: false,
    error: null
  })
}));

export default useAppStore;

