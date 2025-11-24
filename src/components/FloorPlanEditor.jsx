import React, { useState, useRef, useEffect } from 'react';
import { Upload, Circle, Square, Type, Minus, Save, Trash2, Move } from 'lucide-react';

const DB_NAME = 'floorplan-editor';
const STORE_NAME = 'data';

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

const saveToDB = async (key, value) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(value, key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

const loadFromDB = async (key) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

const clearDB = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

const FloorPlanEditor = () => {
  const [image, setImage] = useState(null);
  const [elements, setElements] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedElement, setDraggedElement] = useState(null);
  const [touchTimeout, setTouchTimeout] = useState(null);
  const [showLegend, setShowLegend] = useState(false);
  const [dimensionStart, setDimensionStart] = useState(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [padding, setPadding] = useState(0);
  const [iconSize, setIconSize] = useState(32);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load from IndexedDB
  useEffect(() => {
    const load = async () => {
      const savedImage = await loadFromDB('image');
      const savedElements = await loadFromDB('elements');
      if (savedImage) setImage(savedImage);
      if (savedElements) setElements(savedElements);
      setIsLoaded(true);
    };
    load();
  }, []);

  // Save to IndexedDB
  useEffect(() => {
    if (!isLoaded) return;
    saveToDB('image', image);
    saveToDB('elements', elements);
  }, [image, elements, isLoaded]);

  const tools = [
    { id: 'outlet', label: 'コンセント', icon: '⚡', color: '#ef4444' },
    { id: 'light', label: '照明', icon: '💡', color: '#f59e0b' },
    { id: 'switch', label: 'スイッチ', icon: '🔘', color: '#3b82f6' },
    { id: 'tv', label: 'TV端子', icon: '📺', color: '#8b5cf6' },
    { id: 'internet', label: 'LAN', icon: '🌐', color: '#10b981' },
    { id: 'ac', label: 'エアコン', icon: '❄️', color: '#06b6d4' },
    { id: 'washer', label: '洗濯機', icon: '🔄', color: '#ec4899' },
    { id: 'fridge', label: '冷蔵庫', icon: '🧊', color: '#6366f1' },
    { id: 'text', label: 'テキスト', icon: 'T', color: '#000000' },
    { id: 'dimension', label: '寸法線', icon: '↔', color: '#000000' },
    { id: 'custom', label: 'カスタム', icon: '➕', color: '#6b7280' },
  ];

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target.result);
        setElements([]);
      };
      reader.readAsDataURL(file);
    }
  };

  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Support touch events
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    return { x, y };
  };

  const handleTouchStart = (e) => {
    // 2本指以上はスクロール用なのでスキップ
    if (e.touches.length > 1) {
      if (touchTimeout) {
        clearTimeout(touchTimeout);
        setTouchTimeout(null);
      }
      return;
    }

    setIsTouchDevice(true);

    // 遅延を入れて2本指判定
    const timeout = setTimeout(() => {
      if (selectedTool && image) {
        // 手動でクリック処理を呼び出す
        const fakeEvent = { ...e, clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
        handleCanvasClick(fakeEvent);
      }
      setTouchTimeout(null);
    }, 100);
    setTouchTimeout(timeout);
  };

  const handleTouchMove = (e) => {
    // 2本指以上はスクロール用なのでスキップ
    if (e.touches.length > 1) {
      if (touchTimeout) {
        clearTimeout(touchTimeout);
        setTouchTimeout(null);
      }
      return;
    }
    e.preventDefault();
    handleMouseMove(e);
  };

  const handleWheel = (e) => {
    // Pinch zoom on trackpad (ctrlKey is true for pinch gestures)
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(z => Math.min(Math.max(0.25, z * delta), 4));
    }
  };

  const handleCanvasClick = (e) => {
    // タッチデバイスの場合、clickイベントは無視（touchstartで処理済み）
    if (isTouchDevice && e.type === 'click') return;

    if (!selectedTool || !image) return;

    const { x, y } = getCanvasCoordinates(e);

    if (selectedTool === 'text') {
      const text = window.prompt('テキストを入力してください:');
      if (text) {
        setElements([...elements, {
          type: 'text',
          x,
          y,
          text,
          color: '#000000'
        }]);
      }
    } else if (selectedTool === 'dimension') {
      if (!dimensionStart) {
        // 1点目
        setDimensionStart({ x, y });
      } else {
        // 2点目
        const length = window.prompt('寸法(cm)を入力してください:');
        if (length) {
          setElements([...elements, {
            type: 'dimension',
            x: dimensionStart.x,
            y: dimensionStart.y,
            x2: x,
            y2: y,
            length,
            color: '#000000'
          }]);
        }
        setDimensionStart(null);
      }
    } else if (selectedTool === 'custom') {
      const emoji = window.prompt('絵文字を入力してください:');
      if (emoji) {
        setElements([...elements, {
          type: 'custom',
          x,
          y,
          icon: emoji,
          color: '#6b7280',
          label: emoji
        }]);
      }
    } else {
      const tool = tools.find(t => t.id === selectedTool);
      setElements([...elements, {
        type: selectedTool,
        x,
        y,
        icon: tool.icon,
        color: tool.color,
        label: tool.label
      }]);
    }
  };

  const handleMouseDown = (e, index) => {
    setIsDragging(true);
    setDraggedElement(index);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || draggedElement === null) return;

    const { x, y } = getCanvasCoordinates(e);

    const newElements = [...elements];
    newElements[draggedElement] = {
      ...newElements[draggedElement],
      x,
      y
    };
    setElements(newElements);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedElement(null);
  };

  const deleteElement = (index) => {
    setElements(elements.filter((_, i) => i !== index));
  };

  const saveImage = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = 'floorplan-annotated.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  useEffect(() => {
    if (!image) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width + padding * 2;
      canvas.height = img.height + padding * 2;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, padding, padding);

      // Draw all elements
      elements.forEach((element) => {
        ctx.save();

        if (element.type === 'text') {
          ctx.font = '16px sans-serif';
          ctx.fillStyle = element.color;
          ctx.fillText(element.text, element.x, element.y);
        } else if (element.type === 'dimension') {
          const x1 = element.x;
          const y1 = element.y;
          const x2 = element.x2 ?? element.x + 100;
          const y2 = element.y2 ?? element.y;

          ctx.strokeStyle = element.color;
          ctx.lineWidth = 2;

          // Main line
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          // Calculate perpendicular direction for end markers
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.sqrt(dx * dx + dy * dy);

          if (len > 0) {
            const nx = -dy / len * 8;
            const ny = dx / len * 8;

            // End markers
            ctx.beginPath();
            ctx.moveTo(x1 + nx, y1 + ny);
            ctx.lineTo(x1 - nx, y1 - ny);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x2 + nx, y2 + ny);
            ctx.lineTo(x2 - nx, y2 - ny);
            ctx.stroke();

            // Text at midpoint
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            ctx.font = 'bold 20px sans-serif';
            ctx.fillStyle = element.color;
            ctx.fillText(element.length + 'cm', midX + nx * 1.5, midY + ny * 1.5 - 5);
          } else {
            // Fallback for zero-length
            ctx.font = 'bold 20px sans-serif';
            ctx.fillStyle = element.color;
            ctx.fillText(element.length + 'cm', x1, y1 - 10);
          }
        } else {
          // Icon
          ctx.font = `${iconSize}px sans-serif`;
          ctx.fillText(element.icon, element.x - iconSize / 2, element.y + iconSize / 3);

          // Circle background
          ctx.beginPath();
          ctx.arc(element.x, element.y, iconSize * 0.8, 0, Math.PI * 2);
          ctx.strokeStyle = element.color;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        ctx.restore();
      });

      // Draw dimension start point marker
      if (dimensionStart) {
        ctx.save();
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(dimensionStart.x, dimensionStart.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    img.src = image;
  }, [image, elements, dimensionStart, padding, iconSize]);

  return (
    <div className="w-full h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-3 sm:p-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3 sm:mb-4">間取り図カッパ</h1>

        {/* Upload Button */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current.click()}
            className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm sm:text-base"
          >
            <Upload size={18} className="sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">間取り図を</span><span>アップロード</span>
          </button>

          {image && (
            <>
              <button
                onClick={saveImage}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm sm:text-base"
              >
                <Save size={18} className="sm:w-5 sm:h-5" />
                保存
              </button>
              <button
                onClick={async () => {
                  if (window.confirm('画像と配置した設備をすべて削除しますか？')) {
                    setImage(null);
                    setElements([]);
                    await clearDB();
                    localStorage.removeItem('floorplan-editor-data');
                  }
                }}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm sm:text-base"
              >
                <Trash2 size={18} className="sm:w-5 sm:h-5" />
                削除
              </button>
              <select
                value={padding}
                onChange={(e) => setPadding(Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value={0}>余白なし</option>
                <option value={50}>余白 50px</option>
                <option value={100}>余白 100px</option>
                <option value={200}>余白 200px</option>
              </select>
              <select
                value={iconSize}
                onChange={(e) => setIconSize(Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value={24}>アイコン小</option>
                <option value={32}>アイコン中</option>
                <option value={48}>アイコン大</option>
                <option value={64}>アイコン特大</option>
              </select>
            </>
          )}
        </div>

        {/* Tools */}
        {image && (
          <div className="flex flex-wrap gap-2">
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => {
                  setSelectedTool(tool.id);
                  setDimensionStart(null);
                }}
                className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border-2 transition-all ${
                  selectedTool === tool.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
                style={{
                  borderColor: selectedTool === tool.id ? tool.color : undefined
                }}
              >
                <span className="text-lg sm:text-xl">{tool.icon}</span>
                <span className="text-xs sm:text-sm font-medium">{tool.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-auto p-4 sm:p-8 bg-gray-100">
        {!image ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <Upload size={64} className="mx-auto mb-4 text-gray-400" />
              <p className="text-lg">間取り図をアップロードしてください</p>
            </div>
          </div>
        ) : (
          <div className="bg-gray-300 shadow-lg inline-block">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
              onWheel={handleWheel}
              className="cursor-crosshair"
              style={{ maxWidth: '100%', height: 'auto', transform: `scale(${zoom})`, transformOrigin: 'top left' }}
            />
          </div>
        )}
      </div>

      {/* Legend */}
      {elements.length > 0 && (
        <div className="bg-white border-t border-gray-200">
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="w-full p-2 sm:p-3 flex items-center justify-between hover:bg-gray-50"
          >
            <h3 className="font-semibold text-sm sm:text-base">配置した設備 ({elements.length})</h3>
            <span className="text-gray-500">{showLegend ? '▼' : '▲'}</span>
          </button>
          {showLegend && (
            <div className="px-3 pb-3 max-h-32 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {elements.map((element, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 bg-gray-100 rounded-full text-xs sm:text-sm"
                  >
                    <span>{element.icon || '📝'}</span>
                    <span>{element.label || element.type}</span>
                    <button
                      onClick={() => deleteElement(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border-t border-blue-200 p-2 sm:p-3 text-xs sm:text-sm text-blue-800">
        <p>
          <strong>使い方:</strong>
          <span className="hidden sm:inline">
            ① 間取り図をアップロード →
            ② ツールを選択 →
            ③ 間取り図上をクリックして配置 →
            ④ 完成したら保存
          </span>
          <span className="sm:hidden">
            ① アップロード → ② ツール選択 → ③ タップで配置 → ④ 保存
          </span>
        </p>
      </div>
    </div>
  );
};

export default FloorPlanEditor;
