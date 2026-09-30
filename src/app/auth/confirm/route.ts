import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  signupClient,
  verifierCookie,
} from "../../../server/auth/signup-client";
import { issueSession } from "../../../server/auth/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  let confirmed = false;
  const jar = await cookies();
  try {
    if (
      !url.searchParams.has("error") &&
      code &&
      code.length <= 2048 &&
      jar.get(verifierCookie)?.value
    ) {
      const client = await signupClient();
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (!error && data.session && data.user?.email_confirmed_at) {
        const logout = await client.auth.signOut({ scope: "local" });
        if (!logout.error) {
          await issueSession(data.user.id);
          confirmed = true;
        }
      } else if (data.session) {
        await client.auth.signOut({ scope: "local" });
      }
    }
  } catch {
    // Do not expose the authorization code, provider details, or DB errors.
  }
  jar.delete(verifierCookie);
  redirect(confirmed ? "/setup" : "/signup?confirmation=failed");
}
