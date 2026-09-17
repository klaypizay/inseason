import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { database } from "../db/runtime";
import { digest, revokeApplicationSession } from "../db/repository";
export const cookieName =
  process.env.NODE_ENV === "production"
    ? "__Host-season-coach"
    : "season-coach";
export async function sessionToken() {
  return (await cookies()).get(cookieName)?.value;
}
export async function issueSession(accountId: string) {
  const token = randomBytes(32).toString("hex");
  await database.transaction(async (q) => {
    await q(
      "insert into coach.accounts(id) values($1) on conflict(id) do nothing",
      [accountId],
    );
    await q("insert into coach.sessions(token_hash,account_id) values($1,$2)", [
      digest(token),
      accountId,
    ]);
  });
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 604800,
  });
}
export async function revokeSession() {
  const token = await sessionToken();
  await revokeApplicationSession(database, token);
  (await cookies()).delete(cookieName);
}
