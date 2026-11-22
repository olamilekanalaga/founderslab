import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import ts from "typescript";

const root = process.cwd();
function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(
    (entry) => {
      const file = path.posix.join(dir, entry.name);
      return entry.isDirectory()
        ? sourceFiles(file)
        : /\.tsx?$/.test(file)
          ? [file]
          : [];
    },
  );
}
const files = ["app", "components", "features", "lib", "server"].flatMap(
  sourceFiles,
);
const sources = new Map(
  files.map((file) => [
    file,
    ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    ),
  ]),
);
function runtimeDependencies(file: string): string[] {
  const specs: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      if (clause?.isTypeOnly) return;
      if (
        clause?.namedBindings &&
        ts.isNamedImports(clause.namedBindings) &&
        !clause.name &&
        clause.namedBindings.elements.every((e) => e.isTypeOnly)
      )
        return;
      specs.push((node.moduleSpecifier as ts.StringLiteral).text);
    } else if (
      ts.isExportDeclaration(node) &&
      !node.isTypeOnly &&
      node.moduleSpecifier
    ) {
      specs.push((node.moduleSpecifier as ts.StringLiteral).text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specs.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sources.get(file)!);
  return specs.map((spec) => {
    if (!spec.startsWith("@/") && !spec.startsWith(".")) return spec;
    const base = spec.startsWith("@/")
      ? spec.slice(2)
      : path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
    const resolved = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}/index.ts`,
      `${base}/index.tsx`,
    ].find(
      (candidate) =>
        sources.has(candidate) ||
        (existsSync(candidate) &&
          !candidate.endsWith(".ts") &&
          !candidate.endsWith(".tsx")),
    );
    assert.ok(resolved, `Unresolved runtime import ${file} -> ${spec}`);
    return resolved;
  });
}
const graph = new Map(files.map((file) => [file, runtimeDependencies(file)]));
test("client dependency graphs cannot import server code, fixtures, or Node secrets", () => {
  for (const file of files.filter((f) =>
    /^\s*["']use client["'];/.test(readFileSync(f, "utf8")),
  )) {
    const seen = new Set<string>();
    function check(current: string, chain: string[]) {
      if (seen.has(current)) return;
      seen.add(current);
      assert.ok(
        !/^(server\/|tests\/|node:|@prisma\/|pg$|next\/headers$|server-only$)/.test(
          current,
        ),
        chain.join(" -> "),
      );
      for (const next of graph.get(current) || [])
        check(next, [...chain, next]);
    }
    check(file, [file]);
  }
});
test("application runtime imports have no circular dependencies", () => {
  const checked = new Set<string>();
  function check(file: string, stack: string[]) {
    assert.ok(!stack.includes(file), [...stack, file].join(" -> "));
    if (checked.has(file)) return;
    for (const next of graph.get(file) || [])
      if (graph.has(next)) check(next, [...stack, file]);
    checked.add(file);
  }
  for (const file of files) check(file, []);
});
test("Next server entry points and HTTP handlers are explicitly server-only", () => {
  for (const file of [
    "server/auth/index.ts",
    "server/auth/session.ts",
    "server/db/index.ts",
    "server/http.ts",
    "server/services/space-managers.ts",
    ...files.filter((f) => f.startsWith("server/handlers/")),
  ]) {
    assert.match(readFileSync(file, "utf8"), /import "server-only";/, file);
  }
});
const manifest = JSON.parse(
  readFileSync("docs/architecture/security-invariants.json", "utf8"),
) as {
  functions: { file: string; name: string; sha256: string }[];
  database: { file: string; sha256: string }[];
};
const digest = (input: string | Buffer) =>
  createHash("sha256").update(input).digest("hex");
const reviewedChanges = JSON.parse(
  readFileSync("docs/v4/security-changes.json", "utf8"),
) as {
  file: string;
  name: string;
  originalSha256: string;
  sha256: string;
  reason: string;
}[];
test("authentication, manager permissions and request implementations match reviewed baselines", () => {
  const printer = ts.createPrinter({ removeComments: true });
  for (const entry of manifest.functions) {
    const source = sources.get(entry.file)!;
    const declaration = source.statements.find(
      (node) =>
        ts.isFunctionDeclaration(node) && node.name?.text === entry.name,
    );
    assert.ok(declaration, `${entry.file} ${entry.name}`);
    const reviewed = reviewedChanges.find(
      (change) => change.file === entry.file && change.name === entry.name,
    );
    if (reviewed) {
      assert.equal(reviewed.originalSha256, entry.sha256);
      assert.ok(reviewed.reason.length > 20);
    }
    assert.equal(
      digest(printer.printNode(ts.EmitHint.Unspecified, declaration, source)),
      reviewed?.sha256 || entry.sha256,
      `${entry.file} ${entry.name}`,
    );
  }
});
test("Prisma schema and ordered historical migration files remain byte-identical", () => {
  for (const entry of manifest.database) {
    assert.ok(existsSync(entry.file), entry.file);
    assert.equal(digest(readFileSync(entry.file)), entry.sha256, entry.file);
  }
  const sql = readdirSync("prisma/migrations", { recursive: true })
    .filter((f) => String(f).endsWith(".sql"))
    .map((f) => `prisma/migrations/${f}`)
    .sort();
  assert.deepEqual(
    sql,
    manifest.database
      .map((e) => e.file)
      .filter((f) => f.endsWith(".sql"))
      .sort(),
  );
});

test("the refactor branch cannot trigger an automatic Vercel deployment", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.equal(
    config.git.deploymentEnabled["refactor/feature-architecture"],
    false,
  );
});
