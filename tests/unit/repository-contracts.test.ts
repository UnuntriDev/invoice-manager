import { readFileSync } from "fs";
import path from "path";

function repositoryFile(fileName: string): string {
  return readFileSync(path.join(process.cwd(), fileName), "utf8");
}

describe("repository deployment and data integrity contracts", () => {
  it("keeps database-enforced category uniqueness and stable document indexes", () => {
    const schema = repositoryFile("prisma/schema.prisma");

    expect(schema).toContain("@@unique([parentScope, nameNormalized]");
    expect(schema).toContain("@@index([status, issueDate, id])");
    expect(schema).toContain("@@index([status, dueDate, id])");
    expect(schema).toContain("@@index([status, createdAt, id])");
  });

  it("keeps secrets and local state outside the Docker build context", () => {
    const dockerIgnore = repositoryFile(".dockerignore");

    for (const ignoredPath of [".git", ".env", "uploads", "backups"]) {
      expect(dockerIgnore.split(/\r?\n/)).toContain(ignoredPath);
    }
  });

  it("keeps migrations separate and the runtime standalone with a healthcheck", () => {
    const dockerfile = repositoryFile("Dockerfile");
    const productionCompose = repositoryFile("docker-compose.production.yml");

    expect(dockerfile).toContain("FROM node:22-alpine AS base");
    expect(dockerfile).toContain("/app/.next/standalone");
    expect(dockerfile).toContain("HEALTHCHECK");
    expect(dockerfile).toContain('CMD ["node", "server.js"]');
    expect(productionCompose).toContain("target: migrator");
    expect(productionCompose).toContain("DATABASE_URL is required");
    expect(productionCompose).toContain("CRON_SECRET is required");
    expect(productionCompose).not.toMatch(/^\s+db:\s*$/m);
  });

  it("keeps the PDF.js Node polyfill and worker in the standalone runtime", () => {
    const packageJson = repositoryFile("package.json");
    const nextConfig = repositoryFile("next.config.ts");

    expect(packageJson).toContain('"@napi-rs/canvas"');
    expect(nextConfig).toContain('"@napi-rs/canvas"');
    expect(nextConfig).toContain(
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    );
  });

  it("keeps every required quality gate in CI", () => {
    const workflow = repositoryFile(".github/workflows/ci.yml");

    for (const gate of [
      "npm run lint",
      "npm run typecheck",
      "npm test -- --runInBand",
      "npm run build",
      "npx prisma validate",
      "npx prisma migrate status",
      "docker compose config --quiet",
    ]) {
      expect(workflow).toContain(gate);
    }
  });

  it("links to deployment guide from README", () => {
    const readme = repositoryFile("README.md");
    const deploymentGuide = repositoryFile("docs/deployment.md");

    expect(readme).toContain("docs/deployment.md");
    expect(deploymentGuide).toContain("npx prisma migrate deploy");
    expect(deploymentGuide).toContain("/api/health");
  });
});
