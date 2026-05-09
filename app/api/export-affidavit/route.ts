/**
 * POST /api/export-affidavit
 * Generates a forensic affidavit PDF for legal proceedings.
 */

export const runtime = 'nodejs';

import { jsPDF } from 'jspdf';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// ----------------------------------------------------
// Types
// ----------------------------------------------------

interface Monitor {
  id: string;
  url: string;
  user_id: string;
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
  monitor_id: z.string().uuid('Invalid monitor ID format'),
  start_date: z.string().datetime().optional().nullable(),
  end_date: z.string().datetime().optional().nullable(),
});

// ----------------------------------------------------
// Auth Helper
// ----------------------------------------------------

async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

// ----------------------------------------------------
// Route Handler
// ----------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // --------------------------------------------
    // Authenticate User
    // --------------------------------------------

    const userId = await getUserId(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // --------------------------------------------
    // Parse Request Body
    // --------------------------------------------

    const body = await request.json();

    const {
      monitor_id,
      start_date,
      end_date,
    } = requestSchema.parse(body);

    // --------------------------------------------
    // Fetch Monitor
    // --------------------------------------------

    const { data: monitor, error: monitorError } = await supabaseAdmin
      .from('monitors')
      .select('id, url, user_id')
      .eq('id', monitor_id)
      .eq('user_id', userId)
      .single<Monitor>();

    if (monitorError || !monitor) {
      return NextResponse.json(
        { error: 'Monitor not found' },
        { status: 404 }
      );
    }

    // --------------------------------------------
    // Build Capture Query
    // --------------------------------------------

    let query = supabaseAdmin
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
    pdf.text('FORENSIC AFFIDAVIT', margin, yPosition);

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
      'Generated by LegalTech Evidence System',
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
        'Content-Disposition': `attachment; filename="affidavit-${Date.now()}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Export Affidavit Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          details: error.flatten(),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}