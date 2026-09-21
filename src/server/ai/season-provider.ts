import {
  type GenerationAction,
  type PlanningContext,
  type Assessment,
  type Roadmap,
  validateGenerated,
  InvalidGeneration,
} from "../../domain/planning";
export type ProviderResult = {
  value: unknown;
  inputTokens: number;
  outputTokens: number;
};
export interface SeasonProvider {
  name: string;
  model: string;
  generate(
    action: GenerationAction,
    context: PlanningContext,
    repair: boolean,
    signal: AbortSignal,
  ): Promise<ProviderResult>;
}
export class ProviderFailure extends Error {
  constructor(
    public code: string,
    public retryable = false,
  ) {
    super(code);
  }
}
export const fixtureSeasonProvider: SeasonProvider = {
  name: "fixture",
  model: "season-fixture-v2",
  async generate(action, context) {
    const goals = [
      {
        description: "Develop shared fundamentals and team habits.",
        successCriteria:
          "Coach can describe progress using practice observations.",
        evidenceIds: [],
      },
    ];
    const assessment: Assessment = {
      strengths: [],
      gaps: [
        {
          text: "Current team strengths and gaps need observation.",
          topic: "skill",
          confidence: "Unknown",
          evidenceIds: [],
        },
      ],
      questions: [
        "What can players demonstrate consistently in a simple practice task?",
      ],
      assumptions: [
        "This prewritten example offers general teaching ideas. Check what fits your players at practice.",
      ],
      goals,
    };
    const roadmap: Roadmap = {
      rationale:
        "Build fundamentals, revisit them in simple games, and review what the coach observes.",
      assumptions: [
        "Weekly emphases are draft recommendations. No practices or attendance are assumed.",
      ],
      phases: context.phases.map((p) => ({
        phaseId: p.id,
        rationale:
          "Use this coach-selected phase for age-appropriate fundamentals and review.",
        goals,
      })),
      weeks: context.weeks.map((w) => ({
        sequence: w.sequence,
        emphasis:
          "Revisit a fundamental through a simple small-sided activity.",
        checkpoint:
          "Record what players can demonstrate and what needs another explanation.",
        evidenceIds: [],
      })),
    };
    return {
      value: action === "assessSeason" ? assessment : roadmap,
      inputTokens: 0,
      outputTokens: 0,
    };
  },
};
export type RunMetrics = {
  attempts: number;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
};
export async function runGeneration(
  provider: SeasonProvider,
  action: GenerationAction,
  context: PlanningContext,
  onAttempt: (attempt: number) => Promise<void>,
  timeoutMs = 60000,
) {
  return runStructuredGeneration(
    (repair, signal) => provider.generate(action, context, repair, signal),
    (value) => validateGenerated(action, value, context),
    onAttempt,
    timeoutMs,
  );
}
export async function runStructuredGeneration<T>(
  generate: (repair: boolean, signal: AbortSignal) => Promise<ProviderResult>,
  validate: (value: unknown) => T,
  onAttempt: (attempt: number) => Promise<void>,
  timeoutMs = 60000,
) {
  const metrics: RunMetrics = {
    attempts: 0,
    inputTokens: 0,
    outputTokens: 0,
    latencyMs: 0,
  };
  const started = Date.now();
  let transient = false,
    repair = false;
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      metrics.attempts = attempt;
      await onAttempt(attempt);
      try {
        const signal = AbortSignal.timeout(timeoutMs);
        // Race enforces the deadline even if an adapter ignores cancellation.
        const response = await new Promise<ProviderResult>(
          (resolve, reject) => {
            const abort = () => reject(new ProviderFailure("timeout", true));
            signal.addEventListener("abort", abort, { once: true });
            generate(repair, signal)
              .then(resolve, reject)
              .finally(() => signal.removeEventListener("abort", abort));
          },
        );
        metrics.inputTokens += response.inputTokens;
        metrics.outputTokens += response.outputTokens;
        const content = validate(response.value);
        return {
          content,
          metrics: { ...metrics, latencyMs: Date.now() - started },
        };
      } catch (error) {
        if (
          error instanceof InvalidGeneration &&
          error.code === "invalid_output" &&
          !repair &&
          attempt < 3
        ) {
          repair = true;
          continue;
        }
        if (
          error instanceof ProviderFailure &&
          error.retryable &&
          !transient &&
          attempt < 3
        ) {
          transient = true;
          continue;
        }
        throw error;
      }
    }
    throw new ProviderFailure("retry_limit");
  } catch (error) {
    return {
      errorCode:
        error instanceof InvalidGeneration || error instanceof ProviderFailure
          ? error.code
          : "provider_unavailable",
      metrics: { ...metrics, latencyMs: Date.now() - started },
    };
  }
}
