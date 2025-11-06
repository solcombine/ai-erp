# 🤖 AI-ERP

자연어로 만드는 차세대 ERP 시스템

## ✨ 주요 기능

### 🎯 핵심 컨셉
- **자연어 기반 화면 생성**: "사용자 등록 화면 만들어줘" 한 마디면 완성!
- **AI 자동 스키마 생성**: 필요한 필드를 AI가 자동으로 생성
- **스마트 데이터 입력**: 엑셀 파일 드래그 앤 드롭으로 자동 매칭
- **실시간 데이터 관리**: 검색, 정렬, 편집 기능 내장

### 🚀 기술 스택

**프론트엔드**
- React 18 + Vite
- Zustand (상태 관리)
- Axios (API 통신)

**백엔드**
- Node.js + Express
- In-Memory Store + JSON 파일 (영속성)
- Multer (파일 업로드)
- XLSX (엑셀 파싱)

**AI**
- Google Gemini 1.5 Flash (기본, 무료!)
- OpenAI GPT-4o-mini (옵션)
- Anthropic Claude 3.5 Sonnet (옵션)

## 📦 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
# Server
PORT=3001
NODE_ENV=development

# AI (하나만 설정하면 됩니다)
DEFAULT_AI=gemini
GEMINI_API_KEY=your_gemini_api_key_here

# 또는 OpenAI 사용 시
# DEFAULT_AI=openai
# OPENAI_API_KEY=your_openai_api_key_here

# Data
DATA_DIR=./data
PERSIST_INTERVAL=60000

# Frontend
VITE_API_URL=http://localhost:3001/api
```

### 3. 개발 서버 실행

```bash
npm run dev
```

- 프론트엔드: http://localhost:5173
- 백엔드: http://localhost:3001

### 4. 개별 실행 (선택사항)

```bash
# 프론트엔드만
npm run dev:client

# 백엔드만
npm run dev:server
```

## 🎮 사용 방법

### 1️⃣ 새 화면 만들기

프롬프트에 원하는 화면을 자연어로 입력하세요:

```
사용자 등록 화면 만들어줘
제품 재고 관리 화면 만들어줘
주문 관리 화면 만들어줘
고객 문의 관리 화면 만들어줘
```

AI가 자동으로:
- 적절한 필드 생성 (이름, 이메일, 전화번호 등)
- 필드 타입 설정 (텍스트, 숫자, 이메일, 날짜 등)
- 유효성 검증 규칙 추가
- 그리드 화면 생성

### 2️⃣ 데이터 입력

**방법 1: 수동 입력**
- "➕ 새 항목 추가" 버튼 클릭
- 필드 입력 후 저장

**방법 2: 엑셀 파일 업로드**
- 엑셀 파일을 프롬프트 영역에 드래그 앤 드롭
- 또는 "📎 파일 첨부" 버튼 클릭
- AI가 자동으로 컬럼 매칭 후 데이터 저장

**방법 3: 비정형 텍스트**
```
홍길동 부장님 이메일은 hong@company.com이고 
전화번호는 010-1234-5678입니다. 
마케팅팀 소속이며 2020년 입사했습니다.
```
→ AI가 자동으로 파싱하여 필드에 매칭

### 3️⃣ 데이터 관리

- **검색**: 🔍 검색창에 키워드 입력
- **정렬**: 컬럼 헤더 클릭
- **편집**: ✏️ 버튼 클릭 후 수정
- **삭제**: 🗑️ 버튼 클릭

## 📁 프로젝트 구조

```
ai-erp/
├── server/                    # 백엔드
│   ├── index.js              # 서버 진입점
│   ├── routes/               # API 라우트
│   │   ├── menu.routes.js    # 메뉴 관리
│   │   ├── data.routes.js    # 데이터 CRUD
│   │   └── ai.routes.js      # AI 처리
│   ├── services/             # 비즈니스 로직
│   │   ├── aiService.js      # AI 통합
│   │   └── dataStore.js      # 데이터 저장소
│   └── middleware/           # 미들웨어
│       └── errorHandler.js   # 에러 처리
│
├── src/                      # 프론트엔드
│   ├── App.jsx              # 메인 앱
│   ├── components/          # 컴포넌트
│   │   ├── PromptInput.jsx  # 프롬프트 입력
│   │   └── DynamicGrid.jsx  # 동적 그리드
│   ├── services/            # API 클라이언트
│   │   └── api.js
│   └── store/               # 상태 관리
│       └── appStore.js
│
├── data/                     # 데이터 저장소 (자동 생성)
├── uploads/                  # 업로드 파일 (자동 생성)
└── package.json
```

## 🔧 API 문서

### AI API

**POST /api/ai/generate-schema**
```json
{
  "prompt": "사용자 등록 화면 만들어줘"
}
```

**POST /api/ai/parse-text**
```json
{
  "text": "홍길동, hong@company.com, 010-1234-5678",
  "menuId": "user_registration"
}
```

**POST /api/ai/parse-file**
```
FormData:
- file: Excel file
- menuId: string
```

### 메뉴 API

**GET /api/menus** - 모든 메뉴 조회  
**GET /api/menus/:menuId** - 특정 메뉴 조회  
**POST /api/menus** - 메뉴 생성  
**DELETE /api/menus/:menuId** - 메뉴 삭제

### 데이터 API

**GET /api/data/:menuId** - 데이터 조회  
**POST /api/data/:menuId** - 데이터 생성  
**PUT /api/data/:menuId/:id** - 데이터 수정  
**DELETE /api/data/:menuId/:id** - 데이터 삭제  
**POST /api/data/:menuId/bulk** - 대량 데이터 삽입

## 🎯 AI 설정

### Gemini (무료, 추천!)

1. https://makersuite.google.com/app/apikey 에서 API 키 발급
2. `.env`에 추가:
```env
DEFAULT_AI=gemini
GEMINI_API_KEY=your_key_here
```

### OpenAI (유료)

1. https://platform.openai.com/api-keys 에서 API 키 발급
2. `.env`에 추가:
```env
DEFAULT_AI=openai
OPENAI_API_KEY=your_key_here
```

### Claude (유료)

1. https://console.anthropic.com/ 에서 API 키 발급
2. `.env`에 추가:
```env
DEFAULT_AI=claude
ANTHROPIC_API_KEY=your_key_here
```

## 💡 팁

### 비용 절감
- **Gemini Flash 사용** (무료, 60 req/min)
- 간단한 작업은 규칙 기반 처리 (AI 호출 최소화)
- 컬럼 매칭은 동의어 사전 우선 사용

### 성능 최적화
- 데이터는 메모리에 캐싱 (빠른 조회)
- 1분마다 자동 저장 (데이터 손실 방지)
- 변경된 메뉴만 저장 (효율적 I/O)

### 확장성
- In-Memory → PostgreSQL 전환 가능
- 추상화 레이어로 DB 교체 쉬움
- 마이크로서비스 분리 가능

## 🚧 로드맵

- [ ] 관계형 데이터 지원 (외래키)
- [ ] 대시보드 및 차트
- [ ] 사용자 인증 및 권한 관리
- [ ] 워크플로우 자동화
- [ ] 모바일 반응형
- [ ] 다국어 지원
- [ ] PostgreSQL 마이그레이션
- [ ] Docker 컨테이너화

## 📝 라이선스

MIT

## 🤝 기여

이슈와 PR은 언제나 환영합니다!

## 📧 문의

문제가 있으시면 이슈를 등록해주세요.

---

**Made with ❤️ and 🤖 AI**
