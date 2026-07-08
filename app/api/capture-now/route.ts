import { NextRequest, NextResponse } from "next/server";
import { captureWebsite } from "@/lib/capture";
import { calculateSHA256Hash, generateForensicMetadata } from "@/lib/forensic";
import {
  apiErrorResponse,
  authenticateApiRequest,
} from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  isMissingSupabaseEnvError,
  missingSupabaseEnvResponse,
} from "@/lib/supabase/env";
import { z } from "zod";

const captureNowSchema = z.object({
  monitorId: z.string().uuid(),
});

export async function POST(
  request: NextRequest,
) {
  try {
    const auth =
      await authenticateApiRequest(request);

    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const body = await request.json();

    const { monitorId } =
      captureNowSchema.parse(body);

    // Verify ownership before any service-role work.
    const { data: monitor, error: monitorError } = await auth.supabase
      .from("monitors")
      .select("*")
      .eq("id", monitorId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (monitorError || !monitor) {
      if (monitorError) {
        console.error(
          "[capture-now:monitor]",
          monitorError,
        );
      }

      return apiErrorResponse(
        "MONITOR_NOT_FOUND",
        "Monitor not found.",
        404,
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

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
      data: {
        capture: captureRecord,
        forensicMetadata,
      },
    });
  } catch (error) {
    if (isMissingSupabaseEnvError(error)) {
      return missingSupabaseEnvResponse();
    }

    if (error instanceof SyntaxError) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        "Invalid JSON body.",
        400,
      );
    }

    if (error instanceof z.ZodError) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        "monitorId is required and must be a valid UUID.",
        400,
      );
    }

    console.error("[capture-now]", error);

    return apiErrorResponse(
      "CAPTURE_FAILED",
      "Capture failed.",
      500,
    );
  }
}
