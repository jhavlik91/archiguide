import { NextResponse } from "next/server";
import { peekLastEmail } from "@/features/auth/email";

/**
 * Dev/test-only náhled do odchozích e-mailů (in-memory outbox). Slouží e2e
 * testům reset flow k získání odkazu. V produkci vrací 404.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const to = new URL(request.url).searchParams.get("to");
  if (!to) {
    return NextResponse.json({ error: "missing_to" }, { status: 400 });
  }
  const email = peekLastEmail(to);
  if (!email) {
    return NextResponse.json({ error: "no_email" }, { status: 404 });
  }
  return NextResponse.json(email);
}
