'use client';

import { useState, useEffect, useRef } from 'react';
import { useAgoraAudience } from '@/hooks/useAgoraAudience';

export default function VideoPage() {
  const [appId, setAppId] = useState('');
  const [appCertificate, setAppCertificate] = useState('');
  const [channel, setChannel] = useState('');
  const [uid, setUid] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const {
    remoteUsers,
    error: agoraError,
    joinChannel
  } = useAgoraAudience({
    appId,
    appCertificate,
    channel,
    uid: uid || undefined
  });

  // Load query parameters and auto-join on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryAppId = urlParams.get('appId');
    const queryAppCertificate = urlParams.get('cert');
    const queryChannel = urlParams.get('channel');
    const queryUid = urlParams.get('uid');

    if (!queryAppId || !queryAppCertificate || !queryChannel) {
      setError('Missing required parameters: appId, cert, and channel are required');
      setLoading(false);
      return;
    }

    // Validate App ID format
    const appIdPattern = /^[a-f0-9]{32}$/i;
    if (!appIdPattern.test(queryAppId)) {
      setError('Invalid App ID format. App ID should be a 32-character hexadecimal string.');
      setLoading(false);
      return;
    }

    setAppId(queryAppId);
    setAppCertificate(queryAppCertificate);
    setChannel(queryChannel);
    setUid(queryUid || '');

    // Auto-join after setting the values
    setTimeout(async () => {
      try {
        setLoading(false);
        await joinChannel();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to join channel');
        setLoading(false);
      }
    }, 1000);
  }, [joinChannel]);

  // Fullscreen functionality (removed since not used in video-only mode)
  const toggleFullscreen = async () => {
    if (!videoContainerRef.current) return;

    interface FullscreenElement extends HTMLElement {
      webkitRequestFullscreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
      mozRequestFullScreen?: () => Promise<void>;
    }

    interface FullscreenDocument extends Document {
      webkitExitFullscreen?: () => Promise<void>;
      msExitFullscreen?: () => Promise<void>;
      mozCancelFullScreen?: () => Promise<void>;
    }

    try {
      const element = videoContainerRef.current as FullscreenElement;
      const doc = document as FullscreenDocument;

      if (!document.fullscreenElement) {
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
          await element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
          await element.msRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
          await element.mozRequestFullScreen();
        }
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        }
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'F11' || (event.key === 'f' && event.ctrlKey)) {
        event.preventDefault();
        toggleFullscreen();
      }
      if (event.key === 'f' && !event.ctrlKey && document.activeElement?.tagName !== 'INPUT') {
        event.preventDefault();
        toggleFullscreen();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <div className="mb-4">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
          <h2 className="text-xl font-semibold mb-2">Connecting to channel...</h2>
          <p className="opacity-80">Channel: {channel}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || agoraError) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white max-w-md mx-auto p-6">
          <div className="mb-4">
            <svg className="w-16 h-16 mx-auto text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Connection Error</h2>
          <p className="text-red-400 mb-4">{error || agoraError}</p>
          <p className="text-sm opacity-80 mb-4">
            Required URL format:<br />
            <code className="bg-gray-800 px-2 py-1 rounded text-xs">
              /video?appId=YOUR_APP_ID&cert=YOUR_CERT&channel=CHANNEL_NAME&uid=USER_ID
            </code>
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Video display (video only, no UI elements)
  return (
    <div className="w-screen h-screen bg-black overflow-hidden">
      {/* Full viewport video area - no headers, no controls, video only */}
      <div
        ref={videoContainerRef}
        className="w-screen h-screen"
      >
        {remoteUsers.filter(user => user.hasVideo).length === 0 ? (
          // Black screen when no video - no loading messages
          <div className="w-full h-full bg-black" />
        ) : (
          // Show only the video content
          <div className="w-full h-full">
            {remoteUsers.filter(user => user.hasVideo).map((user) => (
              <div
                key={user.uid}
                className="w-full h-full"
                style={{
                  width: '100vw',
                  height: '100vh'
                }}
              >
                {/* Video container - no overlays, no user info */}
                <div
                  id={`user-${user.uid}`}
                  className="w-full h-full bg-black"
                  style={{
                    width: '100%',
                    height: '100%'
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}