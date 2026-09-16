import type {
  LedgerInput,
  Origin,
  Warrant,
  DiagnosticityEntry,
  Tree2Extension,
  Tree3Extension,
  Tree4Extension,
} from '../src/index.js';
import { SCHEMA_VERSION } from '../src/index.js';
import type { RetrievedOrigin, GradingOutput, DiagnosticityOutput, RivalHypothesis } from './types.js';
import type { ClassificationResult } from './classify.js';
import { detectRetractionOrCorrection } from './grade.js';
import { assertNoBlockedOrigins } from './source-policy.js';

export interface AssembleLedgerInput {
  claim: string;
  classification: ClassificationResult;
  origins: RetrievedOrigin[];
  grades: GradingOutput[];
  diagnostics: DiagnosticityOutput[];
  rivals: RivalHypothesis[];
  adversarialStatus: 'survived' | 'untested';
  steelmanPerformed: boolean;
  steelmanRevisionOccurred: boolean;
  extraordinaryClusterSurvivedAdversarialTesting: boolean | null;
}

/**
 * FR-033: builds a LedgerInput matching 001's schema exactly. Correctness is
 * proven not by re-implementing 001's own validation here (that would be a
 * second copy to keep in sync) but by the fact that TypeScript's type
 * checker rejects this function if its return value doesn't structurally
 * match LedgerInput — and assemble-ledger.test.ts additionally calls 001's
 * real evaluate() on the result to prove it's accepted with no
 * refusalReason (SC-004), which is the actual guarantee that matters.
 */
export function assembleLedger(input: AssembleLedgerInput): LedgerInput {
  // The hard gate. Downstream of every path that can introduce an origin —
  // search results, a hand-written manual-run transcript, any future importer —
  // so the guarantee holds regardless of who supplied the source. Filtering at
  // discovery is the cheap path; this is the one that makes it a guarantee.
  assertNoBlockedOrigins(input.origins.map((o) => o.id));

  const origins: Origin[] = input.origins.map((o) => {
    const retraction = o.content ? detectRetractionOrCorrection(o.content) : { retracted: false, noted: false };
    return {
      id: o.id,
      retrievalStatus: o.content === null ? 'could_not_retrieve' : 'retrieved',
      retracted: retraction.retracted,
      correctedFormOfId: null,
    };
  });

  const warrants: Warrant[] = input.origins.map((o, i) => {
    const grade = input.grades[i];
    if (!grade) {
      throw new Error(`assembleLedger: no grading output for origin ${o.id}`);
    }
    return {
      originId: o.id,
      startingGrade: grade.startingGrade,
      firedTriggers: grade.firedTriggers,
      interestedParty: grade.interestedParty,
      partyControlledCreationAfterStakesVisible: grade.partyControlledCreationAfterStakesVisible,
      sourceReliabilityGrade: grade.sourceReliabilityGrade,
      channelKeys: { data: null, method: null, institution: null, motive: null },
    };
  });

  const diagnosticityEntries: DiagnosticityEntry[] = [];
  input.origins.forEach((o, i) => {
    const diag = input.diagnostics[i];
    if (!diag) {
      throw new Error(`assembleLedger: no diagnosticity output for origin ${o.id}`);
    }
    diagnosticityEntries.push({ lineOriginId: o.id, against: 'claim', mark: diag.markAgainstClaim });
    for (const [rivalId, mark] of Object.entries(diag.marksAgainstRivals)) {
      diagnosticityEntries.push({ lineOriginId: o.id, against: { rivalId }, mark });
    }
  });

  const rivals = input.rivals.map((r) => ({
    id: r.id,
    description: r.description,
    rebutted: false,
    plausibilityRelativeToClaim: r.plausibilityRelativeToClaim,
  }));

  return {
    schemaVersion: SCHEMA_VERSION,
    claimRestatement: input.claim,
    classification: {
      primary: input.classification.primary,
      confidence: input.classification.confidence,
      alternative: input.classification.alternative,
    },
    screens: {
      falsifiability: 'pass',
      priorPlausibility: input.classification.isExtraordinary ? 'extraordinary' : 'ordinary',
    },
    origins,
    warrants,
    rivals,
    diagnosticityEntries,
    adversarialStatus: input.adversarialStatus,
    silenceFinding: 'none',
    // Reported by the adversarial step itself rather than inferred from
    // adversarialStatus: 'untested' covers both "no test was possible" and
    // "the test ran and found something", so it cannot stand in for whether a
    // steelman happened.
    steelman: { performed: input.steelmanPerformed, revisionOccurred: input.steelmanRevisionOccurred },
    extraordinaryClusterSurvivedAdversarialTesting: input.extraordinaryClusterSurvivedAdversarialTesting,
    treeExtension: buildTreeExtension(input.classification),
  };
}

/**
 * MVP limitation, tracked in PROJECT-TRACKER.md: only simple_factual claims
 * (treeExtension: null) get full judgment depth. Non-simple-factual claims
 * get an honestly conservative placeholder rather than a confident-looking
 * fabrication, so 001's engine caps them appropriately.
 *
 * A real bug lived here until caught by direct testing (not by the existing
 * test suite, which never exercised complex_system): this function fell
 * through to `return null` for complex_system claims, but Tree 4 requires a
 * Tree4Extension — a null treeExtension makes evaluate() refuse outright
 * rather than compute a band, violating SC-004. Fixed by giving
 * complex_system the same honest-placeholder treatment as causal/predictive,
 * via Tree 4's irreducible branch (which correctly produces Unresolvable,
 * not a fabricated band).
 */
function buildTreeExtension(classification: ClassificationResult): Tree2Extension | Tree3Extension | Tree4Extension | null {
  if (classification.primary === 'causal') {
    const conservative: Tree2Extension = {
      underlyingFactualBand: 'contested',
      temporalityFinding: 'absent',
      discriminatingCriterionMet: false,
      supportiveCriteriaCount: 0,
    };
    return conservative;
  }
  if (classification.primary === 'predictive') {
    const conservative: Tree3Extension = { meetsEstablishedShapedConditions: false };
    return conservative;
  }
  if (classification.primary === 'complex_system') {
    const conservative: Tree4Extension = {
      decomposable: false,
      whyNoHonestBand:
        'MVP limitation: this pipeline does not yet decompose complex-system claims into independently-assessable sub-claims (tracked in PROJECT-TRACKER.md).',
      evidenceThatWouldChangeIt:
        'A decomposition step that identifies genuinely independent sub-claims and evaluates each on its own tree.',
    };
    return conservative;
  }
  return null;
}
