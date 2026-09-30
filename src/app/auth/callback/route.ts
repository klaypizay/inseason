import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  authFlowClient,
  oauthVerifierCookie,
} from "../../../server/auth/signup-client";
import { issueSession } from "../../../server/auth/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const jar = await cookies();
  let signedIn = false;
  try {
    if (
      !url.searchParams.has("error") &&
      code &&
      code.length <= 2048 &&
      jar.get(oauthVerifierCookie)?.value
    ) {
      const client = await authFlowClient("oauth");
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (!error && data.session) {
        const logout = await client.auth.signOut({ scope: "local" });
        if (!logout.error && data.user?.email_confirmed_at) {
          await issueSession(data.user.id);
          signedIn = true;
        }
      }
    }
  } catch {
    // Provider details and tokens must never reach the response or logs.
  }
  jar.delete(oauthVerifierCookie);
  redirect(signedIn ? "/today" : "/login?oauth=failed");
}
