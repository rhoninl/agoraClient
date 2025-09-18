import { NextRequest, NextResponse } from 'next/server';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

interface TokenRequest {
  appId: string;
  appCertificate: string;
  channelName: string;
  uid: string | number;
  role: 'publisher' | 'audience';
  expireTimeInSeconds?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: TokenRequest = await request.json();
    const {
      appId,
      appCertificate,
      channelName,
      uid,
      role = 'audience',
      expireTimeInSeconds = 3600
    } = body;

    // Validate required fields
    if (!appId || !appCertificate || !channelName) {
      return NextResponse.json(
        { error: 'App ID, App Certificate, and Channel Name are required' },
        { status: 400 }
      );
    }

    // Validate App ID format (32-character hex string)
    const appIdPattern = /^[a-f0-9]{32}$/i;
    if (!appIdPattern.test(appId)) {
      return NextResponse.json(
        { error: 'Invalid App ID format. App ID should be a 32-character hexadecimal string.' },
        { status: 400 }
      );
    }

    // Calculate expiration time
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expireTimeInSeconds;

    // Convert role to Agora role enum
    const agoraRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    // Convert uid to number if it's a string
    const uidNum = typeof uid === 'string' ? parseInt(uid) || 0 : uid || 0;

    // Generate token
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uidNum,
      agoraRole,
      privilegeExpiredTs,
      privilegeExpiredTs
    );

    return NextResponse.json({
      token,
      uid: uidNum,
      channel: channelName,
      role,
      expireTime: privilegeExpiredTs,
      generatedAt: currentTimestamp
    });

  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate token', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint for token generation with query parameters
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const channelName = searchParams.get('channel');
  const uid = searchParams.get('uid') || '0';
  const role = searchParams.get('role') || 'audience';
  const appId = searchParams.get('appId');
  const appCertificate = searchParams.get('appCertificate');

  if (!appId || !appCertificate || !channelName) {
    return NextResponse.json(
      { error: 'App ID, App Certificate, and Channel Name are required' },
      { status: 400 }
    );
  }

  // Validate App ID format (32-character hex string)
  const appIdPattern = /^[a-f0-9]{32}$/i;
  if (!appIdPattern.test(appId)) {
    return NextResponse.json(
      { error: 'Invalid App ID format. App ID should be a 32-character hexadecimal string.' },
      { status: 400 }
    );
  }

  try {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + 3600; // 1 hour expiry

    const agoraRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const uidNum = parseInt(uid) || 0;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uidNum,
      agoraRole,
      privilegeExpiredTs,
      privilegeExpiredTs
    );

    return NextResponse.json({
      code: 0,
      data: {
        token,
        appid: appId
      }
    });

  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json(
      {
        code: 1,
        message: 'Failed to generate token',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}