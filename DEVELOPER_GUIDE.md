# 🛠️ AI-ERP 개발자 가이드

## 📋 목차

1. [아키텍처 개요](#아키텍처-개요)
2. [데이터 저장 방식](#데이터-저장-방식)
3. [AI 통합](#ai-통합)
4. [API 설계](#api-설계)
5. [프론트엔드 구조](#프론트엔드-구조)
6. [확장 가이드](#확장-가이드)

## 아키텍처 개요

### 전체 구조

```
┌─────────────────────────────────────────┐
│         Frontend (React + Vite)         │
│  - PromptInput: AI 프롬프트 입력        │
│  - DynamicGrid: 동적 데이터 그리드      │
│  - Zustand: 전역 상태 관리              │
└─────────────────┬───────────────────────┘
                  │ HTTP/REST
┌─────────────────▼───────────────────────┐
│      Backend (Node.js + Express)        │
│  ┌─────────────────────────────────┐   │
│  │  Routes Layer                    │   │
│  │  - menu.routes.js                │   │
│  │  - data.routes.js                │   │
│  │  - ai.routes.js                  │   │
│  └─────────────┬───────────────────┘   │
│                │                         │
│  ┌─────────────▼───────────────────┐   │
│  │  Services Layer                  │   │
│  │  - aiService.js (AI 통합)       │   │
│  │  - dataStore.js (데이터 관리)   │   │
│  └─────────────┬───────────────────┘   │
└────────────────┼───────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
┌───▼───┐  ┌────▼────┐  ┌───▼────┐
│Gemini │  │ OpenAI  │  │ Claude │
│ API   │  │   API   │  │  API   │
└───────┘  └─────────┘  └────────┘
```

## 데이터 저장 방식

### In-Memory + File Persistence

**선택 이유:**
- ✅ 빠른 프로토타이핑
- ✅ DB 설정 불필요
- ✅ 나중에 DB로 쉽게 전환
- ✅ 개발 환경 간단

**구조:**

```javascript
// dataStore.js
class DataStore {
  constructor() {
    this.menus = new Map();    // menuId -> menu metadata
    this.data = new Map();     // menuId -> rows[]
    this.schemas = new Map();  // menuId -> schema
    this.dirty = new Set();    // 변경된 menuId 추적
  }
}
```

**파일 구조:**

```
data/
  ├── user_registration.json
  │   {
  │     "menu": { ... },
  │     "schema": { ... },
  │     "data": [ ... ]
  │   }
  ├── product_management.json
  └── order_management.json
```

**영속성 전략:**

1. **자동 저장**: 1분마다 변경된 메뉴만 저장
2. **Graceful Shutdown**: 프로세스 종료 시 자동 저장
3. **Dirty Tracking**: 변경된 데이터만 저장 (효율성)

### PostgreSQL로 전환하기

나중에 확장이 필요하면:

```javascript
// dataStore.js 수정
class PostgresDataStore {
  async insert(menuId, rowData) {
    return await db.query(`
      INSERT INTO app_data (menu_id, data)
      VALUES ($1, $2)
      RETURNING *
    `, [menuId, JSON.stringify(rowData)]);
  }
  
  async query(menuId, filters) {
    return await db.query(`
      SELECT * FROM app_data
      WHERE menu_id = $1
      AND data @> $2
    `, [menuId, JSON.stringify(filters)]);
  }
}
```

## AI 통합

### 하이브리드 전략

```javascript
// aiService.js
class AIService {
  async generateSchema(prompt) {
    // 환경변수로 AI 선택
    switch(this.defaultAI) {
      case 'gemini':   return this.generateWithGemini(prompt);
      case 'openai':   return this.generateWithOpenAI(prompt);
      case 'claude':   return this.generateWithClaude(prompt);
    }
  }
}
```

### 비용 최적화

**1. 규칙 기반 우선 처리**

```javascript
// 컬럼 매칭: 규칙 기반 → AI (필요시만)
async matchColumns(sourceColumns, schema) {
  // 1단계: 규칙 기반 (무료!)
  const ruleMatches = this.ruleBasedMatching(sourceColumns, schema);
  
  // 2단계: 매칭 안 된 것만 AI (비용 절감!)
  const unmatched = sourceColumns.filter(c => !ruleMatches.includes(c));
  if (unmatched.length > 0) {
    const aiMatches = await this.aiMatching(unmatched, schema);
    return [...ruleMatches, ...aiMatches];
  }
  
  return ruleMatches;
}
```

**2. 동의어 사전 활용**

```javascript
const synonyms = {
  'name': ['이름', '성명', '사용자명', 'username'],
  'email': ['이메일', '메일', 'e-mail'],
  'phone': ['전화', '전화번호', 'tel', 'mobile']
};
```

**3. 캐싱**

```javascript
const schemaCache = new Map();

async function getOrCreateSchema(prompt) {
  const cacheKey = hashPrompt(prompt);
  if (schemaCache.has(cacheKey)) {
    return schemaCache.get(cacheKey);
  }
  
  const schema = await aiService.generateSchema(prompt);
  schemaCache.set(cacheKey, schema);
  return schema;
}
```

### AI 프롬프트 설계

**스키마 생성 프롬프트:**

```javascript
const systemPrompt = `당신은 ERP 시스템의 데이터베이스 스키마를 생성하는 전문가입니다.
사용자의 요청을 분석하여 적절한 테이블 구조를 생성하세요.

응답은 반드시 다음 JSON 형식으로만 반환하세요:
{
  "menuId": "snake_case_menu_id",
  "menuName": "사용자가 이해할 수 있는 메뉴 이름",
  "tableName": "snake_case_table_name",
  "description": "이 화면의 목적 설명",
  "columns": [
    {
      "name": "column_name",
      "type": "string|number|email|phone|date|select|textarea",
      "label": "사용자에게 보여질 한글 라벨",
      "required": true,
      "placeholder": "입력 힌트",
      "options": ["option1", "option2"]
    }
  ]
}`;
```

**데이터 파싱 프롬프트:**

```javascript
const systemPrompt = `다음 스키마에 맞게 텍스트에서 정보를 추출하세요.
스키마: ${JSON.stringify(schema.columns)}

응답은 반드시 다음 JSON 형식으로만 반환하세요:
{
  "data": {
    "column_name": "extracted_value"
  },
  "confidence": 0.95,
  "missing": ["missing_field1"]
}`;
```

## API 설계

### RESTful 원칙

```
GET    /api/menus              # 모든 메뉴 조회
GET    /api/menus/:menuId      # 특정 메뉴 조회
POST   /api/menus              # 메뉴 생성
DELETE /api/menus/:menuId      # 메뉴 삭제

GET    /api/data/:menuId       # 데이터 조회
POST   /api/data/:menuId       # 데이터 생성
PUT    /api/data/:menuId/:id   # 데이터 수정
DELETE /api/data/:menuId/:id   # 데이터 삭제

POST   /api/ai/generate-schema # AI 스키마 생성
POST   /api/ai/parse-text      # 텍스트 파싱
POST   /api/ai/parse-file      # 파일 파싱
```

### 응답 형식

**성공:**
```json
{
  "success": true,
  "data": { ... }
}
```

**에러:**
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "stack": "..." // 개발 환경에서만
  }
}
```

### 에러 처리

```javascript
// errorHandler.js
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

// 비동기 래퍼
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

## 프론트엔드 구조

### 상태 관리 (Zustand)

```javascript
// appStore.js
const useAppStore = create((set) => ({
  // State
  menus: [],
  activeMenu: null,
  currentData: [],
  
  // Actions
  setMenus: (menus) => set({ menus }),
  addMenu: (menu) => set((state) => ({
    menus: [...state.menus, menu]
  })),
  setActiveMenu: (menu) => set({ activeMenu: menu })
}));
```

### 컴포넌트 구조

**PromptInput.jsx**
- 자연어 입력
- 파일 드래그 앤 드롭
- Ctrl/Cmd + Enter 제출

**DynamicGrid.jsx**
- 동적 컬럼 렌더링
- 인라인 편집
- 검색, 정렬, 필터링

### API 클라이언트

```javascript
// api.js
const api = axios.create({
  baseURL: 'http://localhost:3001/api'
});

// 응답 인터셉터
api.interceptors.response.use(
  response => response.data,
  error => {
    const message = error.response?.data?.error?.message || error.message;
    throw new Error(message);
  }
);
```

## 확장 가이드

### 새 AI 모델 추가

```javascript
// aiService.js
async generateWithNewAI(system, user) {
  const response = await newAIClient.generate({
    prompt: `${system}\n\n${user}`
  });
  return JSON.parse(response.text);
}

// .env
DEFAULT_AI=newai
NEWAI_API_KEY=your_key
```

### 새 필드 타입 추가

```javascript
// DynamicGrid.jsx
const renderInput = (column, value, onChange) => {
  switch (column.type) {
    case 'color':
      return <input type="color" value={value} onChange={onChange} />;
    case 'file':
      return <input type="file" onChange={onChange} />;
    // ... 기존 타입들
  }
};
```

### 관계형 데이터 지원

```javascript
// schema에 relation 추가
{
  name: "customer_id",
  type: "relation",
  label: "고객",
  relation: {
    targetMenu: "customer_management",
    displayField: "name"
  }
}

// DynamicGrid에서 드롭다운 렌더링
if (column.type === 'relation') {
  const options = await dataAPI.query(column.relation.targetMenu);
  return (
    <select>
      {options.map(opt => (
        <option value={opt.id}>
          {opt[column.relation.displayField]}
        </option>
      ))}
    </select>
  );
}
```

### 워크플로우 추가

```javascript
// workflow.js
class WorkflowEngine {
  async executeWorkflow(menuId, trigger, data) {
    const workflows = await this.getWorkflows(menuId);
    
    for (const workflow of workflows) {
      if (workflow.trigger === trigger) {
        await this.runActions(workflow.actions, data);
      }
    }
  }
  
  async runActions(actions, data) {
    for (const action of actions) {
      switch (action.type) {
        case 'send_email':
          await emailService.send(action.config, data);
          break;
        case 'create_record':
          await dataStore.insert(action.menuId, data);
          break;
        case 'call_api':
          await axios.post(action.url, data);
          break;
      }
    }
  }
}
```

### 권한 관리

```javascript
// auth.middleware.js
export const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const user = verifyToken(token);
  req.user = user;
  next();
};

export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};

// 사용
router.post('/data/:menuId', 
  requireAuth, 
  requirePermission('data.create'), 
  asyncHandler(async (req, res) => {
    // ...
  })
);
```

## 성능 최적화

### 1. 메모리 최적화

```javascript
// 대용량 데이터는 페이지네이션
router.get('/data/:menuId', asyncHandler(async (req, res) => {
  const { page = 1, limit = 100 } = req.query;
  const offset = (page - 1) * limit;
  
  const allData = dataStore.query(menuId);
  const paginatedData = allData.slice(offset, offset + limit);
  
  res.json({
    success: true,
    data: paginatedData,
    pagination: {
      page,
      limit,
      total: allData.length,
      totalPages: Math.ceil(allData.length / limit)
    }
  });
}));
```

### 2. 캐싱 전략

```javascript
// Redis 캐싱 (선택사항)
import Redis from 'ioredis';
const redis = new Redis();

async function getCachedData(key, fetchFn, ttl = 300) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  
  const data = await fetchFn();
  await redis.setex(key, ttl, JSON.stringify(data));
  return data;
}
```

### 3. 배치 처리

```javascript
// 대량 데이터 처리
async function processBulkData(rows) {
  const BATCH_SIZE = 100;
  const results = [];
  
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(row => processRow(row))
    );
    results.push(...batchResults);
  }
  
  return results;
}
```

## 테스트

### 단위 테스트

```javascript
// aiService.test.js
import { describe, it, expect } from 'vitest';
import aiService from './aiService';

describe('AIService', () => {
  it('should generate schema from prompt', async () => {
    const schema = await aiService.generateSchema('사용자 등록 화면');
    
    expect(schema).toHaveProperty('menuName');
    expect(schema).toHaveProperty('columns');
    expect(schema.columns).toBeInstanceOf(Array);
  });
  
  it('should match columns correctly', async () => {
    const matches = await aiService.matchColumns(
      ['이름', '이메일'],
      { columns: [{ name: 'name' }, { name: 'email' }] }
    );
    
    expect(matches).toHaveLength(2);
  });
});
```

### 통합 테스트

```javascript
// api.test.js
import request from 'supertest';
import app from './server';

describe('API Integration', () => {
  it('should create menu and add data', async () => {
    // 1. 스키마 생성
    const schemaRes = await request(app)
      .post('/api/ai/generate-schema')
      .send({ prompt: '테스트 화면' });
    
    expect(schemaRes.status).toBe(200);
    
    // 2. 메뉴 생성
    const menuRes = await request(app)
      .post('/api/menus')
      .send(schemaRes.body.data);
    
    expect(menuRes.status).toBe(201);
    
    // 3. 데이터 추가
    const dataRes = await request(app)
      .post(`/api/data/${menuRes.body.data.id}`)
      .send({ name: '테스트' });
    
    expect(dataRes.status).toBe(201);
  });
});
```

---

**Happy Coding! 🚀**

