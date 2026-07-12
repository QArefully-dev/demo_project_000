import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'apps', 'web', 'public', 'images', 'products');
const manifestPath = path.join(outputDir, 'manifest.json');
const config = JSON.parse(
  await readFile(path.join(root, 'scripts', 'product-image-sources.json'), 'utf8'),
);
const roles = [
  { role: 'thumbnail', width: 320, quality: 78 },
  { role: 'card', width: 720, quality: 82 },
  { role: 'detail', width: 1200, quality: 84 },
];
const maxDetailBytes = 600_000;
const maxBundleBytes = 15 * 1024 * 1024;

function relativePublicPath(file) {
  return `/${path
    .relative(path.join(root, 'apps', 'web', 'public'), file)
    .split(path.sep)
    .join('/')}`;
}

async function makeRendition(source, rendition) {
  const input = path.resolve(root, source.file);
  const metadata = await sharp(input).metadata();
  if (
    !metadata.width ||
    !metadata.height ||
    !['jpeg', 'png', 'webp', 'avif'].includes(metadata.format)
  ) {
    throw new Error(`Unsupported source: ${source.file}`);
  }

  // withoutEnlargement deliberately preserves honest source resolution.
  const buffer = await sharp(input)
    .rotate()
    .resize(rendition.width, rendition.width, {
      fit: 'contain',
      background: config.background,
      withoutEnlargement: true,
    })
    .webp({ quality: rendition.quality, smartSubsample: true })
    .toBuffer();
  const outputMetadata = await sharp(buffer).metadata();
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 12);
  const name = `${source.slug}.${rendition.role}.${hash}.${outputMetadata.width}.webp`;
  const file = path.join(outputDir, name);
  await writeFile(file, buffer, { flag: 'wx' });
  return {
    sourceId: source.id,
    role: rendition.role,
    path: relativePublicPath(file),
    width: outputMetadata.width,
    height: outputMetadata.height,
    bytes: buffer.byteLength,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
}

async function build() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  const files = [];
  for (const source of config.sources) {
    for (const rendition of roles) files.push(await makeRendition(source, rendition));
  }
  const manifest = { version: 1, background: config.background, files };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await check();
}

async function check() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const expected = new Set(['manifest.json']);
  const seenPaths = new Set();
  let total = 0;
  for (const item of manifest.files) {
    if (seenPaths.has(item.path)) throw new Error(`Duplicate manifest path: ${item.path}`);
    seenPaths.add(item.path);
    const file = path.join(root, 'apps', 'web', 'public', item.path.replace(/^\//, ''));
    expected.add(path.basename(file));
    await access(file);
    const buffer = await readFile(file);
    const metadata = await sharp(buffer).metadata();
    const digest = createHash('sha256').update(buffer).digest('hex');
    if (buffer.byteLength !== item.bytes || digest !== item.sha256)
      throw new Error(`Content mismatch: ${item.path}`);
    if (
      metadata.width !== item.width ||
      metadata.height !== item.height ||
      metadata.format !== 'webp'
    ) {
      throw new Error(`Media metadata mismatch: ${item.path}`);
    }
    if (item.role === 'detail' && item.bytes > maxDetailBytes)
      throw new Error(`Oversized detail asset: ${item.path}`);
    total += item.bytes;
  }
  for (const source of config.sources) {
    for (const { role } of roles) {
      if (!manifest.files.some((item) => item.sourceId === source.id && item.role === role)) {
        throw new Error(`Missing ${role} rendition for ${source.id}`);
      }
    }
  }
  const actual = new Set(await readdir(outputDir));
  for (const name of actual)
    if (!expected.has(name)) throw new Error(`Untracked generated asset: ${name}`);
  for (const name of expected)
    if (!actual.has(name)) throw new Error(`Missing generated asset: ${name}`);
  if (total > maxBundleBytes)
    throw new Error(`Product asset bundle exceeds 15 MiB (${total} bytes)`);
  const diskBytes = (
    await Promise.all(
      (await readdir(outputDir)).map(async (name) => (await stat(path.join(outputDir, name))).size),
    )
  ).reduce((a, b) => a + b, 0);
  console.log(
    `Product assets valid: ${manifest.files.length} files, ${(diskBytes / 1024 / 1024).toFixed(2)} MiB`,
  );
}

const command = process.argv[2] ?? 'build';
if (command === 'build') await build();
else if (command === 'check') await check();
else throw new Error(`Unknown command: ${command}`);
