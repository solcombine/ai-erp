import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 환경 변수 로드
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

class AIService {
  constructor() {
    // AI 클라이언트 초기화
    this.defaultAI = process.env.DEFAULT_AI || 'gemini';
    
    // Gemini 초기화 (무료!)
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    
    // OpenAI 초기화
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
    
    // Claude 초기화
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
    }
    
    console.log(`🤖 AI Service initialized with: ${this.defaultAI}`);
  }
  
  /**
   * 자연어 프롬프트로부터 데이터베이스 스키마 생성
   * @param {string} prompt - 사용자 입력 (예: "사용자 등록 화면 만들어줘")
   * @returns {Promise<Object>} 생성된 스키마
   */
  async generateSchema(prompt) {
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
      "options": ["option1", "option2"],
      "validation": {
        "min": 0,
        "max": 100,
        "pattern": "regex_pattern"
      }
    }
  ]
}

중요:
- 한국 ERP에 적합한 필드를 생성하세요
- 일반적으로 필요한 필드들을 자동으로 추가하세요 (생성일시, 수정일시, 상태 등)
- type은 반드시 지정된 타입 중 하나를 사용하세요
- select 타입인 경우 options 배열을 반드시 포함하세요`;

    try {
      let result;
      
      switch(this.defaultAI) {
        case 'openai':
          result = await this.generateWithOpenAI(systemPrompt, prompt);
          break;
        case 'claude':
          result = await this.generateWithClaude(systemPrompt, prompt);
          break;
        case 'gemini':
        default:
          result = await this.generateWithGemini(systemPrompt, prompt);
          break;
      }
      
      // ID 자동 추가 (없는 경우)
      if (!result.columns.find(col => col.name === 'id')) {
        result.columns.unshift({
          name: 'id',
          type: 'string',
          label: 'ID',
          required: true,
          readOnly: true,
          generated: true
        });
      }
      
      // 생성일시, 수정일시 자동 추가 (없는 경우)
      if (!result.columns.find(col => col.name === 'createdAt')) {
        result.columns.push({
          name: 'createdAt',
          type: 'date',
          label: '생성일시',
          required: true,
          readOnly: true,
          generated: true
        });
      }
      
      if (!result.columns.find(col => col.name === 'updatedAt')) {
        result.columns.push({
          name: 'updatedAt',
          type: 'date',
          label: '수정일시',
          required: true,
          readOnly: true,
          generated: true
        });
      }
      
      console.log(`✅ Schema generated for: ${result.menuName}`);
      return result;
      
    } catch (error) {
      console.error('❌ Schema generation failed:', error);
      throw new Error(`AI 스키마 생성 실패: ${error.message}`);
    }
  }
  
  /**
   * 스키마 수정 요청 분석
   * @param {string} prompt - 사용자 프롬프트
   * @param {Object} schema - 현재 스키마
   * @returns {Promise<Object>} 수정된 스키마 또는 null
   */
  async analyzeSchemaModification(prompt, schema) {
    const modificationKeywords = ['컬럼', '필드', '추가', '삭제', '제거', '수정', '변경', 'column', 'field', 'add', 'remove', 'delete', 'modify'];
    const hasModificationIntent = modificationKeywords.some(keyword => 
      prompt.toLowerCase().includes(keyword)
    );
    
    if (!hasModificationIntent) {
      return null; // 스키마 수정 의도 없음
    }
    
    const systemPrompt = `당신은 데이터베이스 스키마 수정 전문가입니다.
사용자의 요청을 분석하여 스키마를 수정하세요.

현재 스키마:
${JSON.stringify(schema.columns, null, 2)}

사용자 요청: "${prompt}"

다음 JSON 형식으로 응답하세요:
{
  "isSchemaModification": true,
  "action": "add|remove|modify",
  "columns": [수정된 전체 컬럼 배열]
}

- action: "add" (컬럼 추가), "remove" (컬럼 삭제), "modify" (컬럼 수정)
- columns: 수정된 후의 전체 컬럼 배열을 반환
- 기존 컬럼의 id, createdAt, updatedAt는 유지하세요`;

    try {
      const result = await this.generateWithGemini(systemPrompt, prompt);
      
      if (result.isSchemaModification) {
        console.log(`✅ Schema modification detected: ${result.action}`);
        return result;
      }
      
      return null;
    } catch (error) {
      console.error('Schema modification analysis failed:', error);
      return null;
    }
  }
  
  /**
   * 비정형 데이터를 스키마에 맞게 파싱
   * @param {string} text - 비정형 텍스트 데이터
   * @param {Object} schema - 대상 스키마
   * @returns {Promise<Object>} 파싱된 데이터
   */
  async parseUnstructuredData(text, schema) {
    const systemPrompt = `다음 스키마에 맞게 텍스트에서 정보를 추출하세요.
스키마: ${JSON.stringify(schema.columns, null, 2)}

응답은 반드시 다음 JSON 형식으로만 반환하세요:
{
  "data": {
    "column_name": "extracted_value"
  },
  "confidence": 0.95,
  "missing": ["missing_field1"]
}

- 추출할 수 없는 필드는 null로 설정하고 missing 배열에 포함하세요
- confidence는 0-1 사이의 값으로 추출 신뢰도를 나타냅니다`;

    try {
      let result;
      
      switch(this.defaultAI) {
        case 'openai':
          result = await this.generateWithOpenAI(systemPrompt, text);
          break;
        case 'claude':
          result = await this.generateWithClaude(systemPrompt, text);
          break;
        case 'gemini':
        default:
          result = await this.generateWithGemini(systemPrompt, text);
          break;
      }
      
      console.log(`✅ Data parsed with confidence: ${result.confidence}`);
      return result;
      
    } catch (error) {
      console.error('❌ Data parsing failed:', error);
      throw new Error(`AI 데이터 파싱 실패: ${error.message}`);
    }
  }
  
  /**
   * 엑셀 컬럼과 스키마 컬럼 매칭
   * @param {Array<string>} sourceColumns - 엑셀 컬럼명 배열
   * @param {Object} schema - 대상 스키마
   * @returns {Promise<Array>} 매칭 결과
   */
  async matchColumns(sourceColumns, schema) {
    // 1단계: 규칙 기반 매칭 (무료!)
    const ruleBasedMatches = this.ruleBasedMatching(sourceColumns, schema.columns);
    
    // 2단계: 매칭 안 된 컬럼만 AI에게 질의 (비용 절감!)
    const matchedSources = ruleBasedMatches.map(m => m.source);
    const unmatched = sourceColumns.filter(c => !matchedSources.includes(c));
    
    if (unmatched.length === 0) {
      console.log(`✅ All columns matched by rules`);
      return ruleBasedMatches;
    }
    
    console.log(`🤖 AI matching for ${unmatched.length} unmatched columns`);
    
    const systemPrompt = `다음 엑셀 컬럼들을 스키마 컬럼과 매칭하세요.
엑셀 컬럼: ${JSON.stringify(unmatched)}
스키마 컬럼: ${JSON.stringify(schema.columns.map(c => ({ name: c.name, label: c.label })))}

응답은 반드시 다음 JSON 형식으로만 반환하세요:
{
  "matches": [
    {
      "source": "엑셀_컬럼명",
      "target": "스키마_컬럼명",
      "confidence": 0.95
    }
  ]
}

- confidence가 0.7 미만인 경우 매칭하지 마세요
- 매칭할 수 없는 컬럼은 제외하세요`;

    try {
      let result;
      
      switch(this.defaultAI) {
        case 'openai':
          result = await this.generateWithOpenAI(systemPrompt, '위 컬럼들을 매칭해주세요');
          break;
        case 'claude':
          result = await this.generateWithClaude(systemPrompt, '위 컬럼들을 매칭해주세요');
          break;
        case 'gemini':
        default:
          result = await this.generateWithGemini(systemPrompt, '위 컬럼들을 매칭해주세요');
          break;
      }
      
      const allMatches = [...ruleBasedMatches, ...result.matches];
      console.log(`✅ Total ${allMatches.length} columns matched`);
      return allMatches;
      
    } catch (error) {
      console.error('❌ Column matching failed:', error);
      // AI 실패 시 규칙 기반 결과만 반환
      return ruleBasedMatches;
    }
  }
  
  /**
   * 규칙 기반 컬럼 매칭 (AI 없이, 무료!)
   */
  ruleBasedMatching(sourceColumns, targetColumns) {
    const matches = [];
    
    // 동의어 사전
    const synonyms = {
      'name': ['이름', '성명', '사용자명', '고객명', 'username', 'user_name', 'customer_name', '명', '성함'],
      'email': ['이메일', '메일', 'e-mail', 'mail', '전자우편'],
      'phone': ['전화', '전화번호', 'tel', 'telephone', 'mobile', '휴대폰', '연락처', '핸드폰'],
      'address': ['주소', 'addr', '거주지', '소재지'],
      'department': ['부서', 'dept', '소속', '팀'],
      'position': ['직급', '직위', 'title', '포지션'],
      'status': ['상태', 'state', '진행상태', '처리상태'],
      'date': ['날짜', '일자', '일시'],
      'amount': ['금액', '가격', 'price', 'cost', '비용'],
      'quantity': ['수량', 'qty', '개수', '갯수'],
      'description': ['설명', '비고', 'desc', 'note', '메모', '내용']
    };
    
    for (const source of sourceColumns) {
      const sourceLower = source.toLowerCase().trim();
      
      for (const target of targetColumns) {
        const targetLower = target.name.toLowerCase();
        const targetLabel = target.label.toLowerCase();
        
        // 정확히 일치
        if (sourceLower === targetLower || sourceLower === targetLabel) {
          matches.push({ source, target: target.name, confidence: 1.0 });
          break;
        }
        
        // 동의어 매칭
        const targetSynonyms = synonyms[targetLower] || [];
        const isMatch = targetSynonyms.some(syn => 
          sourceLower.includes(syn.toLowerCase()) || syn.toLowerCase().includes(sourceLower)
        );
        
        if (isMatch) {
          matches.push({ source, target: target.name, confidence: 0.9 });
          break;
        }
        
        // 부분 일치
        if (sourceLower.includes(targetLower) || targetLower.includes(sourceLower) ||
            sourceLower.includes(targetLabel) || targetLabel.includes(sourceLower)) {
          matches.push({ source, target: target.name, confidence: 0.8 });
          break;
        }
      }
    }
    
    return matches;
  }
  
  // ============ AI 구현체들 ============
  
  async generateWithOpenAI(system, user) {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }
    
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });
    
    return JSON.parse(response.choices[0].message.content);
  }
  
  async generateWithClaude(system, user) {
    if (!this.anthropic) {
      throw new Error('Anthropic API key not configured');
    }
    
    const response = await this.anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `${system}\n\n${user}`
      }]
    });
    
    const text = response.content[0].text;
    // JSON 추출 (Claude는 때때로 마크다운으로 감쌈)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  }
  
  async generateWithGemini(system, user) {
    if (!this.gemini) {
      throw new Error('Gemini API key not configured');
    }
    
    // Gemini 2.5 Flash 사용 (최신 버전)
    const model = this.gemini.getGenerativeModel({ 
      model: "gemini-2.5-flash"
    });
    
    const result = await model.generateContent(`${system}\n\n${user}\n\n중요: 응답은 반드시 유효한 JSON 형식으로만 작성하세요. 마크다운 코드 블록을 사용하지 말고 순수 JSON만 반환하세요. 추가 설명이나 주석 없이 JSON만 반환하세요.`);
    const text = result.response.text();
    
    // JSON 추출 및 정제
    let jsonText = text.trim();
    
    // 마크다운 코드 블록 제거
    jsonText = jsonText.replace(/^```json\s*/i, '').replace(/\s*```$/,  '');
    jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    
    // 앞뒤 공백 및 줄바꿈 제거
    jsonText = jsonText.trim();
    
    // JSON 객체 추출 (첫 번째 { 부터 마지막 } 까지)
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1) {
      console.error('Gemini response:', text);
      throw new Error('No valid JSON object found in response');
    }
    
    jsonText = jsonText.substring(firstBrace, lastBrace + 1);
    
    try {
      return JSON.parse(jsonText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Attempted to parse:', jsonText);
      console.error('Original response:', text);
      throw new Error(`Failed to parse JSON: ${parseError.message}`);
    }
  }
}

export default new AIService();

