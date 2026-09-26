"use server";
import { z } from "zod";
import { database } from "../../server/db/runtime";
import { withSession } from "../../server/db/repository";
import { sessionToken } from "../../server/auth/session";
import {
  notionConnection,
  saveNotionConnection,
  type NotionConnection,
} from "../notion";

const ids = z.object({ weekId: z.uuid(), sessionId: z.uuid() });
const text = (content: string, bold = false) => [
  {
    type: "text",
    text: { content: content.slice(0, 2000) },
    annotations: { bold },
  },
];
export async function exportPracticeToNotion(input: unknown) {
  try {
    const { weekId, sessionId } = ids.parse(input);
    const view = await withSession(database, await sessionToken(), (r) =>
      r.week().get(weekId),
    );
    const plan = view.version?.content.practices?.find(
      (p) => p.sessionId === sessionId,
    );
    const session = view.context.sessions.find((s) => s.id === sessionId);
    if (!plan || !session)
      return { error: "Save this practice before exporting it." };
    const children = plan.blocks.flatMap((block, index) => [
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: text(
            `${index + 1}. ${block.title} · ${block.minutes} min`,
          ),
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: text(`Set up: ${block.setup}`) },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: text(`Coach: ${block.cues}`) },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: text(`Make it easier: ${block.simpler}`) },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: text(`Why it helps: ${block.purpose}`) },
      },
      { object: "block", type: "divider", divider: {} },
    ]);
    let connection = await notionConnection();
    const createPage = (current: NotionConnection) =>
      fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${current.accessToken}`,
          "Notion-Version": "2026-03-11",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parent: { type: "page_id", page_id: current.parentPageId },
          properties: { title: { type: "title", title: text(plan.title) } },
          children,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
    let response = await createPage(connection);
    if (response.status === 401) {
      const credentials = Buffer.from(
        `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`,
      ).toString("base64");
      const refreshed = await fetch("https://api.notion.com/v1/oauth/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: connection.refreshToken,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      const tokens = JSON.parse((await refreshed.text()).slice(0, 20_000)) as {
        access_token?: string;
        refresh_token?: string;
      };
      if (!refreshed.ok || !tokens.access_token || !tokens.refresh_token)
        return { error: "Reconnect Notion and try again." };
      connection = {
        ...connection,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      };
      await saveNotionConnection(connection);
      response = await createPage(connection);
    }
    const body = JSON.parse((await response.text()).slice(0, 20_000)) as {
      url?: string;
      message?: string;
    };
    if (!response.ok || !body.url)
      return { error: body.message ?? "Notion could not create the page." };
    return { url: body.url };
  } catch {
    return { error: "Connect Notion and try the export again." };
  }
}
