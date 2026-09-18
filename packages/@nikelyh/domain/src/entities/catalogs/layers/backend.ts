/** Rules for any backend → backend migration. */
export const BACKEND_LAYER_RULES: string[] = [
  'Preserve every HTTP route, method, path, and status-code contract unless the target framework requires an equivalent mapping.',
  'Keep middleware/filter order, validation, auth, and error handling. Do not drop them because decorators or plugins changed.',
  'Keep env-driven config (ports, secrets, database URLs). Do not hardcode values that lived in environment files.',
  'Preserve request/response body shapes and exported application/bootstrap entry so the process still listens.',
];
