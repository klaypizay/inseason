import "server-only";
import { cookies } from "next/headers";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const tokenCookie = "__Host-inseason-notion";
const stateCookie = "__Host-inseason-notion-state";

function key() {
  const value = process.env.NOTION_TOKEN_ENCRYPTION_KEY;
  if (!value) throw new Error("Notion export is not configured.");
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32) throw new Error("Invalid Notion encryption key.");
  return decoded;
}

function seal(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}

function open(value: string) {
  const data = Buffer.from(value, "base64url");
  if (data.length < 29) throw new Error("Invalid Notion connection.");
  const decipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([
    decipher.update(data.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}

const secure = process.env.NODE_ENV === "production";
export async function notionConnected() {
  const value = (await cookies()).get(tokenCookie)?.value;
  if (!value) return false;
  try {
    open(value);
    return true;
  } catch {
    return false;
  }
}
export type NotionConnection = {
  accessToken: string;
  refreshToken: string;
  parentPageId: string;
};
export async function notionConnection(): Promise<NotionConnection> {
  const value = (await cookies()).get(tokenCookie)?.value;
  if (!value) throw new Error("Connect Notion before exporting.");
  return JSON.parse(open(value)) as NotionConnection;
}
export async function createNotionState(returnTo: string) {
  const nonce = randomBytes(24).toString("base64url");
  (await cookies()).set(
    stateCookie,
    seal(JSON.stringify({ nonce, returnTo, expires: Date.now() + 600_000 })),
    { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 600 },
  );
  return nonce;
}
export async function consumeNotionState(nonce: string) {
  const store = await cookies();
  const value = store.get(stateCookie)?.value;
  store.delete(stateCookie);
  if (!value) throw new Error("Notion connection expired.");
  const state = JSON.parse(open(value)) as {
    nonce: string;
    returnTo: string;
    expires: number;
  };
  const expected = Buffer.from(state.nonce);
  const received = Buffer.from(nonce);
  if (
    state.expires < Date.now() ||
    expected.length !== received.length ||
    !timingSafeEqual(expected, received) ||
    !state.returnTo.startsWith("/weeks/")
  )
    throw new Error("Invalid Notion connection state.");
  return state.returnTo;
}
export async function saveNotionConnection(connection: NotionConnection) {
  (await cookies()).set(tokenCookie, seal(JSON.stringify(connection)), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 2_592_000,
  });
}
