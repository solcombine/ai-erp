import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import { asyncHandler } from '../middleware/errorHandler.js';
import aiService from '../services/aiService.js';
import dataStore from '../services/dataStore.js';

const router = express.Router();

// 파일 업로드 설정
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

/**
 * POST /api/ai/generate-schema
 * 자연어 프롬프트로 스키마 생성
 */
router.post('/generate-schema', asyncHandler(async (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: { message: 'prompt is required' }
    });
  }
  
  console.log(`🤖 Generating schema for: "${prompt}"`);
  
  const schema = await aiService.generateSchema(prompt);
  
  res.json({
    success: true,
    data: schema
  });
}));

/**
 * POST /api/ai/parse-text
 * 비정형 텍스트 데이터 파싱 또는 스키마 수정
 */
router.post('/parse-text', asyncHandler(async (req, res) => {
  const { text, menuId } = req.body;
  
  if (!text || !menuId) {
    return res.status(400).json({
      success: false,
      error: { message: 'text and menuId are required' }
    });
  }
  
  const schema = dataStore.getSchema(menuId);
  if (!schema) {
    return res.status(404).json({
      success: false,
      error: { message: 'Schema not found' }
    });
  }
  
  console.log(`🤖 Analyzing prompt for menu: ${menuId}`);
  
  // 1. 스키마 수정 의도 확인
  const schemaModification = await aiService.analyzeSchemaModification(text, schema);
  
  if (schemaModification) {
    // 스키마 수정
    console.log(`🔧 Modifying schema: ${schemaModification.action}`);
    
    const menu = dataStore.getMenu(menuId);
    menu.schema.columns = schemaModification.columns;
    menu.updatedAt = new Date().toISOString();
    
    dataStore.dirty.add(menuId);
    
    return res.json({
      success: true,
      data: {
        type: 'schema_modification',
        action: schemaModification.action,
        schema: menu.schema
      }
    });
  }
  
  // 2. 데이터 파싱
  console.log(`🤖 Parsing text for menu: ${menuId}`);
  const result = await aiService.parseUnstructuredData(text, schema);
  
  res.json({
    success: true,
    data: {
      type: 'data_parsing',
      ...result
    }
  });
}));

/**
 * POST /api/ai/parse-file
 * 엑셀 파일 파싱 및 데이터 저장
 */
router.post('/parse-file', upload.single('file'), asyncHandler(async (req, res) => {
  const { menuId } = req.body;
  const file = req.file;
  
  if (!file) {
    return res.status(400).json({
      success: false,
      error: { message: 'file is required' }
    });
  }
  
  if (!menuId) {
    return res.status(400).json({
      success: false,
      error: { message: 'menuId is required' }
    });
  }
  
  const schema = dataStore.getSchema(menuId);
  if (!schema) {
    return res.status(404).json({
      success: false,
      error: { message: 'Schema not found' }
    });
  }
  
  console.log(`📄 Parsing file: ${file.originalname} for menu: ${menuId}`);
  
  try {
    // 엑셀 파일 읽기
    const workbook = xlsx.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);
    
    if (jsonData.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'No data found in file' }
      });
    }
    
    // 엑셀 컬럼 추출
    const excelColumns = Object.keys(jsonData[0]);
    
    // AI로 컬럼 매칭
    console.log(`🤖 Matching columns...`);
    const columnMatches = await aiService.matchColumns(excelColumns, schema);
    
    // 매칭된 컬럼으로 데이터 변환
    const transformedData = jsonData.map(row => {
      const transformed = {};
      
      for (const match of columnMatches) {
        if (match.confidence >= 0.7) {
          transformed[match.target] = row[match.source];
        }
      }
      
      return transformed;
    });
    
    // 대량 삽입
    console.log(`💾 Inserting ${transformedData.length} rows...`);
    const results = dataStore.bulkInsert(menuId, transformedData);
    
    res.json({
      success: true,
      data: {
        columnMatches,
        inserted: results.success.length,
        failed: results.failed.length,
        results
      }
    });
    
  } catch (error) {
    console.error('❌ File parsing failed:', error);
    throw error;
  }
}));

/**
 * POST /api/ai/match-columns
 * 컬럼 매칭만 수행 (미리보기용)
 */
router.post('/match-columns', asyncHandler(async (req, res) => {
  const { sourceColumns, menuId } = req.body;
  
  if (!sourceColumns || !menuId) {
    return res.status(400).json({
      success: false,
      error: { message: 'sourceColumns and menuId are required' }
    });
  }
  
  const schema = dataStore.getSchema(menuId);
  if (!schema) {
    return res.status(404).json({
      success: false,
      error: { message: 'Schema not found' }
    });
  }
  
  console.log(`🤖 Matching columns for menu: ${menuId}`);
  
  const matches = await aiService.matchColumns(sourceColumns, schema);
  
  res.json({
    success: true,
    data: matches
  });
}));

export default router;

