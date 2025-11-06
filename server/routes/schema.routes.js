import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import dataStore from '../services/dataStore.js';

const router = express.Router();

/**
 * PUT /api/schema/:menuId
 * 스키마(컬럼) 수정
 */
router.put('/:menuId', asyncHandler(async (req, res) => {
  const { menuId } = req.params;
  const { columns } = req.body;
  
  const menu = dataStore.getMenu(menuId);
  if (!menu) {
    return res.status(404).json({
      success: false,
      error: { message: 'Menu not found' }
    });
  }
  
  // 스키마 업데이트
  const schema = dataStore.getSchema(menuId);
  schema.columns = columns;
  
  // 메뉴 업데이트
  menu.schema = schema;
  menu.updatedAt = new Date().toISOString();
  
  // dirty 플래그 설정
  dataStore.dirty.add(menuId);
  
  console.log(`✅ Schema updated for: ${menuId}`);
  
  res.json({
    success: true,
    data: menu
  });
}));

/**
 * POST /api/schema/:menuId/add-column
 * 컬럼 추가
 */
router.post('/:menuId/add-column', asyncHandler(async (req, res) => {
  const { menuId } = req.params;
  const { column } = req.body;
  
  const schema = dataStore.getSchema(menuId);
  if (!schema) {
    return res.status(404).json({
      success: false,
      error: { message: 'Schema not found' }
    });
  }
  
  // 컬럼 추가
  schema.columns.push(column);
  
  // dirty 플래그
  dataStore.dirty.add(menuId);
  
  console.log(`✅ Column added to ${menuId}: ${column.name}`);
  
  res.json({
    success: true,
    data: schema
  });
}));

/**
 * DELETE /api/schema/:menuId/column/:columnName
 * 컬럼 삭제
 */
router.delete('/:menuId/column/:columnName', asyncHandler(async (req, res) => {
  const { menuId, columnName } = req.params;
  
  const schema = dataStore.getSchema(menuId);
  if (!schema) {
    return res.status(404).json({
      success: false,
      error: { message: 'Schema not found' }
    });
  }
  
  // 컬럼 삭제
  schema.columns = schema.columns.filter(col => col.name !== columnName);
  
  // dirty 플래그
  dataStore.dirty.add(menuId);
  
  console.log(`✅ Column deleted from ${menuId}: ${columnName}`);
  
  res.json({
    success: true,
    data: schema
  });
}));

export default router;

