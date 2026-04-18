import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

type WikiAction = "ingest" | "query" | "lint";

export type WikiSourceIngestResult = {
  action: WikiAction;
  sourceRelativePath: string;
  pageRelativePath: string;
  indexUpdated: boolean;
  logUpdated: boolean;
};

export type WikiQueryResult = {
  action: WikiAction;
  query: string;
  matches: Array<{
    file: string;
    snippet: string;
    provenanceRefs: string[];
  }>;
};

export type WikiLintResult = {
  action: WikiAction;
  issues: Array<{
    file: string;
    code: "missing_provenance" | "orphan_page" | "stale_link" | "contradiction";
    message: string;
  }>;
};

export type WikiDailyMaintenanceResult = {
  action: "daily";
  dateKey: string;
  reviewPageRelativePath: string;
  issueCount: number;
  indexUpdated: boolean;
  logUpdated: boolean;
};

function wikiRootPath(): string {
  const configured = process.env.VIRGIL_WIKI_ROOT?.trim();
  return path.resolve(configured || "workspace/wiki-starter");
}

function sourcePageSlug(input: string): string {
  const base = path.basename(input, path.extname(input));
  const normalized = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "source-note";
}

function assertWithinRoot(target: string, root: string): void {
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("path_outside_root");
  }
}

function ensureMarkdownExtension(file: string): void {
  if (!file.toLowerCase().endsWith(".md")) {
    throw new Error("source_must_be_markdown");
  }
}

function extractSummary(content: string): string[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.slice(0, 6);
}

async function appendLogEntry(root: string, entry: string): Promise<void> {
  const logPath = path.join(root, "wiki", "log.md");
  const existing = await readFile(logPath, "utf8");
  const next = `${existing.trimEnd()}\n\n${entry}\n`;
  await writeFile(logPath, next, "utf8");
}

async function upsertIndexDaily(
  root: string,
  pageRelativePath: string,
  summary: string
): Promise<boolean> {
  const indexPath = path.join(root, "wiki", "index.md");
  const existing = await readFile(indexPath, "utf8");
  const marker = `- [[${pageRelativePath}]]`;
  if (existing.includes(marker)) {
    return false;
  }

  const header = "## Daily reviews";
  const line = `${marker} — ${summary}`;
  let next = existing.trimEnd();
  if (next.includes(header)) {
    const parts = next.split(header);
    const suffix = parts.slice(1).join(header);
    next = `${parts[0]}${header}\n\n${line}\n${suffix.trimStart()}`;
  } else {
    next = `${next}\n\n${header}\n\n${line}\n`;
  }
  await writeFile(indexPath, `${next.trimEnd()}\n`, "utf8");
  return true;
}

async function upsertIndexSource(
  root: string,
  pageRelativePath: string,
  summary: string
): Promise<boolean> {
  const indexPath = path.join(root, "wiki", "index.md");
  const existing = await readFile(indexPath, "utf8");
  const marker = `- [[${pageRelativePath}]]`;
  if (existing.includes(marker)) {
    return false;
  }

  const sourcesHeader = "## Sources";
  const line = `${marker} — ${summary}`;
  let next = existing.trimEnd();
  if (next.includes(sourcesHeader)) {
    const parts = next.split(sourcesHeader);
    const suffix = parts.slice(1).join(sourcesHeader);
    next = `${parts[0]}${sourcesHeader}\n\n${line}\n${suffix.trimStart()}`;
  } else {
    next = `${next}\n\n${sourcesHeader}\n\n${line}\n`;
  }
  await writeFile(indexPath, `${next.trimEnd()}\n`, "utf8");
  return true;
}

export async function ingestWikiSource(
  sourceRelativePath: string
): Promise<WikiSourceIngestResult> {
  const root = wikiRootPath();
  const rawPath = path.resolve(path.join(root, "raw", sourceRelativePath));
  assertWithinRoot(rawPath, path.join(root, "raw"));
  ensureMarkdownExtension(rawPath);

  const sourceStats = await stat(rawPath);
  if (!sourceStats.isFile()) {
    throw new Error("source_not_file");
  }

  const sourceText = await readFile(rawPath, "utf8");
  const summaryLines = extractSummary(sourceText);
  const summary =
    summaryLines.length > 0 ? summaryLines[0] : "No summary available.";
  const slug = sourcePageSlug(sourceRelativePath);
  const sourcePagesDir = path.join(root, "wiki", "sources");
  await mkdir(sourcePagesDir, { recursive: true });
  const pagePath = path.join(sourcePagesDir, `${slug}.md`);
  const sourceRef = path.posix
    .join("raw", sourceRelativePath)
    .replaceAll("\\", "/");
  const pageRelativePath = `sources/${slug}`;
  const pageBody = `---
type: source-note
status: active
last_reviewed: ${new Date().toISOString().slice(0, 10)}
source: ${sourceRef}
---

# Source note: ${path.basename(sourceRelativePath)}

## Summary

${summary}

## Extract

${summaryLines.map((line) => `- ${line}`).join("\n")}

## Provenance

- \`${sourceRef}\`
`;
  await writeFile(pagePath, pageBody, "utf8");

  const indexUpdated = await upsertIndexSource(root, pageRelativePath, summary);

  const timestamp = new Date().toISOString().slice(0, 10);
  await appendLogEntry(
    root,
    `## [${timestamp}] ingest | ${path.basename(sourceRelativePath)}

- action: ingest
- source: \`${sourceRef}\`
- page: \`wiki/${pageRelativePath}.md\`
- index_updated: ${String(indexUpdated)}`
  );

  return {
    action: "ingest",
    sourceRelativePath,
    pageRelativePath,
    indexUpdated,
    logUpdated: true,
  };
}

function shouldSkipWikiFile(filePath: string): boolean {
  const base = path.basename(filePath);
  if (base.startsWith("_")) {
    return true;
  }
  return base === "index.md" || base === "log.md";
}

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}

export async function queryWiki(query: string): Promise<WikiQueryResult> {
  const root = wikiRootPath();
  const wikiDir = path.join(root, "wiki");
  const term = query.trim().toLowerCase();
  if (!term) {
    return { action: "query", query, matches: [] };
  }

  const files = await collectMarkdownFiles(wikiDir);
  const prioritizedFiles = await prioritizeQueryFiles(files, wikiDir);
  const matches: WikiQueryResult["matches"] = [];
  for (const filePath of prioritizedFiles) {
    if (shouldSkipWikiFile(filePath)) {
      continue;
    }
    const content = await readFile(filePath, "utf8");
    const lower = content.toLowerCase();
    const index = lower.indexOf(term);
    if (index < 0) {
      continue;
    }
    const start = Math.max(0, index - 80);
    const end = Math.min(content.length, index + term.length + 80);
    const snippet = content.slice(start, end).replace(/\s+/g, " ").trim();
    matches.push({
      file: path
        .relative(path.join(root, "wiki"), filePath)
        .replaceAll(path.sep, "/"),
      snippet,
      provenanceRefs: extractProvenanceRefs(content),
    });
    if (matches.length >= 12) {
      break;
    }
  }

  return { action: "query", query, matches };
}

async function prioritizeQueryFiles(
  files: string[],
  wikiDir: string
): Promise<string[]> {
  const indexPath = path.join(wikiDir, "index.md");
  const existing = new Set(files);
  const prioritized = new Set<string>();

  try {
    const indexContent = await readFile(indexPath, "utf8");
    for (const target of extractWikiLinks(indexContent)) {
      const targetPath = path.join(wikiDir, `${target}.md`);
      if (!existing.has(targetPath)) {
        continue;
      }
      prioritized.add(targetPath);
    }
  } catch {
    // no-op: query path still works even when index is missing
  }

  const ordered: string[] = [];
  for (const filePath of files) {
    if (prioritized.has(filePath)) {
      ordered.push(filePath);
    }
  }
  for (const filePath of files) {
    if (!prioritized.has(filePath)) {
      ordered.push(filePath);
    }
  }
  return ordered;
}

export async function lintWiki(): Promise<WikiLintResult> {
  const root = wikiRootPath();
  const wikiDir = path.join(root, "wiki");
  const files = await collectMarkdownFiles(wikiDir);
  const issues: WikiLintResult["issues"] = [];

  const linkTargets = new Set<string>();
  const linkedReferences = new Map<string, Set<string>>();
  const knownPages = new Set<string>();
  const pagePaths: Array<{
    filePath: string;
    relNoExt: string;
    content: string;
  }> = [];

  for (const filePath of files) {
    const rel = path
      .relative(wikiDir, filePath)
      .replaceAll(path.sep, "/")
      .replace(/\.md$/i, "");
    const content = await readFile(filePath, "utf8");
    knownPages.add(rel);
    pagePaths.push({ filePath, relNoExt: rel, content });
    for (const match of content.matchAll(/\[\[([^\]]+)\]\]/g)) {
      const normalizedLinkTarget = normalizeWikiLinkTarget(match[1]);
      if (!normalizedLinkTarget) {
        continue;
      }
      linkTargets.add(normalizedLinkTarget);
      const current = linkedReferences.get(rel) ?? new Set<string>();
      current.add(normalizedLinkTarget);
      linkedReferences.set(rel, current);
    }
  }

  for (const page of pagePaths) {
    if (shouldSkipWikiFile(page.filePath)) {
      continue;
    }
    const relFile = `${page.relNoExt}.md`;
    if (!/##\s+Provenance/i.test(page.content)) {
      issues.push({
        file: relFile,
        code: "missing_provenance",
        message: "Page is missing a 'Provenance' section.",
      });
    }
    if (!linkTargets.has(page.relNoExt)) {
      issues.push({
        file: relFile,
        code: "orphan_page",
        message: "Page has no inbound wiki links.",
      });
    }

    if (hasCompetingViews(page.content)) {
      issues.push({
        file: relFile,
        code: "contradiction",
        message:
          "Page contains competing views in the 'Contradictions or competing views' section.",
      });
    }

    const outboundLinks = linkedReferences.get(page.relNoExt);
    if (outboundLinks) {
      for (const outboundLink of outboundLinks) {
        if (knownPages.has(outboundLink)) {
          continue;
        }
        issues.push({
          file: relFile,
          code: "stale_link",
          message: `Page links to missing target '${outboundLink}'.`,
        });
      }
    }
  }

  const sortedIssues = issues.sort((a, b) => {
    const byFile = a.file.localeCompare(b.file);
    if (byFile !== 0) {
      return byFile;
    }
    return a.code.localeCompare(b.code);
  });

  return { action: "lint", issues: sortedIssues };
}

function normalizeWikiLinkTarget(rawTarget: string): string | null {
  const baseTarget = rawTarget.split("|")[0]?.split("#")[0]?.trim();
  if (!baseTarget) {
    return null;
  }
  return baseTarget.replace(/\.md$/i, "");
}

function extractWikiLinks(content: string): string[] {
  const links: string[] = [];
  for (const match of content.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const normalized = normalizeWikiLinkTarget(match[1]);
    if (!normalized) {
      continue;
    }
    links.push(normalized);
  }
  return links;
}

function extractProvenanceRefs(content: string): string[] {
  const refs = new Set<string>();
  const provenanceIndex = content.search(/^##\s+Provenance\s*$/im);
  if (provenanceIndex < 0) {
    return [];
  }

  const provenanceContent = content.slice(provenanceIndex);
  const sectionLines = provenanceContent.split(/\r?\n/).slice(1);
  for (const line of sectionLines) {
    if (/^##\s+/.test(line)) {
      break;
    }
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    for (const match of trimmed.matchAll(/`([^`]+)`/g)) {
      refs.add(match[1].trim());
    }
  }

  return Array.from(refs);
}

function hasCompetingViews(content: string): boolean {
  const section = extractSectionContent(
    content,
    "Contradictions or competing views"
  );
  if (!section) {
    return false;
  }

  const hasViewA = /-\s*view_a\s*:\s*.+/i.test(section);
  const hasViewB = /-\s*view_b\s*:\s*.+/i.test(section);
  if (!hasViewA || !hasViewB) {
    return false;
  }

  const resolutionMatch = section.match(/-\s*resolution_status\s*:\s*(.+)/i);
  if (!resolutionMatch) {
    return true;
  }

  const normalizedResolution = resolutionMatch[1]?.trim().toLowerCase() ?? "";
  if (!normalizedResolution) {
    return true;
  }

  return ["open", "unresolved", "pending"].includes(normalizedResolution);
}

function extractSectionContent(
  content: string,
  heading: string
): string | null {
  const lines = content.split(/\r?\n/);
  const headingPattern = new RegExp(
    `^##\\s+${escapeRegExp(heading)}\\s*$`,
    "i"
  );
  let startIndex = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (headingPattern.test(lines[index] ?? "")) {
      startIndex = index + 1;
      break;
    }
  }
  if (startIndex < 0) {
    return null;
  }

  const sectionLines: string[] = [];
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/^##\s+/.test(line)) {
      break;
    }
    sectionLines.push(line);
  }

  return sectionLines.join("\n");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function runDailyWikiMaintenance(): Promise<WikiDailyMaintenanceResult> {
  const root = wikiRootPath();
  const dateKey = new Date().toISOString().slice(0, 10);
  const lint = await lintWiki();
  const projectSignals = await queryWiki("project");
  const dailyDir = path.join(root, "wiki", "daily");
  await mkdir(dailyDir, { recursive: true });
  const pageRelativePath = `daily/${dateKey}`;
  const pagePath = path.join(dailyDir, `${dateKey}.md`);
  const issuePreview = lint.issues.slice(0, 10);
  const signalPreview = projectSignals.matches.slice(0, 6);
  const pageBody = `---
type: daily-review
status: active
date: ${dateKey}
issue_count: ${lint.issues.length}
---

# Daily wiki review: ${dateKey}

## Lint summary

- total_issues: ${lint.issues.length}

${issuePreview.length > 0 ? "## Top issues\n\n" : "## Top issues\n\n- none\n"}
${issuePreview
  .map((issue) => `- ${issue.code}: \`${issue.file}\` — ${issue.message}`)
  .join("\n")}

## Project signal query

- query: "project"
- matches: ${projectSignals.matches.length}

${signalPreview.length > 0 ? "### Sample matches\n\n" : "### Sample matches\n\n- none\n"}
${signalPreview
  .map((match) => `- \`${match.file}\`: ${match.snippet}`)
  .join("\n")}
`;
  await writeFile(pagePath, `${pageBody.trimEnd()}\n`, "utf8");

  const indexUpdated = await upsertIndexDaily(
    root,
    pageRelativePath,
    `${lint.issues.length} issue(s)`
  );

  await appendLogEntry(
    root,
    `## [${dateKey}] daily | wiki-maintenance

- action: daily
- review_page: \`wiki/${pageRelativePath}.md\`
- issue_count: ${lint.issues.length}
- index_updated: ${String(indexUpdated)}`
  );

  return {
    action: "daily",
    dateKey,
    reviewPageRelativePath: pageRelativePath,
    issueCount: lint.issues.length,
    indexUpdated,
    logUpdated: true,
  };
}
