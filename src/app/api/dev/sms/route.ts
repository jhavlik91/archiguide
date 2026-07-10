import { NextResponse } from "next/server";
import { peekLastSms } from "@/lib/sms";

/**
 * Dev/test-only náhled do odchozích SMS (in-memory outbox). Slouží e2e testům
 * verifikace telefonu k získání kódu. V produkci vrací 404.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const to = new URL(request.url).searchParams.get("to");
  if (!to) {
    return NextResponse.json({ error: "missing_to" }, { status: 400 });
  }
  const sms = peekLastSms(to);
  if (!sms) {
    return NextResponse.json({ error: "no_sms" }, { status: 404 });
  }
  return NextResponse.json(sms);
}
