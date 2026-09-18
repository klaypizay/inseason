import { withSession, type Database } from "../db/repository";
import { runWeek, type WeekProvider } from "./week-provider";
export async function executeWeek(
  db: Database,
  token: string | undefined,
  id: string,
  provider: WeekProvider,
) {
  const context = await withSession(db, token, (r) =>
    r.week().claim(id, provider.name, provider.model),
  );
  if (!context) return;
  const result = await runWeek(provider, context, (n) =>
    withSession(db, token, (r) => r.week().attempt(id, n)),
  );
  try {
    await withSession(db, token, (r) =>
      r.week().finish(id, result.content, result.metrics, result.errorCode),
    );
  } catch {
    try {
      await withSession(db, token, (r) =>
        r.week().finish(id, null, result.metrics, "save_failed"),
      );
    } catch {}
  }
}
