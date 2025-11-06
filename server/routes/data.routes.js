import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import dataStore from '../services/dataStore.js';

const router = express.Router();

/**
 * GET /api/data/:menuId
 * 데이터 조회 (필터링 지원)
 */
router.get('/:menuId', asyncHandler(async (req, res) => {
  const { menuId } = req.params;
  const filters = req.query;
  
  const rows = dataStore.query(menuId, filters);
  
  res.json({
    success: true,
    data: rows,
    count: rows.length
  });
}));

/**
 * GET /api/data/:menuId/:id
 * 단일 데이터 조회
 */
router.get('/:menuId/:id', asyncHandler(async (req, res) => {
  const { menuId, id } = req.params;
  
  const row = dataStore.findById(menuId, id);
  
  if (!row) {
    return res.status(404).json({
      success: false,
      error: { message: 'Data not found' }
    });
  }
  
  res.json({
    success: true,
    data: row
  });
}));

/**
 * POST /api/data/:menuId
 * 데이터 생성
 */
router.post('/:menuId', asyncHandler(async (req, res) => {
  const { menuId } = req.params;
  const rowData = req.body;
  
  const row = dataStore.insert(menuId, rowData);
  
  res.status(201).json({
    success: true,
    data: row
  });
}));

/**
 * PUT /api/data/:menuId/:id
 * 데이터 수정
 */
router.put('/:menuId/:id', asyncHandler(async (req, res) => {
  const { menuId, id } = req.params;
  const updates = req.body;
  
  const row = dataStore.update(menuId, id, updates);
  
  res.json({
    success: true,
    data: row
  });
}));

/**
 * DELETE /api/data/:menuId/:id
 * 데이터 삭제
 */
router.delete('/:menuId/:id', asyncHandler(async (req, res) => {
  const { menuId, id } = req.params;
  
  dataStore.delete(menuId, id);
  
  res.json({
    success: true,
    message: 'Data deleted successfully'
  });
}));

/**
 * POST /api/data/:menuId/bulk
 * 대량 데이터 삽입
 */
router.post('/:menuId/bulk', asyncHandler(async (req, res) => {
  const { menuId } = req.params;
  const { rows } = req.body;
  
  if (!Array.isArray(rows)) {
    return res.status(400).json({
      success: false,
      error: { message: 'rows must be an array' }
    });
  }
  
  const results = dataStore.bulkInsert(menuId, rows);
  
  res.json({
    success: true,
    data: results
  });
}));

export default router;

