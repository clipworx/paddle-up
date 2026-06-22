import { NextResponse } from "next/server";
import { casUpdate } from "@/lib/sessionCas";
import { applyCompleteMatch } from "@/lib/sessionTransitions";

type Params = { params: Promise<{ code: string }> };

export async function POST(req: Request, { params }: Params) {
  const { code } = await params;
  const normalized = code.trim().toUpperCase();

  let body: { courtIndex?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const courtIndex = typeof body.courtIndex === "number" ? body.courtIndex : NaN;
  if (!Number.isInteger(courtIndex)) {
    return NextResponse.json({ error: "court_index_required" }, { status: 400 });
  }

  // No player-identity check on purpose — anyone viewing this court (including
  // a shared court-side screen with no notion of "which player am I") can
  // clear it. Worst case is an early clear; the queue simply re-forms.
  const result = await casUpdate(normalized, (state) => applyCompleteMatch(state, courtIndex));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ state: result.state, version: result.version });
}
