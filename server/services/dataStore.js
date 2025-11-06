import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DataStore {
  constructor() {
    this.menus = new Map(); // menuId -> menu metadata
    this.data = new Map();  // menuId -> rows[]
    this.schemas = new Map(); // menuId -> schema
    this.dirty = new Set(); // 변경된 menuId 추적
    
    this.dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
    this.persistInterval = parseInt(process.env.PERSIST_INTERVAL) || 60000; // 1분
    
    // 주기적 저장
    this.startAutoPersist();
  }
  
  // ============ 메뉴 관리 ============
  
  /**
   * 새 메뉴 생성
   */
  createMenu(menuData) {
    const menuId = menuData.menuId || this.generateMenuId(menuData.menuName);
    
    const menu = {
      id: menuId,
      name: menuData.menuName,
      tableName: menuData.tableName,
      description: menuData.description,
      schema: menuData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.menus.set(menuId, menu);
    this.schemas.set(menuId, menuData);
    this.data.set(menuId, []);
    this.dirty.add(menuId);
    
    console.log(`✅ Menu created: ${menuId}`);
    return menu;
  }
  
  /**
   * 메뉴 조회
   */
  getMenu(menuId) {
    return this.menus.get(menuId);
  }
  
  /**
   * 모든 메뉴 조회
   */
  getAllMenus() {
    return Array.from(this.menus.values());
  }
  
  /**
   * 메뉴 삭제
   */
  deleteMenu(menuId) {
    this.menus.delete(menuId);
    this.schemas.delete(menuId);
    this.data.delete(menuId);
    this.dirty.add(menuId);
    
    console.log(`🗑️  Menu deleted: ${menuId}`);
    return true;
  }
  
  /**
   * 메뉴 스키마 조회
   */
  getSchema(menuId) {
    return this.schemas.get(menuId);
  }
  
  // ============ 데이터 CRUD ============
  
  /**
   * 데이터 생성
   */
  insert(menuId, rowData) {
    if (!this.data.has(menuId)) {
      throw new Error(`Menu not found: ${menuId}`);
    }
    
    const schema = this.schemas.get(menuId);
    const rows = this.data.get(menuId);
    
    // 자동 생성 필드 처리
    const row = {
      id: rowData.id || uuidv4(),
      ...rowData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // 유효성 검증
    this.validateRow(row, schema);
    
    rows.push(row);
    this.dirty.add(menuId);
    
    console.log(`✅ Data inserted: ${menuId} (${row.id})`);
    return row;
  }
  
  /**
   * 데이터 조회 (필터링 지원)
   */
  query(menuId, filters = {}) {
    if (!this.data.has(menuId)) {
      throw new Error(`Menu not found: ${menuId}`);
    }
    
    let rows = this.data.get(menuId);
    
    // 필터 적용
    if (Object.keys(filters).length > 0) {
      rows = rows.filter(row => {
        return Object.entries(filters).every(([key, value]) => {
          // 부분 일치 검색 (문자열)
          if (typeof value === 'string' && typeof row[key] === 'string') {
            return row[key].toLowerCase().includes(value.toLowerCase());
          }
          // 정확히 일치
          return row[key] === value;
        });
      });
    }
    
    return rows;
  }
  
  /**
   * 단일 데이터 조회
   */
  findById(menuId, id) {
    const rows = this.query(menuId);
    return rows.find(row => row.id === id);
  }
  
  /**
   * 데이터 수정
   */
  update(menuId, id, updates) {
    if (!this.data.has(menuId)) {
      throw new Error(`Menu not found: ${menuId}`);
    }
    
    const rows = this.data.get(menuId);
    const index = rows.findIndex(row => row.id === id);
    
    if (index === -1) {
      throw new Error(`Row not found: ${id}`);
    }
    
    const schema = this.schemas.get(menuId);
    
    // 수정된 데이터
    const updatedRow = {
      ...rows[index],
      ...updates,
      id: rows[index].id, // ID는 변경 불가
      createdAt: rows[index].createdAt, // 생성일시는 변경 불가
      updatedAt: new Date().toISOString()
    };
    
    // 유효성 검증
    this.validateRow(updatedRow, schema);
    
    rows[index] = updatedRow;
    this.dirty.add(menuId);
    
    console.log(`✅ Data updated: ${menuId} (${id})`);
    return updatedRow;
  }
  
  /**
   * 데이터 삭제
   */
  delete(menuId, id) {
    if (!this.data.has(menuId)) {
      throw new Error(`Menu not found: ${menuId}`);
    }
    
    const rows = this.data.get(menuId);
    const index = rows.findIndex(row => row.id === id);
    
    if (index === -1) {
      throw new Error(`Row not found: ${id}`);
    }
    
    rows.splice(index, 1);
    this.dirty.add(menuId);
    
    console.log(`🗑️  Data deleted: ${menuId} (${id})`);
    return true;
  }
  
  /**
   * 대량 데이터 삽입
   */
  bulkInsert(menuId, rowsData) {
    const results = {
      success: [],
      failed: []
    };
    
    for (const rowData of rowsData) {
      try {
        const row = this.insert(menuId, rowData);
        results.success.push(row);
      } catch (error) {
        results.failed.push({
          data: rowData,
          error: error.message
        });
      }
    }
    
    console.log(`✅ Bulk insert: ${results.success.length} success, ${results.failed.length} failed`);
    return results;
  }
  
  // ============ 유효성 검증 ============
  
  validateRow(row, schema) {
    for (const column of schema.columns) {
      const value = row[column.name];
      
      // 필수 필드 검증 (유연하게 처리)
      // generated 필드가 아니고, 명시적으로 required가 true이고, 값이 완전히 없는 경우만 에러
      // 단, 빈 문자열('')은 허용 (null로 저장됨)
      if (column.required && !column.generated && value === undefined) {
        // undefined만 에러, null이나 빈 문자열은 허용
        console.log(`⚠️  Warning: Required field missing, setting to null: ${column.label || column.name}`);
        row[column.name] = null; // 자동으로 null 설정
      }
      
      // 빈 문자열은 null로 변환
      if (value === '') {
        row[column.name] = null;
      }
      
      // 타입 검증 (null이 아닌 경우만)
      const actualValue = row[column.name];
      if (actualValue !== undefined && actualValue !== null) {
        switch (column.type) {
          case 'number':
            if (isNaN(actualValue)) {
              console.log(`⚠️  Warning: Invalid number for ${column.label || column.name}, setting to null`);
              row[column.name] = null;
            }
            break;
          case 'email':
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(actualValue)) {
              console.log(`⚠️  Warning: Invalid email for ${column.label || column.name}: ${actualValue}`);
              // 이메일 형식이 아니어도 저장 (경고만)
            }
            break;
          case 'phone':
            if (!/^[0-9-+() ]+$/.test(actualValue)) {
              console.log(`⚠️  Warning: Invalid phone for ${column.label || column.name}: ${actualValue}`);
              // 전화번호 형식이 아니어도 저장 (경고만)
            }
            break;
          case 'select':
            // select 타입은 옵션에 없는 값이 들어와도 자동으로 추가 (유연한 처리)
            if (column.options && !column.options.includes(actualValue)) {
              console.log(`⚠️  New option added to ${column.name}: ${actualValue}`);
              column.options.push(actualValue);
            }
            break;
        }
        
        // 추가 검증 규칙 (경고만, 에러 발생 안 함)
        if (column.validation && actualValue !== null) {
          if (column.validation.min !== undefined && actualValue < column.validation.min) {
            console.log(`⚠️  Warning: Value too small for ${column.label || column.name}: ${actualValue} (min: ${column.validation.min})`);
          }
          if (column.validation.max !== undefined && actualValue > column.validation.max) {
            console.log(`⚠️  Warning: Value too large for ${column.label || column.name}: ${actualValue} (max: ${column.validation.max})`);
          }
          if (column.validation.pattern) {
            const regex = new RegExp(column.validation.pattern);
            if (!regex.test(actualValue)) {
              console.log(`⚠️  Warning: Invalid format for ${column.label || column.name}: ${actualValue}`);
            }
          }
        }
      }
    }
  }
  
  // ============ 영속성 관리 ============
  
  /**
   * 디스크에 저장
   */
  async persist() {
    if (this.dirty.size === 0) {
      return;
    }
    
    try {
      // 데이터 디렉토리 생성
      await fs.mkdir(this.dataDir, { recursive: true });
      
      // 변경된 메뉴만 저장
      for (const menuId of this.dirty) {
        const menuPath = path.join(this.dataDir, `${menuId}.json`);
        
        if (this.menus.has(menuId)) {
          const saveData = {
            menu: this.menus.get(menuId),
            schema: this.schemas.get(menuId),
            data: this.data.get(menuId)
          };
          
          await fs.writeFile(menuPath, JSON.stringify(saveData, null, 2), 'utf-8');
        } else {
          // 삭제된 메뉴는 파일도 삭제
          await fs.unlink(menuPath).catch(() => {});
        }
      }
      
      console.log(`💾 Persisted ${this.dirty.size} menu(s)`);
      this.dirty.clear();
      
    } catch (error) {
      console.error('❌ Persist failed:', error);
      throw error;
    }
  }
  
  /**
   * 디스크에서 로드
   */
  async load() {
    try {
      // 데이터 디렉토리 생성
      await fs.mkdir(this.dataDir, { recursive: true });
      
      const files = await fs.readdir(this.dataDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of jsonFiles) {
        const menuId = file.replace('.json', '');
        const filePath = path.join(this.dataDir, file);
        
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const saveData = JSON.parse(content);
          
          this.menus.set(menuId, saveData.menu);
          this.schemas.set(menuId, saveData.schema);
          this.data.set(menuId, saveData.data || []);
          
        } catch (error) {
          console.error(`⚠️  Failed to load ${file}:`, error.message);
        }
      }
      
      console.log(`📂 Loaded ${jsonFiles.length} menu(s) from disk`);
      
    } catch (error) {
      console.error('❌ Load failed:', error);
      throw error;
    }
  }
  
  /**
   * 자동 저장 시작
   */
  startAutoPersist() {
    this.persistTimer = setInterval(async () => {
      if (this.dirty.size > 0) {
        await this.persist().catch(err => {
          console.error('Auto-persist failed:', err);
        });
      }
    }, this.persistInterval);
    
    console.log(`⏰ Auto-persist enabled (interval: ${this.persistInterval}ms)`);
  }
  
  /**
   * 자동 저장 중지
   */
  stopAutoPersist() {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }
  }
  
  // ============ 유틸리티 ============
  
  generateMenuId(menuName) {
    // 한글 -> 영문 변환 (간단한 버전)
    const slug = menuName
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_가-힣]/g, '');
    
    // 중복 방지
    let menuId = slug;
    let counter = 1;
    while (this.menus.has(menuId)) {
      menuId = `${slug}_${counter}`;
      counter++;
    }
    
    return menuId;
  }
  
  /**
   * 통계 정보
   */
  getStats() {
    const stats = {
      totalMenus: this.menus.size,
      totalRows: 0,
      menus: []
    };
    
    for (const [menuId, menu] of this.menus.entries()) {
      const rows = this.data.get(menuId) || [];
      stats.totalRows += rows.length;
      stats.menus.push({
        id: menuId,
        name: menu.name,
        rowCount: rows.length
      });
    }
    
    return stats;
  }
}

export default new DataStore();

