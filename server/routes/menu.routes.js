import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import dataStore from '../services/dataStore.js';

const router = express.Router();

/**
 * GET /api/menus
 * 모든 메뉴 조회
 */
router.get('/', asyncHandler(async (req, res) => {
  const menus = dataStore.getAllMenus();
  
  res.json({
    success: true,
    data: menus
  });
}));

/**
 * GET /api/menus/:menuId
 * 특정 메뉴 조회
 */
router.get('/:menuId', asyncHandler(async (req, res) => {
  const { menuId } = req.params;
  const menu = dataStore.getMenu(menuId);
  
  if (!menu) {
    return res.status(404).json({
      success: false,
      error: { message: 'Menu not found' }
    });
  }
  
  res.json({
    success: true,
    data: menu
  });
}));

/**
 * POST /api/menus
 * 새 메뉴 생성
 */
router.post('/', asyncHandler(async (req, res) => {
  const menuData = req.body;
  
  if (!menuData.menuName) {
    return res.status(400).json({
      success: false,
      error: { message: 'menuName is required' }
    });
  }
  
  const menu = dataStore.createMenu(menuData);
  
  res.status(201).json({
    success: true,
    data: menu
  });
}));

/**
 * DELETE /api/menus/:menuId
 * 메뉴 삭제
 */
router.delete('/:menuId', asyncHandler(async (req, res) => {
  const { menuId } = req.params;
  
  dataStore.deleteMenu(menuId);
  
  res.json({
    success: true,
    message: 'Menu deleted successfully'
  });
}));

/**
 * GET /api/menus/:menuId/schema
 * 메뉴 스키마 조회
 */
router.get('/:menuId/schema', asyncHandler(async (req, res) => {
  const { menuId } = req.params;
  const schema = dataStore.getSchema(menuId);
  
  if (!schema) {
    return res.status(404).json({
      success: false,
      error: { message: 'Schema not found' }
    });
  }
  
  res.json({
    success: true,
    data: schema
  });
}));

/**
 * GET /api/menus/stats
 * 통계 정보
 */
router.get('/system/stats', asyncHandler(async (req, res) => {
  const stats = dataStore.getStats();
  
  res.json({
    success: true,
    data: stats
  });
}));

export default router;

