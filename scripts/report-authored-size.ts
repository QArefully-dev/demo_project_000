import { readFile, readdir } from 'node:fs/promises';
import { relative, sep } from 'node:path';

const warningThreshold = 300;
const failureThreshold = 400;
const sourceRoots = ['apps', 'packages', 'scripts'];
const sourceExtensions = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs']);
const excludedPathParts = new Set([
  'node_modules',
  'dist',
  'fixtures',
  '__fixtures__',
  'migrations',
]);
const frameworkAdapterRoot = ['apps', 'web', 'src', 'components', 'ui'].join(sep);

type FilePolicy = {
  responsibilities: string[];
  reason?: string;
};

type SizePolicy = {
  files: Record<string, FilePolicy>;
  exceptions: Record<string, FilePolicy>;
};

function hasSourceExtension(path: string): boolean {
  return [...sourceExtensions].some((extension) => path.endsWith(extension));
}

function isExcluded(path: string): boolean {
  const parts = path.split(sep);
  const fileName = parts.at(-1) ?? '';
  return (
    parts.some((part) => excludedPathParts.has(part)) ||
    path.startsWith(`${frameworkAdapterRoot}${sep}`) ||
    fileName.includes('.generated.') ||
    fileName.endsWith('.gen.ts')
  );
}

async function findSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = `${directory}${sep}${entry.name}`;
    if (isExcluded(path)) continue;
    if (entry.isDirectory()) files.push(...(await findSourceFiles(path)));
    else if (entry.isFile() && hasSourceExtension(path)) files.push(path);
  }

  return files;
}

function countLogicalLines(source: string): number {
  let inBlockComment = false;
  let count = 0;

  for (const rawLine of source.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) continue;

    while (inBlockComment) {
      const end = line.indexOf('*/');
      if (end === -1) {
        line = '';
        break;
      }
      inBlockComment = false;
      line = line.slice(end + 2).trim();
    }
    if (!line || line.startsWith('//')) continue;

    const blockStart = line.indexOf('/*');
    if (blockStart !== -1) {
      const blockEnd = line.indexOf('*/', blockStart + 2);
      if (blockEnd === -1) {
        inBlockComment = true;
        line = line.slice(0, blockStart).trim();
      } else {
        line = `${line.slice(0, blockStart)}${line.slice(blockEnd + 2)}`.trim();
      }
    }
    if (line) count += 1;
  }

  return count;
}

async function main(): Promise<void> {
  const policy = JSON.parse(
    await readFile('scripts/authored-size-policy.json', 'utf8'),
  ) as SizePolicy;
  const files = (await Promise.all(sourceRoots.map(findSourceFiles))).flat();
  const oversized: Array<{ path: string; logicalLines: number; policy?: FilePolicy }> = [];

  for (const path of files) {
    const logicalLines = countLogicalLines(await readFile(path, 'utf8'));
    if (logicalLines > warningThreshold) {
      const normalizedPath = relative('.', path).split(sep).join('/');
      oversized.push({
        path: normalizedPath,
        logicalLines,
        policy: policy.exceptions[normalizedPath] ?? policy.files[normalizedPath],
      });
    }
  }

  oversized.sort((left, right) => right.logicalLines - left.logicalLines);
  if (oversized.length === 0) {
    console.log(`Authored-size report: no files above ${warningThreshold} logical lines.`);
    return;
  }

  let failed = false;
  for (const file of oversized) {
    const responsibilities = file.policy?.responsibilities ?? [];
    const responsibilityReport = responsibilities.length
      ? `${responsibilities.length}: ${responsibilities.join('; ')}`
      : 'unclassified (0)';
    const exception = policy.exceptions[file.path];
    console.log(
      `${file.path}: ${file.logicalLines} logical lines; responsibilities ${responsibilityReport}`,
    );

    if (
      file.logicalLines > failureThreshold &&
      (!exception?.reason || responsibilities.length !== 1)
    ) {
      console.error(
        `Authored-size failure: ${file.path} exceeds ${failureThreshold} logical lines. ` +
          'Decompose it or add one cohesive-responsibility exception with a reason.',
      );
      failed = true;
    }
  }

  if (failed) process.exitCode = 1;
}

void main();
