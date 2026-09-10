import { useEffect, useState } from 'react';
import { getSocket } from '@/utils/socket';
import { FiMousePointer as FiMouse } from 'react-icons/fi';
import './LiveScreenModal.css'; // optional CSS for styling

interface LiveScreenModalProps {
  employeeId: string;
  onClose: () => void;
}

export const LiveScreenModal: React.FC<LiveScreenModalProps> = ({ employeeId, onClose }) => {
  const [frame, setFrame] = useState<string>('');
  const [cursor, setCursor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeWindow, setActiveWindow] = useState<string>('');

  useEffect(() => {
    const socket = getSocket();
    // Join the room for the specified employee
    socket.emit('watch:employee', employeeId);

    const handleLiveFrame = (data: {
      employeeId: string;
      frame: string;
      cursor: { x: number; y: number };
      activeWindow?: string;
    }) => {
      setFrame(data.frame);
      setCursor(data.cursor);
      if (data.activeWindow) setActiveWindow(data.activeWindow);
    };

    socket.on('live:frame', handleLiveFrame);

    return () => {
      socket.off('live:frame', handleLiveFrame);
      // Optional: leave room (socket.emit('unwatch:employee', employeeId)) if backend supports it
    };
  }, [employeeId]);

  return (
    <div className="live-screen-modal-overlay" onClick={onClose}>
      <div className="live-screen-modal-content" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>
        {frame ? (
          <div className="frame-container" style={{ position: 'relative' }}>
            <img src={frame} alt="Live screen frame" style={{ width: '100%', height: 'auto' }} />
            <div
              style={{
                position: 'absolute',
                left: `${cursor.x}px`,
                top: `${cursor.y}px`,
                pointerEvents: 'none',
                transform: 'translate(-50%, -50%)',
              }}
            >
              <FiMouse size={24} color="red" />
            </div>
          </div>
        ) : (
          <p>Waiting for live stream…</p>
        )}
        {activeWindow && <div className="window-tooltip">{activeWindow}</div>}
      </div>
    </div>
  );
};
