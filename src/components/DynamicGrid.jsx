import { useState, useMemo } from 'react';
import './DynamicGrid.css';

/**
 * 동적 그리드 컴포넌트
 */
export default function DynamicGrid({ schema, data, onEdit, onDelete, onAdd }) {
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [isAdding, setIsAdding] = useState(false);
  const [newData, setNewData] = useState({});
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');
  
  // 편집 가능한 컬럼만 필터링
  const editableColumns = useMemo(() => {
    return schema.columns.filter(col => !col.readOnly && !col.generated);
  }, [schema]);
  
  // 표시할 컬럼 (ID 제외, 생성/수정일시는 마지막에)
  const displayColumns = useMemo(() => {
    const regular = schema.columns.filter(
      col => col.name !== 'id' && col.name !== 'createdAt' && col.name !== 'updatedAt'
    );
    const timestamps = schema.columns.filter(
      col => col.name === 'createdAt' || col.name === 'updatedAt'
    );
    return [...regular, ...timestamps];
  }, [schema]);
  
  // 정렬 및 검색
  const processedData = useMemo(() => {
    let result = [...data];
    
    // 검색
    if (searchTerm) {
      result = result.filter(row => {
        return displayColumns.some(col => {
          const value = row[col.name];
          return value && String(value).toLowerCase().includes(searchTerm.toLowerCase());
        });
      });
    }
    
    // 정렬
    if (sortColumn) {
      result.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        
        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        const comparison = aVal < bVal ? -1 : 1;
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }
    
    return result;
  }, [data, searchTerm, sortColumn, sortDirection, displayColumns]);
  
  const handleSort = (columnName) => {
    if (sortColumn === columnName) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnName);
      setSortDirection('asc');
    }
  };
  
  const handleEdit = (row) => {
    setEditingId(row.id);
    setEditData({ ...row });
  };
  
  const handleSave = () => {
    onEdit(editingId, editData);
    setEditingId(null);
    setEditData({});
  };
  
  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };
  
  const handleAddNew = () => {
    setIsAdding(true);
    const initialData = {};
    editableColumns.forEach(col => {
      initialData[col.name] = '';
    });
    setNewData(initialData);
  };
  
  const handleSaveNew = () => {
    onAdd(newData);
    setIsAdding(false);
    setNewData({});
  };
  
  const handleCancelNew = () => {
    setIsAdding(false);
    setNewData({});
  };
  
  const renderCell = (row, column) => {
    const value = row[column.name];
    
    // 편집 모드
    if (editingId === row.id && !column.readOnly && !column.generated) {
      return renderInput(column, editData[column.name], (val) => {
        setEditData({ ...editData, [column.name]: val });
      });
    }
    
    // 표시 모드
    return renderValue(value, column);
  };
  
  const renderInput = (column, value, onChange) => {
    const commonProps = {
      value: value || '',
      onChange: (e) => onChange(e.target.value),
      className: 'cell-input'
    };
    
    switch (column.type) {
      case 'textarea':
        return <textarea {...commonProps} rows={2} />;
      case 'number':
        return <input {...commonProps} type="number" />;
      case 'date':
        return <input {...commonProps} type="date" />;
      case 'email':
        return <input {...commonProps} type="email" />;
      case 'select':
        return (
          <select {...commonProps}>
            <option value="">선택하세요</option>
            {column.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      default:
        return <input {...commonProps} type="text" placeholder={column.placeholder} />;
    }
  };
  
  const renderValue = (value, column) => {
    if (value === null || value === undefined || value === '') {
      return <span className="empty-value">-</span>;
    }
    
    switch (column.type) {
      case 'date':
        return new Date(value).toLocaleString('ko-KR');
      case 'number':
        return Number(value).toLocaleString();
      case 'email':
        return <a href={`mailto:${value}`}>{value}</a>;
      case 'phone':
        return <a href={`tel:${value}`}>{value}</a>;
      default:
        return String(value);
    }
  };
  
  if (!schema || !data) {
    return <div className="grid-loading">데이터를 불러오는 중...</div>;
  }
  
  return (
    <div className="dynamic-grid-container">
      {/* 툴바 */}
      <div className="grid-toolbar">
        <div className="grid-info">
          <h3>{schema.menuName}</h3>
          <span className="data-count">{processedData.length}개 항목</span>
        </div>
        
        <div className="grid-actions">
          <input
            type="text"
            placeholder="🔍 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button onClick={handleAddNew} className="add-button">
            ➕ 새 항목 추가
          </button>
        </div>
      </div>
      
      {/* 그리드 */}
      <div className="grid-wrapper">
        <table className="dynamic-grid">
          <thead>
            <tr>
              {displayColumns.map(col => (
                <th 
                  key={col.name}
                  onClick={() => handleSort(col.name)}
                  className={sortColumn === col.name ? 'sorted' : ''}
                >
                  {col.label}
                  {sortColumn === col.name && (
                    <span className="sort-icon">
                      {sortDirection === 'asc' ? ' ↑' : ' ↓'}
                    </span>
                  )}
                </th>
              ))}
              <th className="actions-column">작업</th>
            </tr>
          </thead>
          <tbody>
            {/* 새 항목 추가 행 */}
            {isAdding && (
              <tr className="editing-row">
                {displayColumns.map(col => (
                  <td key={col.name}>
                    {!col.readOnly && !col.generated ? (
                      renderInput(col, newData[col.name], (val) => {
                        setNewData({ ...newData, [col.name]: val });
                      })
                    ) : (
                      <span className="empty-value">자동생성</span>
                    )}
                  </td>
                ))}
                <td className="actions-cell">
                  <button onClick={handleSaveNew} className="save-btn">💾</button>
                  <button onClick={handleCancelNew} className="cancel-btn">❌</button>
                </td>
              </tr>
            )}
            
            {/* 데이터 행 */}
            {processedData.map(row => (
              <tr key={row.id} className={editingId === row.id ? 'editing-row' : ''}>
                {displayColumns.map(col => (
                  <td key={col.name}>
                    {renderCell(row, col)}
                  </td>
                ))}
                <td className="actions-cell">
                  {editingId === row.id ? (
                    <>
                      <button onClick={handleSave} className="save-btn">💾</button>
                      <button onClick={handleCancel} className="cancel-btn">❌</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleEdit(row)} className="edit-btn">✏️</button>
                      <button onClick={() => onDelete(row.id)} className="delete-btn">🗑️</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            
            {processedData.length === 0 && !isAdding && (
              <tr>
                <td colSpan={displayColumns.length + 1} className="empty-state">
                  {searchTerm ? '검색 결과가 없습니다' : '데이터가 없습니다. 새 항목을 추가하거나 파일을 업로드하세요.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

