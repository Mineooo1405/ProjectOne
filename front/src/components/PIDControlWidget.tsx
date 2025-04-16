import React, { useState, useEffect } from 'react';
import { RefreshCw, Power, Save, RotateCcw } from 'lucide-react';
import tcpWebSocketService from '../services/TcpWebSocketService';
import { useRobotContext } from './RobotContext';

// Interface cho thông số PID
interface PIDValues {
  kp: number;
  ki: number;
  kd: number;
}

const PIDControlWidget: React.FC = () => {
  const { selectedRobotId } = useRobotContext();
  
  // State
  const [pidValues, setPidValues] = useState<PIDValues>({
    kp: 1.0,
    ki: 0.1,
    kd: 0.01
  });
  const [motorId, setMotorId] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [robotIP, setRobotIP] = useState("");
  const [robotPort, setRobotPort] = useState(12346);
  const [isConnected, setIsConnected] = useState(false);
  const [robotsList, setRobotsList] = useState<{robot_id: string, ip: string}[]>([]);
  const [autoIpFetching, setAutoIpFetching] = useState(false);
  
  // Tự động lấy danh sách robot và IP từ Direct Bridge
  useEffect(() => {
    fetchRobotsList();
    
    // Cập nhật danh sách định kỳ mỗi 10 giây
    const interval = setInterval(fetchRobotsList, 10000);
    return () => clearInterval(interval);
  }, []);

  // Cập nhật trạng thái kết nối dựa trên IP
  useEffect(() => {
    setIsConnected(!!robotIP);
  }, [robotIP]);

  // Lấy danh sách robot và IP của chúng
  const fetchRobotsList = async () => {
    try {
      setAutoIpFetching(true);
      const response = await fetch(`http://localhost:9004/robots-list`);
      const data = await response.json();
      
      if (data.status === 'success') {
        setRobotsList(data.robots);
        
        // Tự động cập nhật IP nếu có robot được chọn
        if (selectedRobotId) {
          const robot = data.robots.find((r: {robot_id: string}) => r.robot_id === selectedRobotId);
          if (robot) {
            setRobotIP(robot.ip);
          }
        }
      }
    } catch (error) {
      console.error("Không thể lấy danh sách robot:", error);
    } finally {
      setAutoIpFetching(false);
    }
  };

  // Cập nhật IP khi robot được chọn thay đổi
  useEffect(() => {
    if (selectedRobotId && robotsList.length > 0) {
      const robot = robotsList.find((r: {robot_id: string}) => r.robot_id === selectedRobotId);
      if (robot) {
        setRobotIP(robot.ip);
      }
    }
  }, [selectedRobotId, robotsList]);

  // Gửi lệnh PID trực tiếp theo IP
  const sendPIDCommand = async () => {
    if (!robotIP) {
      setErrorMessage("IP của robot không có sẵn. Vui lòng đợi hệ thống tự động cập nhật hoặc chọn robot khác.");
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
      return;
    }
    
    setIsSaving(true);
    setErrorMessage(null);
    
    try {
      // Format theo định dạng mà ESP32 mong đợi
      const command = `MOTOR:${motorId} Kp:${pidValues.kp} Ki:${pidValues.ki} Kd:${pidValues.kd}`;
      
      const response = await fetch(`http://localhost:9004/command/ip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ip: robotIP,
          port: robotPort,
          command: command
        })
      });
      
      const data = await response.json();
      
      setIsSaving(false);
      
      if (data.status === 'success') {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        setErrorMessage(data.message || "Không thể gửi thông số PID");
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch (error) {
      setIsSaving(false);
      setSaveStatus('error');
      setErrorMessage(error instanceof Error ? error.message : "Lỗi không xác định");
      setTimeout(() => setSaveStatus('idle'), 3000);
      console.error("Lỗi khi gửi lệnh PID:", error);
    }
  };

  // Xử lý thay đổi giá trị input
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value);
    
    setPidValues(prev => ({
      ...prev,
      [name]: numValue
    }));
  };

  // Khôi phục giá trị mặc định
  const resetToDefaults = () => {
    setPidValues({
      kp: 1.0,
      ki: 0.1,
      kd: 0.01
    });
  };

  // Kết nối đến robot
  const connect = () => {
    if (robotIP) {
      setIsConnected(true);
    } else {
      setErrorMessage("Không có địa chỉ IP robot. Vui lòng đợi cập nhật tự động.");
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  // Ngắt kết nối
  const disconnect = () => {
    setIsConnected(false);
  };

  // Xử lý lưu cấu hình PID - giờ chỉ dùng một phương thức duy nhất
  const handleSave = async () => {
    await sendPIDCommand();
  };
  
  // Render UI với hiển thị IP tự động
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-gray-400'
          }`}></div>
          <span className="font-medium">Cấu hình PID</span>
          <span className="text-sm text-gray-500">({isConnected ? 'đã kết nối' : 'chưa kết nối'})</span>
        </div>
        
        {!isConnected ? (
          <button 
            onClick={connect}
            className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex items-center gap-1"
          >
            <Power size={14} />
            <span>Kết nối</span>
          </button>
        ) : (
          <button 
            onClick={disconnect}
            className="px-3 py-1 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 flex items-center gap-1"
          >
            <Power size={14} />
            <span>Ngắt kết nối</span>
          </button>
        )}
      </div>
      
      {/* Motor Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Motor</label>
        <select
          value={motorId}
          onChange={(e) => setMotorId(parseInt(e.target.value))}
          className="w-full p-2 border border-gray-300 rounded-md"
        >
          <option value={1}>Motor 1</option>
          <option value={2}>Motor 2</option>
          <option value={3}>Motor 3</option>
        </select>
      </div>

      <div className="mt-4 p-3 border rounded-lg bg-gray-50">
        <div className="font-medium mb-2">Kết nối tới robot</div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-grow">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Địa chỉ IP (tự động)
              </label>
              <input
                type="text"
                value={robotIP}
                readOnly
                className="w-full border rounded-md px-2 py-1 text-sm bg-gray-100"
              />
              <div className="text-xs text-gray-500 mt-1">
                {autoIpFetching ? 'Đang lấy IP...' : `IP của robot ${selectedRobotId || '(chưa chọn)'}`}
              </div>
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Cổng
              </label>
              <input
                type="number"
                value={robotPort}
                onChange={(e) => setRobotPort(parseInt(e.target.value) || 12346)}
                className="w-full border rounded-md px-2 py-1 text-sm"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Slider và Input cho các thông số PID */}
      <div className="space-y-4">
        <div>
          <label className="flex justify-between">
            <span className="text-sm font-medium text-gray-700">Kp (Tỉ lệ)</span>
            <span className="text-sm text-gray-500">{pidValues.kp.toFixed(2)}</span>
          </label>
          <input
            type="range"
            name="kp"
            min="0"
            max="10"
            step="0.1"
            value={pidValues.kp}
            onChange={handleChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <input 
            type="number"
            name="kp"
            min="0"
            max="10"
            step="0.1"
            value={pidValues.kp}
            onChange={handleChange}
            className="mt-1 w-full p-1 text-sm border border-gray-300 rounded-md"
          />
        </div>
        
        <div>
          <label className="flex justify-between">
            <span className="text-sm font-medium text-gray-700">Ki (Tích phân)</span>
            <span className="text-sm text-gray-500">{pidValues.ki.toFixed(2)}</span>
          </label>
          <input
            type="range"
            name="ki"
            min="0"
            max="5"
            step="0.01"
            value={pidValues.ki}
            onChange={handleChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <input 
            type="number"
            name="ki"
            min="0"
            max="5"
            step="0.01"
            value={pidValues.ki}
            onChange={handleChange}
            className="mt-1 w-full p-1 text-sm border border-gray-300 rounded-md"
          />
        </div>
        
        <div>
          <label className="flex justify-between">
            <span className="text-sm font-medium text-gray-700">Kd (Đạo hàm)</span>
            <span className="text-sm text-gray-500">{pidValues.kd.toFixed(3)}</span>
          </label>
          <input
            type="range"
            name="kd"
            min="0"
            max="1"
            step="0.001"
            value={pidValues.kd}
            onChange={handleChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <input 
            type="number"
            name="kd"
            min="0"
            max="1"
            step="0.001"
            value={pidValues.kd}
            onChange={handleChange}
            className="mt-1 w-full p-1 text-sm border border-gray-300 rounded-md"
          />
        </div>
      </div>
      
      {/* Nút lưu và reset */}
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleSave}
          disabled={!isConnected || isSaving}
          className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              <span>Đang lưu...</span>
            </>
          ) : (
            <>
              <Save size={14} />
              <span>Lưu cấu hình</span>
            </>
          )}
        </button>
        
        <button
          onClick={resetToDefaults}
          className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded-md flex items-center justify-center"
        >
          <RotateCcw size={14} />
        </button>
      </div>
      
      {/* Thông báo trạng thái */}
      {saveStatus === 'success' && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded text-sm flex items-center gap-1">
          Cấu hình PID đã được gửi thành công!
        </div>
      )}
      
      {saveStatus === 'error' && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm flex items-center gap-1">
          {errorMessage || "Không thể gửi cấu hình PID. Vui lòng thử lại."}
        </div>
      )}
    </div>
  );
};

export default PIDControlWidget;