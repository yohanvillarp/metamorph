/** Invariants: every migration, any stack. Highest layer — do not repeat these in pair rules. */
export const ALL_MIGRATION_RULES: string[] = [
  'Never delete or omit business logic, state, API calls, or user-visible behavior. Adapt APIs to the target runtime instead of dropping them.',
  'Never leave stub, TODO, empty, or placeholder root screens. The migrated app must show the same primary UI the source showed.',
  'Do not invent features, routes, or pages that were not in the source project.',
  'Public names are a contract: exported components, props, inputs, outputs, emits, store actions, and route paths. Wrappers import and pass them through — they do not rename them to look idiomatic.',
  'Deduce APIs from files on disk (and their imports). If a screen already exists, import it. Do not re-implement it in a router/bootstrap file.',
  'Keep existing tests, env examples, and README intent unless the target framework requires a mechanical rename.',
];
