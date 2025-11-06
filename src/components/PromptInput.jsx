import { useState, useRef } from 'react';
import './PromptInput.css';

/**
 * AI 프롬프트 입력 컴포넌트
 */
export default function PromptInput({ onSubmit, onFileUpload, placeholder, disabled }) {
  const [input, setInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSubmit(input.trim());
      setInput('');
    }
  };
  
  const handleKeyDown = (e) => {
    // Ctrl/Cmd + Enter로 제출
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit(e);
    }
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && onFileUpload) {
      onFileUpload(files[0]);
    }
  };
  
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0 && onFileUpload) {
      onFileUpload(files[0]);
    }
  };
  
  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };
  
  return (
    <div className="prompt-input-container">
      <form 
        onSubmit={handleSubmit} 
        className={`prompt-form ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="prompt-input-wrapper">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "무엇을 만들까요? (예: 사용자 등록 화면 만들어줘)"}
            disabled={disabled}
            rows={3}
            className="prompt-textarea"
          />
          
          <div className="prompt-actions">
            {onFileUpload && (
              <>
                <button
                  type="button"
                  onClick={handleFileButtonClick}
                  disabled={disabled}
                  className="file-button"
                  title="파일 업로드"
                >
                  📎 파일 첨부
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                />
              </>
            )}
            
            <button
              type="submit"
              disabled={disabled || !input.trim()}
              className="submit-button"
            >
              ✨ 생성
            </button>
          </div>
        </div>
        
        {isDragging && (
          <div className="drop-overlay">
            📄 파일을 여기에 놓으세요
          </div>
        )}
      </form>
      
      <div className="prompt-hint">
        💡 Tip: Ctrl/Cmd + Enter로 빠르게 제출 | 엑셀 파일을 드래그 앤 드롭하세요
      </div>
    </div>
  );
}

