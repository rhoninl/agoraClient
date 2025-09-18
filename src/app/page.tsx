'use client';

import { useState, useEffect, useRef } from 'react';
import { useAgoraAudience } from '@/hooks/useAgoraAudience';
import { saveAgoraCredentials, loadAgoraCredentials } from '@/lib/agora-utils';

export default function Home() {
  const [appId, setAppId] = useState('');
  const [appCertificate, setAppCertificate] = useState('');
  const [channel, setChannel] = useState('');
  const [uid, setUid] = useState('');
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Load saved credentials on mount
  useEffect(() => {
    const savedCredentials = loadAgoraCredentials();
    if (savedCredentials.appId) {
      setAppId(savedCredentials.appId);
    }
    if (savedCredentials.appCertificate) {
      setAppCertificate(savedCredentials.appCertificate);
    }
  }, []);

  const isValidAppId = (id: string): boolean => {
    const appIdPattern = /^[a-f0-9]{32}$/i;
    return appIdPattern.test(id.trim());
  };

  const {
    isJoined,
    isJoining,
    remoteUsers,
    error,
    joinChannel,
    leaveChannel
  } = useAgoraAudience({
    appId,
    appCertificate,
    channel,
    uid: uid || undefined
  });

  const handleJoin = async () => {
    // Save credentials before joining
    if (appId) {
      saveAgoraCredentials(appId, appCertificate);
    }

    await joinChannel();
  };

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
      webkitFullscreenElement?: Element;
      msFullscreenElement?: Element;
      mozFullScreenElement?: Element;
    }

    try {
      const element = videoContainerRef.current as FullscreenElement;
      const doc = document as FullscreenDocument;

      if (!document.fullscreenElement) {
        // Try different fullscreen methods for browser compatibility
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
          await element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
          await element.msRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
          await element.mozRequestFullScreen();
        }
        setIsFullscreen(true);
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
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  // Listen for fullscreen changes (cross-browser support)
  useEffect(() => {
    const handleFullscreenChange = () => {
      interface FullscreenDocument extends Document {
        webkitFullscreenElement?: Element;
        msFullscreenElement?: Element;
        mozFullScreenElement?: Element;
      }

      const doc = document as FullscreenDocument;
      const fullscreenElement =
        document.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.msFullscreenElement ||
        doc.mozFullScreenElement;

      setIsFullscreen(!!fullscreenElement);
    };

    // Add event listeners for all browsers
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Add keyboard shortcuts for fullscreen
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // F11 or Ctrl+F for fullscreen toggle
      if (event.key === 'F11' || (event.key === 'f' && event.ctrlKey)) {
        event.preventDefault();
        toggleFullscreen();
      }
      // F key alone for fullscreen toggle (when not in input)
      if (event.key === 'f' && !event.ctrlKey && document.activeElement?.tagName !== 'INPUT') {
        event.preventDefault();
        toggleFullscreen();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [isFullscreen]);

  if (isJoined) {
    // Show large video screen when joined
    return (
      <div className="min-h-screen bg-black">
        {/* Header with controls */}
        <div className="absolute top-4 left-4 right-4 z-20">
          <div className="flex justify-between items-center">
            <div className="text-white">
              <h1 className="text-lg font-semibold">Channel: {channel}</h1>
              <p className="text-sm opacity-80">
                Connected as audience • {remoteUsers.filter(user => user.hasVideo).length} video stream(s)
                {remoteUsers.length > remoteUsers.filter(user => user.hasVideo).length &&
                  ` • ${remoteUsers.length - remoteUsers.filter(user => user.hasVideo).length} audio-only`
                }
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={toggleFullscreen}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isFullscreen ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zM15 4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L12.586 5H11a1 1 0 010-2h4zM5 15a1 1 0 011-1h2.586l-2.293-2.293a1 1 0 111.414-1.414L10 12.586V11a1 1 0 112 0v4a1 1 0 01-1 1H6a1 1 0 01-1-1v-1zm10 0a1 1 0 01-1 1h-2.586l2.293 2.293a1 1 0 01-1.414 1.414L10 15.414V17a1 1 0 11-2 0v-4a1 1 0 011-1h4a1 1 0 011 1v1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zM15 4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L12.586 5H11a1 1 0 010-2h4zM5 15a1 1 0 011-1h2.586l-2.293-2.293a1 1 0 111.414-1.414L10 12.586V11a1 1 0 112 0v4a1 1 0 01-1 1H6a1 1 0 01-1-1v-1zm10 0a1 1 0 01-1 1h-2.586l2.293 2.293a1 1 0 01-1.414 1.414L10 15.414V17a1 1 0 11-2 0v-4a1 1 0 011-1h4a1 1 0 011 1v1z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <button
                onClick={leaveChannel}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Leave Channel
              </button>
            </div>
          </div>
        </div>

        {/* Main video area */}
        <div
          ref={videoContainerRef}
          className={`w-screen h-screen flex items-center justify-center ${
            isFullscreen ? 'bg-black' : ''
          }`}
          onDoubleClick={toggleFullscreen}
          style={{ cursor: 'pointer' }}
        >
          {remoteUsers.filter(user => user.hasVideo).length === 0 ? (
            <div className="text-center text-white">
              <div className="mb-4">
                <svg className="w-16 h-16 mx-auto opacity-50" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm3 2h6v4H7V5zm8 8v2h1v-2h-1zm-2-2H7v4h6v-4z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">Waiting for video streams</h2>
              <p className="opacity-80">
                {remoteUsers.length > 0
                  ? `${remoteUsers.length} user(s) connected, but no video streams available yet`
                  : 'No video streams available yet'
                }
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              {remoteUsers.filter(user => user.hasVideo).map((user) => (
                <div
                  key={user.uid}
                  className="relative bg-gray-900 rounded-lg overflow-hidden"
                  style={{
                    width: isFullscreen ? '100vw' : '80vw',
                    height: isFullscreen ? '100vh' : '80vh',
                    maxWidth: isFullscreen ? '100vw' : '80vw',
                    maxHeight: isFullscreen ? '100vh' : '80vh',
                    borderRadius: isFullscreen ? '0' : '0.5rem'
                  }}
                >
                  {/* User info overlay */}
                  <div className="absolute top-4 left-4 z-10">
                    <div className="bg-black bg-opacity-50 text-white px-3 py-1 rounded">
                      <p className="text-sm font-medium">User: {user.uid}</p>
                      <div className="flex gap-2 mt-1">
                        {user.hasVideo && (
                          <span className="text-xs bg-blue-600 px-2 py-1 rounded">
                            📹 Video
                          </span>
                        )}
                        {user.hasAudio && (
                          <span className="text-xs bg-green-600 px-2 py-1 rounded">
                            🎵 Audio
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Video container */}
                  <div
                    id={`user-${user.uid}`}
                    className="w-full h-full bg-black"
                    style={{
                      width: '100%',
                      height: '100%',
                      position: 'relative'
                    }}
                  >
                    {!user.hasVideo && (
                      <div className="absolute inset-0 flex items-center justify-center text-center text-white z-10">
                        <div>
                          <div className="mb-4">
                            <svg className="w-16 h-16 mx-auto opacity-50" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.82L4.73 14H2a1 1 0 01-1-1V7a1 1 0 011-1h2.73l3.653-2.82a1 1 0 01.617-.204zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.414A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <p className="text-lg">Audio Only</p>
                          <p className="text-sm opacity-80">No video available</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show join form when not connected
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            Agora Audience Client
          </h1>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                App ID *
              </label>
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 dark:bg-gray-700 dark:text-white ${
                  appId && !isValidAppId(appId)
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    : appId && isValidAppId(appId)
                    ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                    : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-transparent'
                }`}
                placeholder="32-character App ID"
                maxLength={32}
              />
              {appId && (
                <p className={`text-xs mt-1 ${
                  isValidAppId(appId) ? 'text-green-600' : 'text-red-600'
                }`}>
                  {appId.length}/32 {isValidAppId(appId) ? '✓ Valid' : '✗ Invalid format'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Channel Name *
              </label>
              <input
                type="text"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Enter channel name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                User ID (optional)
              </label>
              <input
                type="text"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Auto-generated if empty"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                App Certificate (optional)
              </label>
              <input
                type="password"
                value={appCertificate}
                onChange={(e) => setAppCertificate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="For secure token generation"
              />
            </div>

            <button
              onClick={handleJoin}
              disabled={!appId || !channel || isJoining}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed text-lg font-medium"
            >
              {isJoining ? 'Joining...' : 'Join as Audience'}
            </button>

            {error && (
              <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
                <p className="font-medium">Error:</p>
                <p className="text-sm">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
