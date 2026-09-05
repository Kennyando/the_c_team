// Bedrock invocation IAM resources, plus a synth-time guard that a cross-region inference-profile
// id matches the deploy region.
//
// Deliberately narrow scope: plain foundation-model ids (e.g. "amazon.nova-micro-v1:0") and the
// current *system-defined* cross-region inference profiles, whose id carries a geo prefix
// ("us." / "eu." / "apac." / "us-gov."). It does NOT model application inference profiles
// (arn:...:inference-profile/<uuid>, account-created) or any other model/profile form — those
// need their own ARN handling. Keep this helper for these two cases only.

const GEO_MATCHERS: Record<string, (region: string) => boolean> = {
  "us-gov": (r) => r.startsWith("us-gov-"),
  us: (r) => r.startsWith("us-") && !r.startsWith("us-gov-"),
  eu: (r) => r.startsWith("eu-"),
  apac: (r) => r.startsWith("ap-"),
};

/** The geo prefix of a system-defined cross-region inference-profile id, or null for a plain model id. */
export function inferenceProfileGeo(modelOrProfileId: string): string | null {
  const m = modelOrProfileId.match(/^(us-gov|us|eu|apac)\.(.+)$/);
  return m ? m[1] : null;
}

/** The inference-profile geo prefix a given region belongs to, or null if none applies. */
export function geoForRegion(region: string): string | null {
  if (region.startsWith("us-gov-")) return "us-gov";
  if (region.startsWith("us-")) return "us";
  if (region.startsWith("eu-")) return "eu";
  if (region.startsWith("ap-")) return "apac";
  return null;
}

/**
 * Throw if `modelOrProfileId` is a cross-region inference profile whose geo doesn't match
 * `region`. A no-op for a plain model id. `region` must already be resolved (the caller skips this
 * when it isn't) — `bin/app.ts` always sets a concrete region.
 */
export function assertModelRegionMatch(region: string, modelOrProfileId: string, contextKey: string): void {
  const geo = inferenceProfileGeo(modelOrProfileId);
  if (!geo) return;
  if (GEO_MATCHERS[geo](region)) return;

  const suggested = geoForRegion(region);
  const fix = suggested
    ? `set -c ${contextKey}=${suggested}.<model-id> to match, or deploy to a ${geo}-* region`
    : `deploy to a ${geo}-* region, or set -c ${contextKey}=<single-region-model-id>`;
  throw new Error(
    `${contextKey} "${modelOrProfileId}" is a "${geo}." cross-region inference profile, but the ` +
      `deploy region is "${region}". Bedrock/IAM would fail at runtime — ${fix}.`,
  );
}

/**
 * `bedrock:InvokeModel` resource ARNs for a model id or system-defined cross-region
 * inference-profile id.
 *
 * - plain model id  -> the one region-scoped foundation-model ARN (no account segment).
 * - `<geo>.` profile -> the account-scoped inference-profile ARN in `region`, PLUS the
 *   region-wildcarded base-model ARN (the profile routes to regional copies of that model, so the
 *   role must be allowed to invoke them). Still scoped to the single base model id.
 */
export function bedrockInvokeResources(
  partition: string,
  region: string,
  account: string,
  modelOrProfileId: string,
): string[] {
  const geo = inferenceProfileGeo(modelOrProfileId);
  if (!geo) {
    return [`arn:${partition}:bedrock:${region}::foundation-model/${modelOrProfileId}`];
  }
  const baseModelId = modelOrProfileId.slice(geo.length + 1);
  return [
    `arn:${partition}:bedrock:${region}:${account}:inference-profile/${modelOrProfileId}`,
    `arn:${partition}:bedrock:*::foundation-model/${baseModelId}`,
  ];
}
