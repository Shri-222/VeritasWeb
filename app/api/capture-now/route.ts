import { NextRequest, NextResponse } from "next/server";
import { captureWebsite } from "@/lib/capture";
import {
  calculateSHA256Hash,
  createEvidenceManifestWithHash,
} from "@/lib/forensic";
import {
  apiErrorResponse,
  authenticateApiRequest,
} from "@/lib/auth";
import { safeUrlSchema } from "@/lib/schemas";
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

    const safeUrl = safeUrlSchema.safeParse(monitor.url);

    if (!safeUrl.success) {
      return apiErrorResponse(
        "UNSAFE_URL",
        "Monitor URL is not safe to capture.",
        400,
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data: previousCapture } = await supabaseAdmin
      .from("captures")
      .select("sha256_hash, manifest_sha256")
      .eq("monitor_id", monitorId)
      .order("captured_at", {
        ascending: false,
      })
      .order("timestamp", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    const previousCaptureHash =
      previousCapture?.manifest_sha256 ??
      previousCapture?.sha256_hash ??
      null;

    const result = await captureWebsite(safeUrl.data);

    const screenshotSha256 = await calculateSHA256Hash(
      result.screenshotBuffer,
    );

    const htmlSha256 = await calculateSHA256Hash(
      result.html,
    );

    const pathTimestamp = result.capturedAt.replace(
      /[:.]/g,
      "-",
    );

    const screenshotPath = `${auth.user.id}/${monitorId}/${pathTimestamp}/screenshot.png`;
    const htmlPath = `${auth.user.id}/${monitorId}/${pathTimestamp}/page.html`;

    const { manifestHash } =
      await createEvidenceManifestWithHash({
        original_url: result.originalUrl,
        final_url: result.finalUrl,
        page_title: result.title || null,
        captured_at: result.capturedAt,
        status_code: result.statusCode,
        headers: result.headers,
        screenshot_path: screenshotPath,
        html_path: htmlPath,
        screenshot_sha256: screenshotSha256,
        html_sha256: htmlSha256,
        previous_capture_hash: previousCaptureHash,
      });

    const { error: screenshotUploadError } =
      await supabaseAdmin.storage
        .from("captures")
        .upload(screenshotPath, result.screenshotBuffer, {
          cacheControl: "3600",
          upsert: false,
          contentType: "image/png",
        });

    if (screenshotUploadError) {
      throw screenshotUploadError;
    }

    const { error: htmlUploadError } =
      await supabaseAdmin.storage
        .from("captures")
        .upload(htmlPath, Buffer.from(result.html, "utf-8"), {
          cacheControl: "3600",
          upsert: false,
          contentType: "text/html; charset=utf-8",
        });

    if (htmlUploadError) {
      throw htmlUploadError;
    }

    const { data: captureRecord, error: captureError } = await supabaseAdmin
      .from("captures")
      .insert({
        monitor_id: monitorId,
        timestamp: result.capturedAt,
        storage_url: screenshotPath,
        sha256_hash: manifestHash,
        tsa_token: null,
        status_code: result.statusCode,
        headers: result.headers ?? {},
        previous_capture_hash: previousCaptureHash,
        screenshot_path: screenshotPath,
        html_path: htmlPath,
        screenshot_sha256: screenshotSha256,
        html_sha256: htmlSha256,
        manifest_sha256: manifestHash,
        original_url: result.originalUrl,
        final_url: result.finalUrl,
        page_title: result.title,
        captured_at: result.capturedAt,
        capture_status: "success",
        error_message: null,
      })
      .select()
      .single();

    if (captureError) {
      throw captureError;
    }

    return NextResponse.json({
      success: true,
      data: {
        captureId: captureRecord.id,
        monitorId,
        screenshotPath,
        htmlPath,
        manifestSha256: manifestHash,
        screenshotSha256,
        htmlSha256,
        statusCode: result.statusCode,
        pageTitle: result.title,
        finalUrl: result.finalUrl,
        capturedAt: result.capturedAt,
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
