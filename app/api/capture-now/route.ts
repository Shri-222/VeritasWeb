import { NextRequest, NextResponse } from "next/server";
import { captureWebsite } from "@/lib/capture";
import { calculateSHA256Hash, generateForensicMetadata } from "@/lib/forensic";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
) {
  try {
  const body = await request.json();

  const { monitorId } = body;
    // Get monitor information

    const { data: monitor, error: monitorError } = await supabaseAdmin
      .from("monitors")
      .select("*")
      .eq("id", monitorId)
      .single();

    if (monitorError || !monitor) {
      return NextResponse.json(
        {
          error: "Monitor not found",
        },
        {
          status: 404,
        },
      );
    }

    // Capture website

    const result = await captureWebsite(monitor.url);

    // Generate hash

    const screenshotHash = await calculateSHA256Hash(result.screenshot);

    const forensicMetadata = generateForensicMetadata(
      screenshotHash,
      result.statusCode,
    );

    // Get previous capture

    const { data: previousCapture } = await supabaseAdmin
      .from("captures")
      .select("sha256_hash")
      .eq("monitor_id", monitorId)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    // Upload screenshot

    const fileName = `${monitorId}/${Date.now()}.png`;

    const { data: uploadedFile, error: uploadError } =
      await supabaseAdmin.storage
        .from("captures")
        .upload(fileName, result.screenshot, {
          cacheControl: "3600",
          upsert: false,
          contentType: "image/png",
        });

    if (uploadError) {
      throw uploadError;
    }

    // Save capture record

    const { data: captureRecord, error: captureError } = await supabaseAdmin
      .from("captures")
      .insert({
        monitor_id: monitorId,
        storage_url: uploadedFile.path,
        sha256_hash: screenshotHash,
        tsa_token: null,
        status_code: result.statusCode,
        headers: result.headers ?? {},
        previous_capture_hash: previousCapture?.sha256_hash ?? null,
      })
      .select()
      .single();

    if (captureError) {
      throw captureError;
    }

    return NextResponse.json({
      success: true,
      capture: captureRecord,
      forensicMetadata,
    });
  } catch (error) {
    console.error("[capture-now]", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Capture failed",
      },
      {
        status: 500,
      },
    );
  }
}
