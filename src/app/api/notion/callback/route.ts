import { NextRequest, NextResponse } from "next/server";
import {
  consumeNotionState,
  saveNotionConnection,
} from "../../../../server/notion";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state)
    return NextResponse.redirect(
      new URL("/practice?notion=failed", request.url),
    );
  try {
    const returnTo = await consumeNotionState(state);
    const credentials = Buffer.from(
      `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`,
    ).toString("base64");
    const response = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: new URL("/api/notion/callback", request.url).toString(),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const body = JSON.parse((await response.text()).slice(0, 20_000)) as {
      access_token?: string;
      refresh_token?: string;
      duplicated_template_id?: string | null;
    };
    if (
      !response.ok ||
      !body.access_token ||
      !body.refresh_token ||
      !body.duplicated_template_id
    )
      throw new Error("Notion authorization failed.");
    await saveNotionConnection({
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      parentPageId: body.duplicated_template_id,
    });
    return NextResponse.redirect(
      new URL(`${returnTo}?notion=connected`, request.url),
    );
  } catch {
    return NextResponse.redirect(
      new URL("/practice?notion=failed", request.url),
    );
  }
}
