/**
 * POST /api/export-affidavit
 * Backward-compatible report export route.
 */

export const runtime = 'nodejs';

import { jsPDF } from 'jspdf';
import {
  apiErrorResponse,
  authenticateApiRequest,
} from '@/lib/auth';
import {
  fetchOwnedCaptureById,
} from '@/lib/captures';
import { generateCaptureReportPdf } from '@/lib/pdf-report';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  checkRateLimit,
  rateLimitResponse,
} from '@/lib/rate-limit';
import {
  isMissingSupabaseEnvError,
  missingSupabaseEnvResponse,
} from '@/lib/supabase/env';
import { verifyCaptureArtifacts } from '@/lib/verification';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// ----------------------------------------------------
// Types
// ----------------------------------------------------

interface Monitor {
  id: string;
  url: string;
}

interface Capture {
  id: string;
  timestamp: string;
  status_code: number;
  sha256_hash: string;
}

// ----------------------------------------------------
// jsPDF Polyfill for Node.js
// ----------------------------------------------------

if (typeof globalThis.navigator === 'undefined') {
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'node' },
    writable: true,
  });
}

// ----------------------------------------------------
// Validation Schema
// ----------------------------------------------------

const requestSchema = z.object({
  captureId: z.string().uuid('Invalid capture ID format').optional(),
  monitor_id: z.string().uuid('Invalid monitor ID format').optional(),
  start_date: z.string().datetime().optional().nullable(),
  end_date: z.string().datetime().optional().nullable(),
});

// ----------------------------------------------------
// Route Handler
// ----------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // --------------------------------------------
    // Authenticate User
    // --------------------------------------------

    const auth =
      await authenticateApiRequest(request);

    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const rateLimit = checkRateLimit({
      key: `legacy-export:${auth.user.id}`,
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse();
    }

    // --------------------------------------------
    // Parse Request Body
    // --------------------------------------------

    const body = await request.json();

    const {
      captureId,
      monitor_id,
      start_date,
      end_date,
    } = requestSchema.parse(body);

    if (captureId) {
      const { data: capture, error } =
        await fetchOwnedCaptureById(
          auth.supabase,
          auth.user.id,
          captureId
        );

      if (error) {
        console.error(
          'Export Capture Report Error:',
          error
        );

        return apiErrorResponse(
          'INTERNAL_ERROR',
          'Failed to fetch capture.',
          500
        );
      }

      if (!capture) {
        return apiErrorResponse(
          'CAPTURE_NOT_FOUND',
          'Capture not found.',
          404
        );
      }

      const supabaseAdmin = getSupabaseAdmin();
      const verification = await verifyCaptureArtifacts(
        capture,
        supabaseAdmin
      );

      const pdfBuffer = generateCaptureReportPdf({
        capture,
        verification,
        generatedAt: new Date().toISOString(),
      });

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="veritasweb-capture-${captureId}.pdf"`,
        },
      });
    }

    if (!monitor_id) {
      return apiErrorResponse(
        'VALIDATION_ERROR',
        'captureId or monitor_id is required.',
        400
      );
    }

    // --------------------------------------------
    // Fetch Monitor
    // --------------------------------------------

    const { data: monitor, error: monitorError } = await auth.supabase
      .from('monitors')
      .select('id, url')
      .eq('id', monitor_id)
      .eq('user_id', auth.user.id)
      .maybeSingle<Monitor>();

    if (monitorError || !monitor) {
      if (monitorError) {
        console.error(
          'Export Affidavit Monitor Error:',
          monitorError
        );
      }

      return apiErrorResponse(
        'MONITOR_NOT_FOUND',
        'Monitor not found.',
        404
      );
    }

    // --------------------------------------------
    // Build Capture Query
    // --------------------------------------------

    let query = auth.supabase
      .from('captures')
      .select('id, timestamp, status_code, sha256_hash')
      .eq('monitor_id', monitor_id)
      .order('timestamp', { ascending: false });

    if (start_date) {
      query = query.gte('timestamp', start_date);
    }

    if (end_date) {
      query = query.lte('timestamp', end_date);
    }

    // --------------------------------------------
    // Fetch Captures
    // --------------------------------------------

    const { data: captures, error: capturesError } = await query
      .limit(1000)
      .returns<Capture[]>();

    if (capturesError) {
      throw capturesError;
    }

    // --------------------------------------------
    // Generate PDF
    // --------------------------------------------

    const pdf = new jsPDF();

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const margin = 15;

    let yPosition = 20;

    // --------------------------------------------
    // Title
    // --------------------------------------------

    pdf.setFontSize(18);
    pdf.text(
      'VERITASWEB CAPTURE SUMMARY REPORT',
      margin,
      yPosition
    );

    yPosition += 15;

    // --------------------------------------------
    // Metadata
    // --------------------------------------------

    pdf.setFontSize(10);

    pdf.text(
      `Monitored URL: ${monitor.url}`,
      margin,
      yPosition
    );

    yPosition += 8;

    pdf.text(
      `Generated: ${new Date().toLocaleString()}`,
      margin,
      yPosition
    );

    yPosition += 15;

    // --------------------------------------------
    // Table Headers
    // --------------------------------------------

    const colWidths = [60, 25, 90];

    const headers = [
      'Timestamp',
      'Status',
      'SHA-256 Hash',
    ];

    pdf.setFontSize(11);

    let xPos = margin;

    headers.forEach((header, index) => {
      pdf.text(header, xPos, yPosition);
      xPos += colWidths[index];
    });

    yPosition += 8;

    // Divider line
    pdf.line(
      margin,
      yPosition - 4,
      pageWidth - margin,
      yPosition - 4
    );

    // --------------------------------------------
    // Table Rows
    // --------------------------------------------

    pdf.setFontSize(9);

    if (captures && captures.length > 0) {
      captures.slice(0, 50).forEach((cap) => {
        // Page Break
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = 20;
        }

        xPos = margin;

        // Timestamp Column
        pdf.text(
          new Date(cap.timestamp).toLocaleString(),
          xPos,
          yPosition
        );

        xPos += colWidths[0];

        // Status Column
        pdf.text(
          String(cap.status_code),
          xPos,
          yPosition
        );

        xPos += colWidths[1];

        // Hash Column
        pdf.text(
          `${cap.sha256_hash.substring(0, 20)}...`,
          xPos,
          yPosition
        );

        yPosition += 7;
      });
    } else {
      pdf.text(
        'No capture data found.',
        margin,
        yPosition
      );
    }

    // --------------------------------------------
    // Footer
    // --------------------------------------------

    yPosition += 10;

    pdf.setFontSize(8);

    pdf.text(
      'Generated by VeritasWeb from stored capture metadata. This report does not independently prove legal admissibility.',
      margin,
      yPosition
    );

    // --------------------------------------------
    // Convert PDF to Buffer
    // --------------------------------------------

    const pdfBuffer = Buffer.from(
      pdf.output('arraybuffer')
    );

    // --------------------------------------------
    // Return Response
    // --------------------------------------------

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="veritasweb-monitor-summary-${Date.now()}.pdf"`,
      },
    });

  } catch (error) {
    if (isMissingSupabaseEnvError(error)) {
      return missingSupabaseEnvResponse();
    }

    console.error('Export Affidavit Error:', error);

    if (error instanceof z.ZodError) {
      return apiErrorResponse(
        'VALIDATION_ERROR',
        'Export request is invalid.',
        400
      );
    }

    return apiErrorResponse(
      'INTERNAL_ERROR',
      'Internal server error.',
      500
    );
  }
}
