import { z } from "zod";
import { migrationConnection } from "./connection.mjs";
import { seedFixtures } from "./fixtures.mjs";
const coaches = z
  .array(z.uuid())
  .length(2)
  .parse([process.env.SEED_COACH_A_ID, process.env.SEED_COACH_B_ID]);
if (coaches[0] === coaches[1])
  throw new Error("Use two different synthetic coach accounts");
const sql = migrationConnection();
try {
  await sql.begin((tx) =>
    seedFixtures(
      async (text, values) => Array.from(await tx.unsafe(text, values)),
      coaches,
    ),
  );
  console.log("Synthetic fixtures ready.");
} finally {
  await sql.end();
}
