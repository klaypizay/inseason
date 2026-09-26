import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { database } from "../../../../server/db/runtime";
import { withSession } from "../../../../server/db/repository";
import { sessionToken } from "../../../../server/auth/session";
import { createNotionState } from "../../../../server/notion";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const week = z.uuid().safeParse(request.nextUrl.searchParams.get("week"));
  if (!week.success)
    return NextResponse.redirect(new URL("/practice", request.url));
  await withSession(database, await sessionToken(), (r) =>
    r.week().get(week.data),
  );
  if (!process.env.NOTION_CLIENT_ID)
    return NextResponse.redirect(
      new URL(`/weeks/${week.data}?notion=unavailable`, request.url),
    );
  const state = await createNotionState(`/weeks/${week.data}`);
  const redirectUri = new URL("/api/notion/callback", request.url).toString();
  const url = new URL("https://api.notion.com/v1/oauth/authorize");
  url.searchParams.set("client_id", process.env.NOTION_CLIENT_ID ?? "");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("owner", "user");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return NextResponse.redirect(url);
}
