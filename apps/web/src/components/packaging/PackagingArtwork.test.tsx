import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PackagingArtwork } from './PackagingArtwork';
import { titleLines } from './svgText';
import type { PackagingSpec } from './packagingSpec';

/**
 * `hazard`/`grade`/`yield`/`never` fixtures below use the LONGEST real catalog strings for their
 * source field (not hand-truncated stand-ins) -- worst-case coverage for R4-F1's width-constraint
 * regressions. Sources:
 * - kraftSpec.hazard: `TradeFacts.ppe.join(', ')` worst case, `tradeCreative.ts` "stone-blasting"
 *   product (119 chars).
 * - wovenSpec.hazard: `GardenFacts.handling` worst case, `gardenOutdoors.ts` "soil-acidifier"
 *   product (178 chars).
 * - wovenSpec.grade: `GardenFacts.npk` worst case, `gardenOutdoors.ts` "epsom-salts" product
 *   (33 chars).
 * - wovenSpec.yield: `GardenFacts.coverage` worst case, `gardenOutdoors.ts` "bone-meal" product
 *   (73 chars).
 * - kegCorrosiveSpec.dose / .hazard / .never: real full `CleaningFacts.dosage` /
 *   `.hazardStatement` for `drain-unblocker-powder` (`householdCleaning.ts:361-365`) -- `.grade`
 *   is the mixing-group label ("Cleaning"), never the dosage string (R4-F1: grade must never
 *   duplicate dose).
 */
const kraftSpec: PackagingSpec = {
  vessel: 'kraft-sack',
  ink: { ink: '#26292c', alert: '#b0381a' },
  brand: 'QAREFULLY MATERIALS EXCHANGE',
  titleLines: titleLines('Portland Cement'),
  sub: 'Trade & Creative Materials',
  lot: 'TCM-0033-001',
  netWeight: '25 kg Bag',
  grade: 'CEM I 42.5N',
  hazard:
    'P3 respirator for sandblasting, Safety glasses, Gloves, Respirable crystalline silica dust hazard: avoid breathing dust',
};

const wovenSpec: PackagingSpec = {
  vessel: 'woven-sack',
  ink: { ink: '#2c5130', alert: '#9d5416' },
  brand: 'QAREFULLY MATERIALS EXCHANGE',
  titleLines: titleLines('All-Purpose Garden Fertilizer'),
  sub: 'Garden & Outdoors',
  lot: 'GDN-0027-001',
  netWeight: '10 kg Bag',
  grade: '0-0-0 (Magnesium 10%, Sulfur 13%)',
  hazard:
    'Wear gloves and dust mask. Avoid breathing dust. Causes eye irritation. Wash hands after use. Do not apply to acid-loving plants such as rhododendrons, camellias, or blueberries.',
  yield: 'One 1.5 kg bag covers approximately 20 m2 when worked into planting holes',
};

const kegCorrosiveSpec: PackagingSpec = {
  vessel: 'keg',
  tone: 'corrosive',
  ink: { ink: '#1b4a68', alert: '#b0381a' },
  brand: 'QAREFULLY MATERIALS EXCHANGE',
  titleLines: titleLines('Drain Unblocker Powder'),
  sub: 'Household & Cleaning',
  lot: 'HCL-0044-001',
  netWeight: '5 kg',
  grade: 'Cleaning',
  hazard:
    'Causes severe skin burns and eye damage. Reacts violently with water, releasing flammable hydrogen gas. Never use with hot water or other chemicals.',
  dose: 'Pour 50 g into drain. Add 250 ml cold water carefully. Leave for 30 minutes. Flush with water.',
  never: 'Never use with hot water or other chemicals.',
};

const kegMildSpec: PackagingSpec = {
  vessel: 'keg',
  tone: 'mild',
  ink: { ink: '#1b4a68', alert: '#b0381a' },
  brand: 'QAREFULLY MATERIALS EXCHANGE',
  titleLines: titleLines('Shoe Deodorising Powder'),
  sub: 'Household & Cleaning',
  lot: 'HCL-1041-001',
  netWeight: '100 g',
  grade: 'Absorbents',
  hazard: 'May cause dust irritation. Avoid getting powder into eyes.',
};

/** Finds the `<text>` node whose content matches (case-insensitively), for `textLength` assertions. */
function findTextNode(container: HTMLElement, content: string): SVGTextElement {
  const match = Array.from(container.querySelectorAll('text')).find(
    (node) => node.textContent?.toUpperCase() === content.toUpperCase(),
  );
  if (!match) throw new Error(`No <text> node found with content ${content}`);
  return match;
}

describe('PackagingArtwork', () => {
  it('renders the kraft sack for the A direction, printing the brand string and hazard copy', () => {
    const { container } = render(
      <PackagingArtwork name="Portland Cement" spec={kraftSpec} mark="" consumptionLabel={null} />,
    );
    const artwork = screen.getByRole('img', { name: 'Portland Cement stitched kraft sack' });
    expect(artwork.tagName).toBe('svg');
    expect(artwork).toHaveTextContent('QAREFULLY MATERIALS EXCHANGE');
    expect(artwork).toHaveTextContent(kraftSpec.hazard!.toUpperCase());
    // R4-F1 regression: the real 119-char ppe-join hazard string is forced to the sack's
    // printable panel width rather than overflowing off-canvas.
    const hazardNode = findTextNode(container, kraftSpec.hazard!);
    expect(hazardNode).toHaveAttribute('textLength', '357');
    expect(hazardNode).toHaveAttribute('lengthAdjust', 'spacingAndGlyphs');
  });

  it('renders the woven sack for the B direction, printing the brand string and PPE line', () => {
    const { container } = render(
      <PackagingArtwork
        name="All-Purpose Garden Fertilizer"
        spec={wovenSpec}
        mark=""
        consumptionLabel={null}
      />,
    );
    const artwork = screen.getByRole('img', {
      name: 'All-Purpose Garden Fertilizer woven sack',
    });
    expect(artwork.tagName).toBe('svg');
    expect(artwork).toHaveTextContent('QAREFULLY MATERIALS EXCHANGE');
    expect(artwork).toHaveTextContent('PPE REQUIRED');
    expect(artwork).toHaveTextContent(wovenSpec.hazard!.toUpperCase());
    // R4-F1 regression: real worst-case handling/npk/coverage strings are all width-constrained.
    expect(findTextNode(container, wovenSpec.hazard!)).toHaveAttribute('textLength', '420');
    expect(findTextNode(container, wovenSpec.grade!)).toHaveAttribute('textLength', '264');
    expect(findTextNode(container, wovenSpec.yield!.toUpperCase())).toHaveAttribute(
      'textLength',
      '344',
    );
  });

  it('renders the corrosive keg with the DANGER band, pictogram and vertical CORROSIVE word', () => {
    const { container } = render(
      <PackagingArtwork
        name="Drain Unblocker Powder"
        spec={kegCorrosiveSpec}
        mark=""
        consumptionLabel={null}
      />,
    );
    const artwork = screen.getByRole('img', { name: 'Drain Unblocker Powder keg' });
    expect(artwork).toHaveTextContent('CORROSIVE');
    expect(artwork).toHaveTextContent('DANGER');
    expect(artwork).toHaveTextContent('NEVER USE WITH HOT WATER OR OTHER CHEMICALS.');
    // R4-F1: grade (mixing-group label) and dose (full real dosage sentence) must never collide.
    expect(kegCorrosiveSpec.grade).not.toBe(kegCorrosiveSpec.dose);
    expect(artwork).toHaveTextContent(kegCorrosiveSpec.dose!);
    expect(artwork).toHaveTextContent(kegCorrosiveSpec.grade!.toUpperCase());
    // R4-F1 regression: the "never" clause is forced to the DANGER band's own 200px rect.
    const neverNode = findTextNode(container, kegCorrosiveSpec.never!);
    expect(neverNode).toHaveAttribute('textLength', '184');
    expect(neverNode).toHaveAttribute('lengthAdjust', 'spacingAndGlyphs');
  });

  it('renders the mild keg without the corrosive pictogram, vertical word or DANGER band', () => {
    render(
      <PackagingArtwork
        name="Shoe Deodorising Powder"
        spec={kegMildSpec}
        mark=""
        consumptionLabel={null}
      />,
    );
    const artwork = screen.getByRole('img', { name: 'Shoe Deodorising Powder keg' });
    expect(artwork).not.toHaveTextContent('CORROSIVE');
    expect(artwork).not.toHaveTextContent('DANGER');
  });

  it('dispatches to the locked BagArtwork for the food-bag vessel', () => {
    render(
      <PackagingArtwork
        name="Protein Blend"
        spec={{
          vessel: 'food-bag',
          ink: { ink: '#242522', alert: '#b0381a' },
          brand: 'QAREFULLY MATERIALS EXCHANGE',
          titleLines: titleLines('Protein Blend'),
          sub: 'Sports Nutrition',
          lot: 'SN-01',
          netWeight: '25 kg',
        }}
        mark="PRO"
        accent="#78956c"
        consumptionLabel={null}
      />,
    );
    const artwork = screen.getByRole('img', { name: 'Protein Blend bag' });
    expect(artwork).toHaveTextContent('QAREFULLY MATERIALS EXCHANGE');
  });

  it('supports the decorative ariaLabel="" escape hatch for every vessel', () => {
    const { container: kraft } = render(
      <PackagingArtwork
        name="Portland Cement"
        spec={kraftSpec}
        mark=""
        consumptionLabel={null}
        ariaLabel=""
      />,
    );
    const { container: woven } = render(
      <PackagingArtwork
        name="Fertilizer"
        spec={wovenSpec}
        mark=""
        consumptionLabel={null}
        ariaLabel=""
      />,
    );
    const { container: keg } = render(
      <PackagingArtwork
        name="Drain Unblocker"
        spec={kegCorrosiveSpec}
        mark=""
        consumptionLabel={null}
        ariaLabel=""
      />,
    );
    for (const container of [kraft, woven, keg]) {
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).not.toHaveAttribute('role');
      expect(svg).not.toHaveAttribute('aria-label');
    }
  });

  it('gives independently rendered woven sacks distinct pattern and clip-path identifiers', () => {
    const { container } = render(
      <>
        <PackagingArtwork name="First" spec={wovenSpec} mark="" consumptionLabel={null} />
        <PackagingArtwork name="Second" spec={wovenSpec} mark="" consumptionLabel={null} />
      </>,
    );

    const patterns = Array.from(container.querySelectorAll('pattern'));
    const clipPaths = Array.from(container.querySelectorAll('clipPath'));
    expect(patterns).toHaveLength(4);
    expect(new Set(patterns.map((pattern) => pattern.id)).size).toBe(4);
    expect(clipPaths).toHaveLength(2);
    expect(new Set(clipPaths.map((clip) => clip.id)).size).toBe(2);
  });
});
