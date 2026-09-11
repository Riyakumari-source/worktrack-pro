import { useEffect, useState } from 'react';
import { getSocket } from '@/utils/socket';
import './LiveScreenModal.css'; // optional CSS for styling

interface LiveScreenModalProps {
  employeeId: string;
  onClose: () => void;
}

export const LiveScreenModal: React.FC<LiveScreenModalProps> = ({ employeeId, onClose }) => {
  const [frame, setFrame] = useState<string>('');
  const [activeWindow, setActiveWindow] = useState<string>('');

  useEffect(() => {
    const socket = getSocket();
    // Join the room for the specified employee
    socket.emit('watch:employee', employeeId);

    const handleLiveFrame = (data: {
      employeeId: string;
      frame: string;
      activeWindow?: string;
    }) => {
      setFrame(data.frame);
      if (data.activeWindow) setActiveWindow(data.activeWindow);
    };

    socket.on('live:frame', handleLiveFrame);

    return () => {
      socket.off('live:frame', handleLiveFrame);
    };
  }, [employeeId]);

  return (
    <div className="live-screen-modal-overlay" onClick={onClose}>
      <div className="live-screen-modal-content" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>
        {frame ? (
          <div className="frame-container" style={{ position: 'relative' }}>
            <img src={frame} alt="Live screen frame" style={{ width: '100%', height: 'auto', display: 'block' }} />
          </div>
        ) : (
          <p>Connecting to live stream…</p>
        )}
        {activeWindow && <div className="window-tooltip">{activeWindow}</div>}
      </div>
    </div>
  );
};
