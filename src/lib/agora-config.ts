import type { IAgoraRTCClient, IAgoraRTCRemoteUser, ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { agoraGetAppData, generateTokenFromBackend, generateTokenFromServer, validateAgoraToken } from './agora-utils';

export interface AgoraConfig {
  appId: string;
  channel: string;
  token?: string;
  uid?: string | number;
  appCertificate?: string;
  mode?: 'rtc' | 'live';
  codec?: 'vp8' | 'vp9' | 'h264';
}

export class AgoraClient {
  private client: IAgoraRTCClient | null = null;
  private config: AgoraConfig;
  private localVideoTrack: ICameraVideoTrack | null = null;
  private localAudioTrack: IMicrophoneAudioTrack | null = null;
  private isPublisher: boolean = false;

  constructor(config: AgoraConfig) {
    this.config = {
      mode: 'rtc',
      codec: 'vp8',
      ...config
    };
  }

  private async initClient() {
    if (typeof window === 'undefined') return;

    const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;

    // Force RTC mode and VP8 codec for video streaming
    this.client = AgoraRTC.createClient({
      mode: 'rtc',
      codec: 'vp8'
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.client) return;

    this.client.on('user-published', async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
      if (!this.client) return;

      try {
        await this.client.subscribe(user, mediaType);
        console.log('✅ Subscribed to user:', user.uid, 'mediaType:', mediaType);

        if (mediaType === 'video') {
          const remoteVideoTrack = user.videoTrack;
          console.log('📹 Video track received:', remoteVideoTrack);

          // Wait a bit for DOM to be ready and try multiple times
          const playVideo = () => {
            const playerContainer = document.getElementById(`user-${user.uid}`);
            if (playerContainer && remoteVideoTrack) {
              console.log('🎬 Playing video in container:', playerContainer);
              remoteVideoTrack.play(playerContainer);
            } else {
              console.warn('⚠️ Player container not found for user:', user.uid);
              // Retry after a short delay
              setTimeout(playVideo, 500);
            }
          };

          playVideo();
        }

        if (mediaType === 'audio') {
          const remoteAudioTrack = user.audioTrack;
          if (remoteAudioTrack) {
            remoteAudioTrack.play();
            console.log('🔊 Audio track playing for user:', user.uid);
          }
        }
      } catch (error) {
        console.error('❌ Failed to subscribe to user:', user.uid, mediaType, error);
      }
    });

    this.client.on('user-unpublished', (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
      console.log('📤 User unpublished:', user.uid, mediaType);

      if (mediaType === 'video') {
        const playerContainer = document.getElementById(`user-${user.uid}`);
        if (playerContainer) {
          playerContainer.innerHTML = '';
        }
      }
    });

    this.client.on('user-left', (user: IAgoraRTCRemoteUser) => {
      console.log('👋 User left:', user.uid);
      const playerContainer = document.getElementById(`user-${user.uid}`);
      if (playerContainer) {
        playerContainer.innerHTML = '';
      }
    });

    this.client.on('connection-state-change', (curState, revState) => {
      console.log('🔗 Connection state changed:', revState, '->', curState);
    });
  }

  /**
   * Generate token using backend API with frontend credentials or Agora's demo server
   */
  async generateToken(role: 'publisher' | 'audience' = 'audience'): Promise<string> {
    try {
      // First try using backend API with client credentials if app certificate is available
      if (this.config.appCertificate) {
        try {
          return await generateTokenFromServer(
            this.config.appId,
            this.config.appCertificate,
            this.config.channel,
            this.config.uid || 0,
            role
          );
        } catch (serverError) {
          console.warn('Server token generation failed, trying alternative method:', serverError);

          // Fallback to POST endpoint
          return await generateTokenFromBackend(
            this.config.appId,
            this.config.appCertificate,
            this.config.channel,
            this.config.uid || 0,
            role
          );
        }
      }

      // Last resort: try using Agora's demo server
      const serverToken = await agoraGetAppData({
        uid: this.config.uid || 0,
        channel: this.config.channel,
        appid: this.config.appId
      });

      if (serverToken) {
        return serverToken;
      }

      throw new Error('No token generation method available. Please provide App Certificate.');
    } catch (error) {
      console.error('Token generation failed:', error);
      throw error;
    }
  }

  async joinAsAudience(): Promise<void> {
    this.isPublisher = false;
    return this.join('audience');
  }

  async joinAsPublisher(): Promise<void> {
    this.isPublisher = true;
    return this.join('publisher');
  }

  private async join(role: 'publisher' | 'audience'): Promise<void> {
    // Validate required configuration
    if (!this.config.appId || this.config.appId.trim() === '') {
      throw new Error('App ID is required and cannot be empty');
    }

    if (!this.config.channel || this.config.channel.trim() === '') {
      throw new Error('Channel name is required and cannot be empty');
    }

    // Validate App ID format (should be 32 characters hex string)
    const appIdPattern = /^[a-f0-9]{32}$/i;
    if (!appIdPattern.test(this.config.appId.trim())) {
      throw new Error('Invalid App ID format. App ID should be a 32-character hexadecimal string.');
    }

    // Validate token if provided
    if (this.config.token && !validateAgoraToken(this.config.token)) {
      console.warn('Provided token appears to be invalid');
    }

    if (!this.client) {
      await this.initClient();
    }

    if (!this.client) {
      throw new Error('Failed to initialize Agora client');
    }

    try {
      // Generate token if not provided
      let token = this.config.token;
      if (!token) {
        try {
          token = await this.generateToken(role);
          console.log('Generated token for', role);
        } catch (tokenError) {
          console.error('Token generation failed:', tokenError);
          throw new Error('Token generation failed. Please check your App Certificate or server configuration.');
        }
      }

      const uid = await this.client.join(
        this.config.appId.trim(),
        this.config.channel.trim(),
        token,
        this.config.uid || null
      );

      console.log(`Joined channel as ${role} with uid:`, uid);

      // For publishers, create and publish local tracks
      if (this.isPublisher) {
        await this.createAndPublishTracks();
      }

    } catch (error: unknown) {
      console.error('Failed to join channel:', error);

      // Provide more specific error messages
      const errorObj = error as { code?: string; message?: string };
      if (errorObj.code === 'CAN_NOT_GET_GATEWAY_SERVER') {
        throw new Error('Invalid App ID or network connection issue. Please verify your App ID is correct.');
      } else if (errorObj.code === 'INVALID_TOKEN') {
        throw new Error('Invalid token. Please check your token or generate a new one.');
      } else if (errorObj.code === 'TOKEN_EXPIRED') {
        throw new Error('Token has expired. Please generate a new token.');
      } else if (errorObj.code === 'INVALID_VENDOR_KEY') {
        throw new Error('Invalid App ID. Please check your App ID from Agora Console.');
      } else if (errorObj.code === 'DYNAMIC_KEY_TIMEOUT') {
        throw new Error('Token has expired. Please generate a new token.');
      } else {
        throw new Error(`Failed to join channel: ${errorObj.message || errorObj.code || 'Unknown error'}`);
      }
    }
  }

  private async createAndPublishTracks(): Promise<void> {
    if (!this.client || !this.isPublisher) return;

    try {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;

      // Create local audio and video tracks
      this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      this.localVideoTrack = await AgoraRTC.createCameraVideoTrack();

      // Publish tracks
      await this.client.publish([this.localAudioTrack, this.localVideoTrack]);
      console.log('Local tracks published successfully');

      // Play local video track
      const localPlayerContainer = document.getElementById('local-player');
      if (localPlayerContainer && this.localVideoTrack) {
        this.localVideoTrack.play(localPlayerContainer);
      }

    } catch (error) {
      console.error('Failed to create and publish tracks:', error);
      throw error;
    }
  }

  async leave(): Promise<void> {
    if (!this.client) return;

    try {
      // Stop and close local tracks
      if (this.localVideoTrack) {
        this.localVideoTrack.stop();
        this.localVideoTrack.close();
        this.localVideoTrack = null;
      }

      if (this.localAudioTrack) {
        this.localAudioTrack.stop();
        this.localAudioTrack.close();
        this.localAudioTrack = null;
      }

      // Leave the channel
      await this.client.leave();
      this.isPublisher = false;
      console.log('Left channel');
    } catch (error) {
      console.error('Failed to leave channel:', error);
      throw error;
    }
  }

  getRemoteUsers(): IAgoraRTCRemoteUser[] {
    return this.client?.remoteUsers || [];
  }

  isConnected(): boolean {
    return this.client?.connectionState === 'CONNECTED';
  }

  getLocalTracks(): { video: ICameraVideoTrack | null; audio: IMicrophoneAudioTrack | null } {
    return {
      video: this.localVideoTrack,
      audio: this.localAudioTrack
    };
  }

  async muteLocalAudio(mute: boolean = true): Promise<void> {
    if (this.localAudioTrack) {
      await this.localAudioTrack.setEnabled(!mute);
    }
  }

  async muteLocalVideo(mute: boolean = true): Promise<void> {
    if (this.localVideoTrack) {
      await this.localVideoTrack.setEnabled(!mute);
    }
  }
}