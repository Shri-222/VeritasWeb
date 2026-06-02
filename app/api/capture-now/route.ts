import { NextRequest, NextResponse } from 'next/server';
import { captureWebsite } from '@/lib/capture';
import { calculateSHA256Hash, generateForensicMetadata } from '@/lib/forensic';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(_request: NextRequest) {
  try {
    const result = await captureWebsite(
    'https://theindex.moe/'
    );

    const screenShotHash = await calculateSHA256Hash(result.screenshot);

    const forensicMetadata = generateForensicMetadata(
      screenShotHash,
      result.statusCode,
      // result.headers
    );

    const fileName = `capture-${Date.now()}.png`;

    const { data, error } = await supabaseAdmin.storage
          .from('captures')
          .upload(
            fileName, 
            result.screenshot, 
            {
              cacheControl: 'max-age=3600',
              upsert: false,
              contentType : 'image/png',
            }
          );

      if (error) {
        console.error('Supabase Storage Upload Error:', error);
        throw new Error('Failed to upload screenshot to storage');
      }

      await supabaseAdmin
            .from('captures')
            .insert({
              monitor_id: "...",
              storage_url: data?.path,
              sha256_hash: screenShotHash,
              status_code: result.statusCode,
              headers: {},
            });

    return NextResponse.json({
      success: true,
      title: result.title,
      forensicMetadata: forensicMetadata
    });

  } catch (error) {
      console.error('[capture-now]', error);

      return NextResponse.json(
        {
          error: error instanceof Error
            ? error.message
            : 'Capture failed',
        },
        {
          status: 500,
        }
      );
    }
}