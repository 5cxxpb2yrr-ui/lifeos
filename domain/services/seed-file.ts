import type { LifeOSBackup } from "@/domain/contracts/database";
import {
  IMMUTABLE_SEED_SHA256,
  normalizeLegacySeed,
  validateLegacySeedSource,
} from "@/domain/services/legacy-seed";
import { explainSeedValidation, validateSeedBackup } from "@/domain/services/seed";

export type SeedParse =
  | { ok: true; backup: LifeOSBackup; kind: "flc-v5-source" | "lifeos-backup" }
  | { ok: false; reason: string };

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function parseSeedInput(input: ArrayBuffer | Uint8Array): Promise<SeedParse> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let parsed: unknown;

  try {
    parsed = JSON.parse(new TextDecoder("utf-8").decode(bytes));
  } catch {
    return { ok: false, reason: "The selected file is not valid JSON." };
  }

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    (parsed as Record<string, unknown>)._format === "FLC-v5"
  ) {
    if (!validateLegacySeedSource(parsed)) {
      return { ok: false, reason: "The FLC-v5 file is missing required sections." };
    }

    if ((await sha256Hex(bytes)) !== IMMUTABLE_SEED_SHA256) {
      return {
        ok: false,
        reason:
          "This FLC-v5 file does not match the immutable seed (SHA-256 mismatch). Use the original, unmodified seed file.",
      };
    }

    return {
      ok: true,
      backup: normalizeLegacySeed(parsed),
      kind: "flc-v5-source",
    };
  }

  if (validateSeedBackup(parsed)) {
    return { ok: true, backup: parsed, kind: "lifeos-backup" };
  }

  return { ok: false, reason: explainSeedValidation(parsed).reason };
}
