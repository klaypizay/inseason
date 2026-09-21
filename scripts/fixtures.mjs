// Stable synthetic IDs; never infer or match real player identities.
export const fixtureIds = [1, 2].map((n) => ({
  coach: `00000000-0000-4000-8000-00000000000${n}`,
  program: `10000000-0000-4000-8000-00000000000${n}`,
  team: `20000000-0000-4000-8000-00000000000${n}`,
  season: `30000000-0000-4000-8000-00000000000${n}`,
  player: `40000000-0000-4000-8000-00000000000${n}`,
  run: `50000000-0000-4000-8000-00000000000${n}`,
}));
export async function seedFixtures(
  q,
  coaches = fixtureIds.map((f) => f.coach),
) {
  for (const [i, f] of fixtureIds.entries()) {
    const actor = coaches[i];
    await q(
      "insert into coach.accounts(id) values($1) on conflict do nothing",
      [actor],
    );
    const old = await q("select owner_id from coach.programs where id=$1", [
      f.program,
    ]);
    if (old[0] && old[0].owner_id !== actor)
      throw new Error("Synthetic fixture already belongs to another account");
    await q(
      "insert into coach.programs(id,owner_id,name) values($1,$2,$3) on conflict do nothing",
      [f.program, actor, `Demo Program ${i + 1}`],
    );
    await q(
      "insert into coach.teams(id,program_id,name,created_by) values($1,$2,$3,$4) on conflict do nothing",
      [f.team, f.program, `Demo ${i === 0 ? "Cedar" : "Willow"}`, actor],
    );
    await q(
      "insert into coach.seasons(id,program_id,team_id,title,created_by) values($1,$2,$3,$4,$5) on conflict do nothing",
      [f.season, f.program, f.team, "Example season", actor],
    );
    await q(
      "insert into coach.players(id,program_id,alias,created_by) values($1,$2,$3,$4) on conflict do nothing",
      [f.player, f.program, `Player ${i === 0 ? "Cedar" : "Willow"}`, actor],
    );
    await q(
      "insert into coach.season_roster(program_id,season_id,player_id,created_by) values($1,$2,$3,$4) on conflict do nothing",
      [f.program, f.season, f.player, actor],
    );
    await q(
      "insert into coach.generation_runs(id,program_id,season_id,action,idempotency_key,context_version,created_by) values($1,$2,$3,'assessSeason',$1,1,$4) on conflict do nothing",
      [f.run, f.program, f.season, actor],
    );
  }
}
