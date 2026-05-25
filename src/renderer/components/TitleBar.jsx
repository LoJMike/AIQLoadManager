import { useState } from 'react';
import badgeIcon from '../assets/AIQLoadManager_logo_badge.png';

const isMac = navigator.userAgent.includes('Macintosh');

export default function TitleBar({ title = 'AIQ Load Manager' }) {
  const [isMaximized, setIsMaximized] = useState(false);

  const handleMinimize = () => window.aiQueue.windowMinimize?.();

  const handleMaximize = async () => {
    const nowMaximized = await window.aiQueue.windowMaximize?.();
    setIsMaximized(!!nowMaximized);
  };

  const handleClose = () => window.aiQueue.windowClose?.();

  return (
    <div className="titlebar">
      {/* macOS: leave room for native traffic lights (close/min/max dots) */}
      {isMac && <div className="titlebar-mac-spacer" />}

      <div className="titlebar-logo">
        <img src={badgeIcon} alt="" className="titlebar-icon" />
        <span className="titlebar-title">{title}</span>
      </div>

      {/* Windows / Linux: custom window controls */}
      {!isMac && (
        <div className="titlebar-controls">
          <button
            className="titlebar-btn btn-minimize"
            onClick={handleMinimize}
            title="Minimize"
          >
            ─
          </button>
          <button
            className="titlebar-btn btn-maximize"
            onClick={handleMaximize}
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? '❐' : '□'}
          </button>
          <button
            className="titlebar-btn btn-close"
            onClick={handleClose}
            title="Close"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
