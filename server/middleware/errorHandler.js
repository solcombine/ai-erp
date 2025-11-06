/**
 * 전역 에러 핸들러
 */
export const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err);
  
  // 에러 타입별 처리
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

/**
 * 비동기 라우트 핸들러 래퍼
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

