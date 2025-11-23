import React, { useState, useRef, useEffect } from 'react';
import { Upload, Circle, Square, Type, Minus, Save, Trash2, Move } from 'lucide-react';

const FloorPlanEditor = () => {
  const [image, setImage] = useState(null);
  const [elements, setElements] = useState([]);
  const [selectedTool, setSelectedTool] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedElement, setDraggedElement] = useState(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

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

  const handleCanvasClick = (e) => {
    if (!selectedTool || !image) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (selectedTool === 'text') {
      const text = prompt('テキストを入力してください:');
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
      const length = prompt('寸法(cm)を入力してください:');
      if (length) {
        setElements([...elements, {
          type: 'dimension',
          x,
          y,
          length,
          color: '#000000'
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

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Draw all elements
      elements.forEach((element) => {
        ctx.save();

        if (element.type === 'text') {
          ctx.font = '16px sans-serif';
          ctx.fillStyle = element.color;
          ctx.fillText(element.text, element.x, element.y);
        } else if (element.type === 'dimension') {
          ctx.strokeStyle = element.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(element.x, element.y);
          ctx.lineTo(element.x + 100, element.y);
          ctx.stroke();

          // Arrows
          ctx.beginPath();
          ctx.moveTo(element.x, element.y - 5);
          ctx.lineTo(element.x, element.y + 5);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(element.x + 100, element.y - 5);
          ctx.lineTo(element.x + 100, element.y + 5);
          ctx.stroke();

          // Text
          ctx.font = '14px sans-serif';
          ctx.fillStyle = element.color;
          ctx.fillText(element.length + 'cm', element.x + 30, element.y - 10);
        } else {
          // Icon
          ctx.font = '24px sans-serif';
          ctx.fillText(element.icon, element.x - 12, element.y + 8);

          // Circle background
          ctx.beginPath();
          ctx.arc(element.x, element.y, 20, 0, Math.PI * 2);
          ctx.strokeStyle = element.color;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        ctx.restore();
      });
    };

    img.src = image;
  }, [image, elements]);

  return (
    <div className="w-full h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">間取り図エディター</h1>

        {/* Upload Button */}
        <div className="flex items-center gap-4 mb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current.click()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Upload size={20} />
            間取り図をアップロード
          </button>

          {image && (
            <>
              <button
                onClick={saveImage}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Save size={20} />
                保存
              </button>
              <button
                onClick={() => setElements([])}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Trash2 size={20} />
                全削除
              </button>
            </>
          )}
        </div>

        {/* Tools */}
        {image && (
          <div className="flex flex-wrap gap-2">
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setSelectedTool(tool.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                  selectedTool === tool.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
                style={{
                  borderColor: selectedTool === tool.id ? tool.color : undefined
                }}
              >
                <span className="text-xl">{tool.icon}</span>
                <span className="text-sm font-medium">{tool.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-auto p-8 bg-gray-100">
        {!image ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <Upload size={64} className="mx-auto mb-4 text-gray-400" />
              <p className="text-lg">間取り図をアップロードしてください</p>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow-lg inline-block">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="cursor-crosshair"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          </div>
        )}
      </div>

      {/* Legend */}
      {elements.length > 0 && (
        <div className="bg-white border-t border-gray-200 p-4">
          <h3 className="font-semibold mb-2">配置した設備 ({elements.length})</h3>
          <div className="flex flex-wrap gap-2">
            {elements.map((element, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-sm"
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

      {/* Instructions */}
      <div className="bg-blue-50 border-t border-blue-200 p-3 text-sm text-blue-800">
        <p>
          <strong>使い方:</strong>
          ① 間取り図をアップロード →
          ② ツールを選択 →
          ③ 間取り図上をクリックして配置 →
          ④ 完成したら保存
        </p>
      </div>
    </div>
  );
};

export default FloorPlanEditor;
