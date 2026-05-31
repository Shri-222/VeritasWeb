import { NextRequest, NextResponse } from 'next/server';
import { captureWebsite } from '@/lib/capture';

export async function POST(_request: NextRequest) {
  try {
    const result = await captureWebsite(
    'https://example.com'
    );
    return NextResponse.json({
      success: true,
      title: result.title,
    });
  } catch (error) {
      console.error('[capture-now]', error);

      return NextResponse.json(
        {
          error: 'Capture failed',
        },
        {
          status: 500,
        }
      );
    }
}