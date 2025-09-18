'use client';

import { useState, useEffect, useCallback } from 'react';
import { IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';
import { AgoraClient, AgoraConfig } from '@/lib/agora-config';

export interface UseAgoraAudienceProps {
  appId: string;
  appCertificate?: string;
  channel: string;
  uid?: string | number;
}

export interface UseAgoraAudienceReturn {
  isJoined: boolean;
  isJoining: boolean;
  remoteUsers: IAgoraRTCRemoteUser[];
  error: string | null;
  joinChannel: (token?: string) => Promise<void>;
  leaveChannel: () => Promise<void>;
  generateToken: () => Promise<string>;
}

export function useAgoraAudience({
  appId,
  appCertificate,
  channel,
  uid
}: UseAgoraAudienceProps): UseAgoraAudienceReturn {
  const [client, setClient] = useState<AgoraClient | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generateToken = useCallback(async (): Promise<string> => {
    if (!appId || !channel) {
      throw new Error('App ID and channel are required for token generation');
    }

    const config: AgoraConfig = {
      appId,
      channel,
      uid,
      appCertificate
    };

    const tempClient = new AgoraClient(config);
    return await tempClient.generateToken('audience');
  }, [appId, appCertificate, channel, uid]);

  const joinChannel = useCallback(async (providedToken?: string) => {
    if (isJoining || isJoined) return;

    setIsJoining(true);
    setError(null);

    try {
      const config: AgoraConfig = {
        appId,
        channel,
        token: providedToken,
        uid,
        appCertificate
      };

      const agoraClient = new AgoraClient(config);
      await agoraClient.joinAsAudience();

      setClient(agoraClient);
      setIsJoined(true);
      setRemoteUsers(agoraClient.getRemoteUsers());

      // Update remote users when they change
      const updateRemoteUsers = () => {
        if (agoraClient.isConnected()) {
          const users = agoraClient.getRemoteUsers();
          console.log('🔄 Remote users updated:', users.length);
          setRemoteUsers([...users]);
        }
      };

      // Initial update
      updateRemoteUsers();

      // Set up a periodic update for remote users
      const interval = setInterval(updateRemoteUsers, 1000);

      // Store interval ID for cleanup
      (agoraClient as typeof agoraClient & { updateInterval: ReturnType<typeof setInterval> }).updateInterval = interval;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join channel';
      setError(errorMessage);
      console.error('Join channel error:', err);
    } finally {
      setIsJoining(false);
    }
  }, [appId, channel, uid, appCertificate, isJoining, isJoined]);

  const leaveChannel = useCallback(async () => {
    if (!client || !isJoined) return;

    try {
      // Clear the update interval
      const clientWithInterval = client as typeof client & { updateInterval?: ReturnType<typeof setInterval> };
      if (clientWithInterval.updateInterval) {
        clearInterval(clientWithInterval.updateInterval);
      }

      await client.leave();
      setClient(null);
      setIsJoined(false);
      setRemoteUsers([]);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to leave channel';
      setError(errorMessage);
      console.error('Leave channel error:', err);
    }
  }, [client, isJoined]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (client) {
        leaveChannel();
      }
    };
  }, [client, leaveChannel]);

  return {
    isJoined,
    isJoining,
    remoteUsers,
    error,
    joinChannel,
    leaveChannel,
    generateToken
  };
}