import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { POWDER_CATALOG, type PowderProduct } from '../apps/api/src/db/powderCatalog.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'apps', 'web', 'public', 'images', 'products');
const manifestPath = path.join(outputDir, 'manifest.json');
const registryPath = path.join(root, 'packages', 'contracts', 'src', 'productMediaRegistry.ts');
const roles = [
  { role: 'thumbnail', width: 320, quality: 78 },
  { role: 'card', width: 720, quality: 82 },
  { role: 'detail', width: 1200, quality: 84 },
] as const;
const maxDetailBytes = 600_000;
const maxBundleBytes = 15 * 1024 * 1024;

type MediaRole = (typeof roles)[number]['role'];
type ManifestFile = {
  sourceId: string;
  role: MediaRole;
  path: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
};
type ProductManifest = { version: 2; background: string; files: ManifestFile[] };

const fail = (message: string): never => {
  throw new Error(`Invalid product image configuration: ${message}`);
};
const escapeXml = (value: string): string =>
  value.replace(
    /[<>&"']/g,
    (character) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]!,
  );
const stableNumber = (value: string): number =>
  Number.parseInt(createHash('sha256').update(value).digest('hex').slice(0, 8), 16);
const publicPath = (file: string): string =>
  `/${path
    .relative(path.join(root, 'apps', 'web', 'public'), file)
    .split(path.sep)
    .join('/')}`;

function artwork(product: PowderProduct): Buffer {
  const variation = stableNumber(product.image_set_id);
  const labelX = 185 + (variation % 3) * 18;
  const labelY = 285 + (variation % 4) * 9;
  const bagColor = variation % 2 ? '#ece5d5' : '#f7f1e4';
  const material = variation % 3 === 0 ? '#dcd2bf' : '#e7dece';
  const powderY = 1005 - (variation % 4) * 12;
  const quantity =
    product.description.match(/(?:\d+(?:\.\d+)?(?:g|kg)|conceptual quantity)/i)?.[0] ??
    'conceptual quantity';
  const title = product.name.toUpperCase();
  const titleSize = title.length > 16 ? 43 : title.length > 12 ? 53 : 64;
  const dots = Array.from({ length: 16 }, (_, index) => {
    const x = 80 + ((variation * (index + 3)) % 1030);
    const y = 900 + ((variation * (index + 7)) % 145);
    const r = 3 + ((variation + index) % 7);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${product.visual.powder_color}" opacity=".75"/>`;
  }).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="#f3f0e9"/><path d="M0 935C230 880 326 1030 548 963S940 878 1200 950V1200H0Z" fill="#e9e2d5"/><ellipse cx="600" cy="1020" rx="365" ry="68" fill="#b9ae9b" opacity=".3"/>
  <path d="M${labelX - 42} 168h${824 - (variation % 5) * 14}l-32 760c-5 112-76 170-170 170H${labelX + 112}c-95 0-159-60-166-170z" fill="${bagColor}" stroke="#403d37" stroke-width="10"/><path d="M${labelX - 18} 184h${760 - (variation % 5) * 14}" stroke="${material}" stroke-width="34"/><path d="M${labelX + 4} 224h${716 - (variation % 5) * 14}" stroke="#5c554a" stroke-width="8"/><path d="M${labelX + 17} 247h${691 - (variation % 5) * 14}" stroke="#fffaf0" stroke-width="5" opacity=".8"/>
  <rect x="${labelX}" y="${labelY}" width="${830 - (variation % 5) * 18}" height="500" rx="12" fill="${product.visual.label_color}" stroke="#292722" stroke-width="8"/><rect x="${labelX}" y="${labelY}" width="${830 - (variation % 5) * 18}" height="82" fill="#292722"/><text x="${labelX + 34}" y="${labelY + 53}" fill="#f8f2e6" font-family="Arial, sans-serif" font-size="30" font-weight="700" letter-spacing="3">QAREFULLY POWDER CO.</text>
  <circle cx="${labelX + 84}" cy="${labelY + 170}" r="50" fill="${product.visual.powder_color}" stroke="#292722" stroke-width="6"/><text x="${labelX + 84}" y="${labelY + 185}" text-anchor="middle" fill="#292722" font-family="Arial, sans-serif" font-size="30" font-weight="800">${escapeXml(product.visual.mark)}</text><text x="${labelX + 155}" y="${labelY + 162}" fill="#fffaf0" font-family="Arial, sans-serif" font-size="${titleSize}" font-weight="800" letter-spacing="1">${escapeXml(title)}</text><text x="${labelX + 157}" y="${labelY + 210}" fill="#fffaf0" font-family="Arial, sans-serif" font-size="25" font-weight="700" letter-spacing="2">${escapeXml(product.category.toUpperCase())}</text>
  <path d="M${labelX + 36} ${labelY + 260}h${750 - (variation % 5) * 18}" stroke="#fffaf0" stroke-width="4" opacity=".72"/><text x="${labelX + 40}" y="${labelY + 315}" fill="#fffaf0" font-family="Arial, sans-serif" font-size="28" font-weight="700">ANYTHING. FINELY CONSIDERED.</text><text x="${labelX + 40}" y="${labelY + 385}" fill="#fffaf0" font-family="Arial, sans-serif" font-size="26" font-weight="700">NET ${escapeXml(quantity.toUpperCase())}</text><text x="${labelX + 40}" y="${labelY + 432}" fill="#fffaf0" font-family="Arial, sans-serif" font-size="21" letter-spacing="2">BATCH ${escapeXml(product.visual.batch_code)}</text><path d="M${labelX + 570} ${labelY + 350}q50-70 100 0q50 70 100 0" fill="none" stroke="#fffaf0" stroke-width="9" opacity=".85"/>
  <path d="M${labelX + 88} 808q330 60 648 0" fill="none" stroke="#c7bca9" stroke-width="8" opacity=".7"/><ellipse cx="600" cy="${powderY}" rx="190" ry="52" fill="${product.visual.powder_color}" opacity=".9"/><ellipse cx="600" cy="${powderY - 24}" rx="128" ry="36" fill="${product.visual.powder_color}"/>${dots}
</svg>`);
}

async function makeRendition(
  product: PowderProduct,
  rendition: (typeof roles)[number],
): Promise<ManifestFile> {
  const buffer = await sharp(artwork(product))
    .resize(rendition.width, rendition.width, { fit: 'cover' })
    .webp({ quality: rendition.quality, smartSubsample: true })
    .toBuffer();
  const hash = createHash('sha256').update(buffer).digest('hex');
  const filename = `${product.slug}.${rendition.role}.${hash.slice(0, 12)}.${rendition.width}.webp`;
  const file = path.join(outputDir, filename);
  await writeFile(file, buffer, { flag: 'wx' });
  return {
    sourceId: product.image_set_id,
    role: rendition.role,
    path: publicPath(file),
    width: rendition.width,
    height: rendition.width,
    bytes: buffer.byteLength,
    sha256: hash,
  };
}

function registrySource(files: readonly ManifestFile[]): string {
  const visuals = POWDER_CATALOG.map(
    (product) => `  '${product.image_set_id}': {
    labelColor: '${product.visual.label_color}',
    powderColor: '${product.visual.powder_color}',
    mark: '${escapeXml(product.visual.mark)}',
    batchCode: '${escapeXml(product.visual.batch_code)}',
  },`,
  );
  const products = POWDER_CATALOG.map((product) => {
    const entries = roles.map((rendition) => {
      const file = files.find(
        (item) => item.sourceId === product.image_set_id && item.role === rendition.role,
      );
      if (!file) fail(`missing ${rendition.role} rendition for ${product.image_set_id}`);
      return `    ${rendition.role}: {
      src: '${file.path}',
      alt: '${escapeXml(product.name)} powder bag',
      width: ${file.width},
      height: ${file.height},
    },`;
    });
    return `  '${product.image_set_id}': {
${entries.join('\n')}
  },`;
  });
  return `// Generated by scripts/build-product-images.ts. Do not edit.\nexport type ProductMediaRole = 'thumbnail' | 'card' | 'detail';\n\nexport type GeneratedProductImage = Readonly<{\n  src: string;\n  alt: string;\n  width: number;\n  height: number;\n  role: ProductMediaRole;\n}>;\n\nexport type GeneratedProductVisual = Readonly<{\n  labelColor: string;\n  powderColor: string;\n  mark: string;\n  batchCode: string;\n}>;\n\nconst registry = {\n${products.join('\n')}\n} as const;\n\nconst visualRegistry = {\n${visuals.join('\n')}\n} as const;\n\nexport const PRODUCT_MEDIA_REGISTRY: Readonly<\n  Record<string, Readonly<Record<ProductMediaRole, GeneratedProductImage>>>\n> = Object.fromEntries(\n  Object.entries(registry).map(([id, images]) => [\n    id,\n    Object.fromEntries(\n      Object.entries(images).map(([role, image]) => [role, { ...image, role }]),\n    ) as Readonly<Record<ProductMediaRole, GeneratedProductImage>>,\n  ]),\n);\n\nexport const PRODUCT_VISUAL_REGISTRY: Readonly<Record<string, GeneratedProductVisual>> =\n  visualRegistry;\n\nexport function getProductMedia(\n  imageSetId: string | null | undefined,\n  role: ProductMediaRole,\n): GeneratedProductImage | undefined {\n  return imageSetId ? PRODUCT_MEDIA_REGISTRY[imageSetId]?.[role] : undefined;\n}\n\nexport function getProductMediaSet(\n  imageSetId: string | null | undefined,\n): readonly GeneratedProductImage[] {\n  const media = imageSetId ? PRODUCT_MEDIA_REGISTRY[imageSetId] : undefined;\n  return media ? [media.thumbnail, media.card, media.detail] : [];\n}\n\nexport function getProductVisual(\n  imageSetId: string | null | undefined,\n): GeneratedProductVisual | undefined {\n  return imageSetId ? PRODUCT_VISUAL_REGISTRY[imageSetId] : undefined;\n}\n`;
}

function expectedNamePattern(source: PowderProduct, role: MediaRole, width: number): RegExp {
  return new RegExp(`^${source.slug}\\.${role}\\.[a-f0-9]{12}\\.${width}\\.webp$`);
}
function fileForManifestPath(value: string): string {
  if (!value.startsWith('/images/products/')) throw new Error(`Invalid manifest path: ${value}`);
  const filename = path.posix.basename(value);
  if (filename !== value.slice('/images/products/'.length))
    throw new Error(`Manifest path must be a direct product asset: ${value}`);
  return path.join(outputDir, filename);
}

async function build(): Promise<void> {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  const files: ManifestFile[] = [];
  for (const product of POWDER_CATALOG)
    for (const rendition of roles) files.push(await makeRendition(product, rendition));
  await writeFile(
    manifestPath,
    `${JSON.stringify({ version: 2, background: '#f3f0e9', files } satisfies ProductManifest, null, 2)}\n`,
  );
  await writeFile(registryPath, registrySource(files));
  await check();
}

async function check(): Promise<void> {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ProductManifest;
  if (manifest.version !== 2 || !Array.isArray(manifest.files))
    fail('expected version 2 generated manifest');
  if (manifest.files.length !== POWDER_CATALOG.length * roles.length)
    fail(`expected ${POWDER_CATALOG.length * roles.length} renditions`);
  const expected = new Set(['manifest.json']);
  const seen = new Set<string>();
  let total = 0;
  for (const item of manifest.files) {
    const source = POWDER_CATALOG.find((product) => product.image_set_id === item.sourceId);
    const rendition = roles.find((candidate) => candidate.role === item.role);
    if (!source || !rendition) fail(`unknown manifest rendition: ${item.sourceId}:${item.role}`);
    const key = `${item.sourceId}:${item.role}`;
    if (seen.has(key)) fail(`duplicate rendition: ${key}`);
    seen.add(key);
    if (
      !expectedNamePattern(source, item.role, rendition.width).test(path.posix.basename(item.path))
    )
      fail(`unexpected generated filename: ${item.path}`);
    const file = fileForManifestPath(item.path);
    expected.add(path.basename(file));
    await access(file);
    const buffer = await readFile(file);
    const metadata = await sharp(buffer).metadata();
    const digest = createHash('sha256').update(buffer).digest('hex');
    if (buffer.byteLength !== item.bytes || digest !== item.sha256)
      fail(`content mismatch: ${item.path}`);
    if (
      metadata.width !== rendition.width ||
      metadata.height !== rendition.width ||
      metadata.format !== 'webp'
    )
      fail(`media metadata mismatch: ${item.path}`);
    if (item.role === 'detail' && item.bytes > maxDetailBytes)
      fail(`oversized detail asset: ${item.path}`);
    total += item.bytes;
  }
  for (const product of POWDER_CATALOG)
    for (const rendition of roles)
      if (!seen.has(`${product.image_set_id}:${rendition.role}`))
        fail(`missing ${rendition.role} rendition for ${product.image_set_id}`);
  const actual = new Set(await readdir(outputDir));
  for (const name of actual) if (!expected.has(name)) fail(`untracked generated asset: ${name}`);
  for (const name of expected) if (!actual.has(name)) fail(`missing generated asset: ${name}`);
  if (total > maxBundleBytes) fail(`product asset bundle exceeds 15 MiB (${total} bytes)`);
  if ((await readFile(registryPath, 'utf8')) !== registrySource(manifest.files))
    fail('generated product media registry is stale; run assets:build');
  const diskBytes = (
    await Promise.all(
      (await readdir(outputDir)).map(async (name) => (await stat(path.join(outputDir, name))).size),
    )
  ).reduce((left, right) => left + right, 0);
  console.log(
    `Product assets valid: ${manifest.files.length} files, ${(diskBytes / 1024 / 1024).toFixed(2)} MiB`,
  );
}

const command = process.argv[2] ?? 'build';
void (async () => {
  if (command === 'build') await build();
  else if (command === 'check') await check();
  else throw new Error(`Unknown command: ${command}`);
})();
