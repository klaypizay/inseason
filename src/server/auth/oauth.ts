"use server";
import { redirect } from "next/navigation";
import { authFlowClient, authRedirectUrl } from "./signup-client";

export async function signInWithGoogle(
  _state: { error: string },
  form: FormData,
) {
  if (form.get("adult") !== "on")
    return { error: "Confirm you are an adult coach before continuing." };
  let destination: string;
  let stage = "oauth-client";
  try {
    const client = await authFlowClient("oauth");
    stage = "callback-url";
    const redirectTo = authRedirectUrl("/auth/callback");
    stage = "oauth-request";
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });
    if (error || !data.url) throw new Error("OAuth unavailable");
    stage = "authorization-url-validation";
    const url = new URL(data.url);
    const provider = new URL(process.env.SUPABASE_URL!);
    if (url.origin !== provider.origin || url.pathname !== "/auth/v1/authorize")
      throw new Error("Unexpected authorization destination");
    destination = url.toString();
  } catch {
    console.error(JSON.stringify({ event: "google_sign_in_failed", stage }));
    return {
      error:
        "Google sign-in is unavailable right now. You can still use email and password.",
    };
  }
  redirect(destination);
}
