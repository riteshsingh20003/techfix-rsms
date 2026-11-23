const fs = require('fs');
const path = require('path');
const root = __dirname;

let ts;
for (const base of [path.join(root, 'server'), root, '/opt/nvm/versions/node/v22.16.0/lib/node_modules']) {
  try { ts = require(require.resolve('typescript', { paths: [base] })); break; } catch { /* check next installation location */ }
}
if (!ts) {
  console.error('TypeScript is not installed. Run npm install --prefix server first.');
  process.exit(2);
}

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) files.push(file);
  }
}
walk(path.join(root, 'server/src'));
walk(path.join(root, 'client/src'));

const syntaxErrors = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const result = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX }
  });
  for (const diagnostic of result.diagnostics || []) {
    syntaxErrors.push({ file: path.relative(root, file), code: diagnostic.code, message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ') });
  }
}

const jsonErrors = [];
for (const file of ['package.json', 'server/package.json', 'client/package.json', 'server/tsconfig.json', 'client/tsconfig.json']) {
  try { JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); }
  catch (error) { jsonErrors.push({ file, error: error.message }); }
}

const missingImports = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const expression = /(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g;
  let match;
  while ((match = expression.exec(source))) {
    const target = path.resolve(path.dirname(file), match[1]);
    const recognizedExtension = /\.(ts|tsx|js|jsx|css|json)$/.test(target);
    const candidates = recognizedExtension
      ? [target]
      : ['.ts', '.tsx', '.js', '.jsx', '.css', '.json'].map((extension) => target + extension).concat([path.join(target, 'index.ts'), path.join(target, 'index.tsx')]);
    if (!candidates.some((candidate) => fs.existsSync(candidate))) missingImports.push({ file: path.relative(root, file), specifier: match[1] });
  }
}

const riskFindings = [];
const patterns = [
  [/Admin@12345/g, 'Hard-coded demo administrator password'],
  [/Math\.random\s*\(/g, 'Non-cryptographic random source'],
  [/localStorage\.setItem\(['"]techfix_token/g, 'JWT stored in localStorage'],
  [/DELETE\s+FROM\s+repairs/i, 'Repair history can be permanently deleted'],
  [/paymentStatus\s*:\s*['"]paid['"]/g, 'Payment status may be manually asserted without a payment ledger'],
  [/localStorage\.setItem\([^,]*(token|session)/i, 'Session credential stored in browser local storage'],
  [/window\.confirm\s*\(/g, 'Unreviewed native confirmation flow'],
  [/window\.alert\s*\(/g, 'Unreviewed native alert flow'],
  [/dangerouslySetInnerHTML/g, 'Raw HTML injected into the React DOM'],
  [/document\.write\s*\(/g, 'Document markup written dynamically'],
  [/\beval\s*\(/g, 'Dynamic JavaScript evaluation']
];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  for (const [pattern, description] of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) riskFindings.push({ file: path.relative(root, file), finding: description });
  }
}

const requiredGuards = [
  ['server/src/middleware/auth.ts', 'tokenVersion', 'Database-backed token revocation guard'],
  ['server/src/middleware/security.ts', 'requireCsrf', 'CSRF token verification'],
  ['server/src/routes/repair.routes.ts', "requireRole('admin')", 'Admin-only payment route'],
  ['server/src/models/repair.model.ts', 'randomBytes(16)', 'Cryptographically strong repair reference'],
  ['server/src/models/repair.model.ts', 'FOR UPDATE', 'Row locks for state/payment consistency'],
  ['server/src/models/repair.model.ts', 'findPublicStatus', 'Separate public tracking DTO'],
  ['server/src/db/migrations/001_initial_schema.sql', 'CREATE TABLE IF NOT EXISTS payments', 'Payment ledger schema'],
  ['server/src/db/migrate.ts', 'schema_migrations', 'Migration history table'],
  ['server/src/db/migrate.ts', 'pg_advisory_lock', 'Concurrent migration lock'],
  ['server/src/utils/csrf.ts', 'createHmac', 'Signed CSRF double-submit token'],
  ['server/src/middleware/security.ts', '__Host-techfix_session', 'Host-only production session cookie'],
  ['server/src/middleware/security.ts', 'SameSite=Strict', 'Strict same-site session cookie'],
  ['client/src/lib/api.ts', '__Host-techfix_csrf', 'Production CSRF cookie read by the same-origin client'],
  ['server/src/models/repair.model.ts', 'sameRequest', 'Payment idempotency payload consistency'],
  ['server/src/validators/schemas.ts', 'idempotencyKey', 'Payment idempotency input validation'],
  ['server/src/validators/schemas.ts', 'max(100)', 'Bounded pagination page size'],
  ['server/src/utils/pagination.ts', 'pageWindow', 'Clamped pagination window helper'],
  ['server/src/models/client.model.ts', 'LIMIT $3 OFFSET $4', 'Customer list result pagination'],
  ['server/src/models/service.model.ts', 'LIMIT $3 OFFSET $4', 'Service list result pagination'],
  ['server/src/models/repair.model.ts', 'LIMIT $4 OFFSET $5', 'Repair list result pagination'],
  ['server/src/utils/origin-policy.ts', 'isOriginAllowed', 'Exact Origin policy including production login requests'],
  ['client/src/components/Modal.tsx', 'aria-modal="true"', 'Accessible modal dialog semantics'],
  ['client/src/components/Modal.tsx', "event.key === 'Escape'", 'Accessible modal Escape handling'],
  ['client/src/components/Pagination.tsx', 'aria-label="Pagination"', 'Accessible pagination controls']
];
const missingGuards = requiredGuards.filter(([file, fragment]) => !fs.readFileSync(path.join(root, file), 'utf8').includes(fragment)).map(([file, , description]) => ({ file, missing: description }));

const result = { typescriptFiles: files.length, syntaxErrors, jsonErrors, missingRelativeImports: missingImports, riskFindings, missingArchitectureGuards: missingGuards };
console.log(JSON.stringify(result, null, 2));
if (syntaxErrors.length || jsonErrors.length || missingImports.length || riskFindings.length || missingGuards.length) process.exitCode = 1;
