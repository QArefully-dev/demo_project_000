import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'apps', 'web', 'public', 'images', 'products');
const manifestPath = path.join(outputDir, 'manifest.json');
const localSourcesPath = path.join(root, 'media-sources.json');
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

function fail(message) {
  throw new Error(`Invalid product image configuration: ${message}`);
}

function validateConfig(value) {
  if (!value || typeof value !== 'object') fail('expected an object');
  if (typeof value.background !== 'string' || !value.background.trim())
    fail('background must be a non-empty string');
  if (!Array.isArray(value.sources) || value.sources.length === 0)
    fail('sources must be a non-empty array');

  const ids = new Set();
  const slugs = new Set();
  for (const source of value.sources) {
    if (!source || typeof source !== 'object') fail('each source must be an object');
    for (const key of ['id', 'slug']) {
      if (typeof source[key] !== 'string' || !source[key].trim())
        fail(`source ${key} must be a non-empty string`);
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.slug))
      fail(`source slug must be kebab-case: ${source.slug}`);
    if (ids.has(source.id)) fail(`duplicate source id: ${source.id}`);
    if (slugs.has(source.slug)) fail(`duplicate source slug: ${source.slug}`);
    ids.add(source.id);
    slugs.add(source.slug);
  }
}

validateConfig(config);

function relativePublicPath(file) {
  return `/${path
    .relative(path.join(root, 'apps', 'web', 'public'), file)
    .split(path.sep)
    .join('/')}`;
}

async function readLocalSources() {
  let localConfig;
  try {
    localConfig = JSON.parse(await readFile(localSourcesPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(
        'assets:build requires ignored media-sources.json with local source paths; copy media-sources.example.json and update its file values',
      );
    }
    throw new Error(`Unable to read media-sources.json: ${error.message}`);
  }

  if (!localConfig || typeof localConfig !== 'object' || !Array.isArray(localConfig.sources))
    throw new Error('Invalid media-sources.json: sources must be an array');

  const localFiles = new Map();
  for (const source of localConfig.sources) {
    if (!source || typeof source.id !== 'string' || typeof source.file !== 'string')
      throw new Error('Invalid media-sources.json source: expected id and file strings');
    if (localFiles.has(source.id))
      throw new Error(`Duplicate media-sources.json source ID: ${source.id}`);
    const input = path.resolve(root, source.file);
    if (input.startsWith(`${outputDir}${path.sep}`))
      throw new Error(`Source file cannot be a derived asset: ${source.file}`);
    localFiles.set(source.id, input);
  }

  if (localFiles.size !== config.sources.length)
    throw new Error('media-sources.json must contain every configured source exactly once');

  return Promise.all(
    config.sources.map(async (source) => {
      const input = localFiles.get(source.id);
      if (!input) throw new Error(`Missing local source path for ${source.id}`);
      await access(input);
      return { ...source, input };
    }),
  );
}

async function makeRendition(source, rendition) {
  const metadata = await sharp(source.input).metadata();
  if (
    !metadata.width ||
    !metadata.height ||
    !['jpeg', 'png', 'webp', 'avif'].includes(metadata.format)
  ) {
    throw new Error(`Unsupported source: ${source.input}`);
  }

  // withoutEnlargement deliberately preserves honest source resolution.
  const buffer = await sharp(source.input)
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

function sourceForId(id) {
  const source = config.sources.find((candidate) => candidate.id === id);
  if (!source) throw new Error(`Unknown source ID in manifest: ${id}`);
  return source;
}

function expectedNamePattern(source, role, width) {
  return new RegExp(`^${source.slug}\\.${role}\\.[a-f0-9]{12}\\.${width}\\.webp$`);
}

function fileForManifestPath(publicPath) {
  if (typeof publicPath !== 'string' || !publicPath.startsWith('/images/products/'))
    throw new Error(`Invalid manifest path: ${publicPath}`);
  const filename = path.posix.basename(publicPath);
  if (filename !== publicPath.slice('/images/products/'.length))
    throw new Error(`Manifest path must be a direct product asset: ${publicPath}`);
  return path.join(outputDir, filename);
}

async function build() {
  const sources = await readLocalSources();
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  const files = [];
  for (const source of sources) {
    for (const rendition of roles) files.push(await makeRendition(source, rendition));
  }
  const manifest = { version: 1, background: config.background, files };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await check();
}

async function check() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.files))
    throw new Error('Invalid product asset manifest');
  const expected = new Set(['manifest.json']);
  const seenPaths = new Set();
  const seenRenditions = new Set();
  let total = 0;
  for (const item of manifest.files) {
    if (!item || typeof item !== 'object') throw new Error('Invalid manifest file entry');
    if (seenPaths.has(item.path)) throw new Error(`Duplicate manifest path: ${item.path}`);
    seenPaths.add(item.path);
    const source = sourceForId(item.sourceId);
    const rendition = roles.find((candidate) => candidate.role === item.role);
    if (!rendition) throw new Error(`Unknown rendition role: ${item.role}`);
    const renditionKey = `${item.sourceId}:${item.role}`;
    if (seenRenditions.has(renditionKey)) throw new Error(`Duplicate rendition: ${renditionKey}`);
    seenRenditions.add(renditionKey);
    if (
      !expectedNamePattern(source, item.role, rendition.width).test(path.posix.basename(item.path))
    )
      throw new Error(`Unexpected generated filename: ${item.path}`);
    const file = fileForManifestPath(item.path);
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
      metadata.format !== 'webp' ||
      item.width !== rendition.width ||
      item.height !== rendition.width
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
