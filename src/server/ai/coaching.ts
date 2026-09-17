import { z } from "zod";
export const actions = [
  "assessSeason",
  "draftRoadmap",
  "draftWeek",
  "draftPractice",
  "proposeMemory",
  "proposeAdaptation",
] as const;
export type CoachingAction = (typeof actions)[number];
const contextSchema = z
  .object({
    programId: z.uuid(),
    seasonId: z.uuid(),
    contextVersion: z.number().int().positive(),
    sourceIds: z.array(z.uuid()).max(100),
  })
  .strict();
const requestSchema = z
  .object({
    context: contextSchema,
    schemaVersion: z.literal(1),
    idempotencyKey: z.uuid(),
  })
  .strict();
export type CoachingRequest = z.infer<typeof requestSchema>;
export type CoachingDraft<A extends CoachingAction> = {
  action: A;
  status: "draft";
  schemaVersion: 1;
  content: {
    kind: "foundation-placeholder";
    message: string;
    confidence: "Unknown";
    evidenceIds: string[];
  };
  metadata: {
    provider: string;
    model: string;
    promptVersion: string;
    contextVersion: number;
    idempotencyKey: string;
    usage: { inputTokens: number; outputTokens: number };
  };
};
export type CoachingService = {
  [A in CoachingAction]: (
    request: CoachingRequest,
  ) => Promise<CoachingDraft<A>>;
};
const messages: Record<CoachingAction, string> = {
  assessSeason:
    "No assessment yet. Add coach reports before assessing the season.",
  draftRoadmap: "No roadmap yet. Season dates and goals are needed.",
  draftWeek: "No weekly plan yet. Accept a roadmap first.",
  draftPractice: "No practice yet. Duration and resources are needed.",
  proposeMemory: "No memory proposed. Dated source observations are needed.",
  proposeAdaptation:
    "No adaptation proposed. An accepted plan and evidence are needed.",
};
// Call only with context loaded through the authorized repository. No I/O or persistence.
async function fixture<A extends CoachingAction>(
  action: A,
  input: CoachingRequest,
): Promise<CoachingDraft<A>> {
  const request = requestSchema.parse(input);
  return {
    action,
    status: "draft",
    schemaVersion: 1,
    content: {
      kind: "foundation-placeholder",
      message: messages[action],
      confidence: "Unknown",
      evidenceIds: [],
    },
    metadata: {
      provider: "fixture",
      model: "fixture-v1",
      promptVersion: "m0-v1",
      contextVersion: request.context.contextVersion,
      idempotencyKey: request.idempotencyKey,
      usage: { inputTokens: 0, outputTokens: 0 },
    },
  };
}
export const fixtureCoach: CoachingService = {
  assessSeason: (r) => fixture("assessSeason", r),
  draftRoadmap: (r) => fixture("draftRoadmap", r),
  draftWeek: (r) => fixture("draftWeek", r),
  draftPractice: (r) => fixture("draftPractice", r),
  proposeMemory: (r) => fixture("proposeMemory", r),
  proposeAdaptation: (r) => fixture("proposeAdaptation", r),
};
