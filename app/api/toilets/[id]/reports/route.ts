import { NextResponse } from 'next/server';
import { getPool } from '@/db/client';
import { insertReport, toiletExists } from '@/db/queries/reports';
import { parseReportRequest, parseToiletId } from '@/lib/reports/report-request';

/**
 * `POST /api/toilets/:id/reports` — a validated, anonymous report against
 * one toilet (TASK-020: `docs/adr/0015-toilet-reports.md`).
 * `ARCHITECTURE.md` section 6.
 *
 * No rate-limiting or abuse metadata here on purpose — `TASK-021`'s job,
 * per the ADR. Never stores location, an IP, or any device identifier: the
 * inserted row carries only `issueType` and an optional `note`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idValidation = parseToiletId(id);
  if (!idValidation.ok) {
    return NextResponse.json({ error: idValidation.message }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const validation = parseReportRequest(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  const pool = getPool();
  if (!(await toiletExists(pool, idValidation.id))) {
    return NextResponse.json({ error: 'Toilet not found.' }, { status: 404 });
  }

  const report = await insertReport(pool, { toiletId: idValidation.id, ...validation.params });

  return NextResponse.json({ ok: true, reportId: report.id }, { status: 201 });
}
