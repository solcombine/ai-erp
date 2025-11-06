import { useState, useEffect } from 'react';
import useAppStore from './store/appStore';
import { aiAPI, menuAPI, dataAPI, healthCheck } from './services/api';
import PromptInput from './components/PromptInput';
import DynamicGrid from './components/DynamicGrid';
import './App.css';

function App() {
  const {
    menus,
    activeMenu,
    currentData,
    currentSchema,
    loading,
    error,
    setMenus,
    addMenu,
    setActiveMenu,
    setCurrentData,
    addData,
    updateData,
    deleteData,
    addBulkData,
    setLoading,
    setError,
    clearError
  } = useAppStore();
  
  const [serverStatus, setServerStatus] = useState('checking');
  
  // 서버 상태 체크
  useEffect(() => {
    checkServerHealth();
  }, []);
  
  // 메뉴 목록 로드
  useEffect(() => {
    loadMenus();
  }, []);
  
  const checkServerHealth = async () => {
    try {
      const response = await healthCheck();
      setServerStatus('connected');
      console.log('✅ Server connected:', response.data);
    } catch (error) {
      setServerStatus('error');
      console.error('❌ Server connection failed:', error);
    }
  };
  
  const loadMenus = async () => {
    try {
      const response = await menuAPI.getAll();
      setMenus(response.data);
    } catch (error) {
      console.error('Failed to load menus:', error);
    }
  };
  
  // 프롬프트 제출 (스마트 처리)
  const handlePromptSubmit = async (prompt) => {
    setLoading(true);
    clearError();
    
    try {
      // 활성 메뉴가 있으면 데이터 추가 (화면 생성 제외)
      if (activeMenu) {
        // 화면 생성 키워드 감지
        const createScreenKeywords = ['화면 만들어', '화면 생성', '화면 추가', 'screen create'];
        const isCreateScreen = createScreenKeywords.some(keyword => 
          prompt.toLowerCase().includes(keyword)
        );
        
        if (isCreateScreen) {
          alert('💡 새 화면을 만들려면 사이드바에서 메뉴 선택을 해제하세요!\n(빈 공간 클릭)');
          return;
        }
        
                  // 데이터 추가 또는 스키마 수정
                  console.log('💬 Processing prompt for menu:', activeMenu.id);
                  
                  const result = await aiAPI.parseText(prompt, activeMenu.id);
                  const responseData = result.data;
                  
                  // 스키마 수정인 경우
                  if (responseData.type === 'schema_modification') {
                    console.log(`🔧 Schema modified: ${responseData.action}`);
                    
                    // 메뉴 업데이트
                    const updatedMenu = { ...activeMenu, schema: responseData.schema };
                    
                    // 상태 업데이트
                    const menus = useAppStore.getState().menus;
                    const updatedMenus = menus.map(m => 
                      m.id === activeMenu.id ? updatedMenu : m
                    );
                    useAppStore.setState({ menus: updatedMenus });
                    setActiveMenu(updatedMenu);
                    
                    alert(`✅ 스키마가 수정되었습니다! (${responseData.action})`);
                    return;
                  }
                  
                  // 데이터 파싱인 경우
                  const { data, confidence, missing } = responseData;
                  
                  console.log(`✅ Data parsed (confidence: ${confidence})`);
                  
                  if (confidence < 0.7) {
                    if (!confirm(`신뢰도가 낮습니다 (${Math.round(confidence * 100)}%). 계속하시겠습니까?`)) {
                      return;
                    }
                  }
                  
                  // 데이터 저장
                  const response = await dataAPI.create(activeMenu.id, data);
                  addData(response.data);
                  
                  if (missing && missing.length > 0) {
                    alert(`데이터가 추가되었습니다!\n누락된 필드: ${missing.join(', ')}`);
                  } else {
                    alert('데이터가 추가되었습니다! ✅');
                  }
        
      } else {
        // 새 화면 생성 모드
        console.log('🤖 Generating schema from prompt:', prompt);
        
        // 1. AI로 스키마 생성
        const schemaResponse = await aiAPI.generateSchema(prompt);
        const schema = schemaResponse.data;
        
        console.log('✅ Schema generated:', schema);
        
        // 2. 메뉴 생성
        const menuResponse = await menuAPI.create(schema);
        const menu = menuResponse.data;
        
        console.log('✅ Menu created:', menu);
        
        // 3. 상태 업데이트
        addMenu(menu);
        setActiveMenu(menu);
        setCurrentData([]);
        
        alert(`"${menu.name}" 화면이 생성되었습니다! 🎉`);
      }
      
    } catch (error) {
      console.error('❌ Failed:', error);
      setError(error.message);
      alert('처리 실패: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // 파일 업로드
  const handleFileUpload = async (file) => {
    if (!activeMenu) {
      alert('먼저 화면을 생성해주세요!');
      return;
    }
    
    setLoading(true);
    clearError();
    
    try {
      console.log('📄 Uploading file:', file.name);
      
      const response = await aiAPI.parseFile(file, activeMenu.id);
      const { inserted, failed, results } = response.data;
      
      console.log(`✅ File parsed: ${inserted} inserted, ${failed} failed`);
      
      // 성공한 데이터만 추가
      if (results.success.length > 0) {
        addBulkData(results.success);
      }
      
      // 실패한 데이터가 있으면 경고
      if (results.failed.length > 0) {
        alert(`${inserted}개 성공, ${failed}개 실패\n실패한 항목을 확인해주세요.`);
      } else {
        alert(`${inserted}개 항목이 추가되었습니다! 🎉`);
      }
      
      // 데이터 새로고침
      await loadCurrentData();
      
    } catch (error) {
      console.error('❌ Failed to upload file:', error);
      setError(error.message);
      alert('파일 업로드 실패: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // 메뉴 선택
  const handleMenuSelect = async (menu) => {
    setActiveMenu(menu);
    await loadCurrentData(menu.id);
  };
  
  // 현재 메뉴의 데이터 로드
  const loadCurrentData = async (menuId = activeMenu?.id) => {
    if (!menuId) return;
    
    try {
      const response = await dataAPI.query(menuId);
      setCurrentData(response.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };
  
  // 데이터 추가
  const handleAddData = async (rowData) => {
    try {
      const response = await dataAPI.create(activeMenu.id, rowData);
      addData(response.data);
      alert('추가되었습니다! ✅');
    } catch (error) {
      alert('추가 실패: ' + error.message);
    }
  };
  
  // 데이터 수정
  const handleEditData = async (id, updates) => {
    try {
      const response = await dataAPI.update(activeMenu.id, id, updates);
      updateData(id, response.data);
      alert('수정되었습니다! ✅');
    } catch (error) {
      alert('수정 실패: ' + error.message);
    }
  };
  
  // 데이터 삭제
  const handleDeleteData = async (id) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    try {
      await dataAPI.delete(activeMenu.id, id);
      deleteData(id);
      alert('삭제되었습니다! ✅');
    } catch (error) {
      alert('삭제 실패: ' + error.message);
    }
  };
  
  // 메뉴 삭제
  const handleDeleteMenu = async (menuId) => {
    if (!confirm('메뉴와 모든 데이터가 삭제됩니다. 계속하시겠습니까?')) return;
    
    try {
      await menuAPI.delete(menuId);
      await loadMenus();
      if (activeMenu?.id === menuId) {
        setActiveMenu(null);
        setCurrentData([]);
      }
      alert('메뉴가 삭제되었습니다! ✅');
    } catch (error) {
      alert('삭제 실패: ' + error.message);
    }
  };
  
  return (
    <div className="app">
      {/* 헤더 */}
      <header className="app-header">
        <div className="header-content">
          <h1>🤖 AI-ERP</h1>
          <div className="header-status">
            <span className={`status-indicator ${serverStatus}`}>
              {serverStatus === 'connected' ? '🟢 연결됨' : 
               serverStatus === 'error' ? '🔴 연결 실패' : 
               '🟡 연결 중...'}
            </span>
          </div>
        </div>
      </header>
      
      <div className="app-container">
        {/* 사이드바 */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>📋 메뉴</h2>
            <span className="menu-count">{menus.length}개</span>
          </div>
          
          {/* 새 화면 만들기 버튼 */}
          <button 
            className="new-menu-button"
            onClick={() => setActiveMenu(null)}
            title="새 화면을 만들려면 클릭하세요"
          >
            ➕ 새 화면 만들기
          </button>
          
          <div className="menu-list">
            {menus.length === 0 ? (
              <div className="empty-menu">
                <p>아직 메뉴가 없습니다</p>
                <p>👉 프롬프트를 입력하여<br/>새 화면을 만들어보세요!</p>
              </div>
            ) : (
              menus.map(menu => (
                <div
                  key={menu.id}
                  className={`menu-item ${activeMenu?.id === menu.id ? 'active' : ''}`}
                  onClick={() => handleMenuSelect(menu)}
                >
                  <div className="menu-info">
                    <span className="menu-name">{menu.name}</span>
                    <span className="menu-desc">{menu.description}</span>
                  </div>
                  <button
                    className="menu-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteMenu(menu.id);
                    }}
                    title="메뉴 삭제"
                  >
                    🗑️
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>
        
        {/* 메인 컨텐츠 */}
        <main className="main-content">
          {/* 프롬프트 입력 */}
          <PromptInput
            onSubmit={handlePromptSubmit}
            onFileUpload={activeMenu ? handleFileUpload : null}
            disabled={loading}
            placeholder={
              activeMenu 
                ? "💬 자유롭게 입력하세요! 데이터 추가, 질문, 분석 등 (예: 홍길동, hong@company.com 또는 데이터 요약해줘)" 
                : "✨ 무엇을 만들까요? (예: 사용자 등록 화면 만들어줘)"
            }
          />
          
          {/* 에러 메시지 */}
          {error && (
            <div className="error-message">
              ❌ {error}
              <button onClick={clearError}>✕</button>
            </div>
          )}
          
          {/* 로딩 */}
          {loading && (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
              <p>AI가 작업 중입니다...</p>
            </div>
          )}
          
          {/* 그리드 */}
          {activeMenu && currentSchema ? (
            <DynamicGrid
              schema={currentSchema}
              data={currentData}
              onAdd={handleAddData}
              onEdit={handleEditData}
              onDelete={handleDeleteData}
            />
          ) : (
            <div className="welcome-screen">
              <div className="welcome-content">
                <h2>👋 AI-ERP에 오신 것을 환영합니다!</h2>
                <p>자연어로 원하는 화면을 만들어보세요</p>
                
                <div className="examples">
                  <h3>💡 예시:</h3>
                  <div className="example-cards">
                    <div className="example-card" onClick={() => handlePromptSubmit('사용자 등록 화면 만들어줘')}>
                      <span className="example-icon">👤</span>
                      <span className="example-text">사용자 등록 화면</span>
                    </div>
                    <div className="example-card" onClick={() => handlePromptSubmit('제품 재고 관리 화면 만들어줘')}>
                      <span className="example-icon">📦</span>
                      <span className="example-text">제품 재고 관리</span>
                    </div>
                    <div className="example-card" onClick={() => handlePromptSubmit('주문 관리 화면 만들어줘')}>
                      <span className="example-icon">🛒</span>
                      <span className="example-text">주문 관리</span>
                    </div>
                    <div className="example-card" onClick={() => handlePromptSubmit('고객 문의 관리 화면 만들어줘')}>
                      <span className="example-icon">💬</span>
                      <span className="example-text">고객 문의 관리</span>
                    </div>
                  </div>
                </div>
                
                <div className="features">
                  <h3>✨ 주요 기능:</h3>
                  <ul>
                    <li>🤖 AI가 자동으로 화면과 데이터 구조 생성</li>
                    <li>📊 엑셀 파일 드래그 앤 드롭으로 데이터 입력</li>
                    <li>✏️ 실시간 데이터 편집 및 관리</li>
                    <li>🔍 검색, 정렬, 필터링 기능</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
