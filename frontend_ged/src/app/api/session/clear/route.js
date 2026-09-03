import { NextResponse } from "next/server";
import { clearAuthCookies } from "../../../../lib/authCookie";

/** Efface les cookies HttpOnly (non effaçables depuis le navigateur). */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
