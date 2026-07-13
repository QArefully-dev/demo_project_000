export type BagShape = 'tall' | 'gusseted' | 'paper' | 'paper-square' | 'paper-soft' | 'paper-tall';

export type BagDecoration =
  'none' | 'original-dots' | 'base-scatter' | 'asymmetric-spill' | 'label-dusting' | 'paired-ovals';

export interface BagArtworkProps {
  shape: BagShape;
  name: string;
  category: string;
  quantity: string;
  batchCode: string;
  mark: string;
  accent?: string;
  powderAccent?: string;
  decoration?: BagDecoration;
  ariaLabel?: string;
  className?: string;
}

interface LabelProps extends Omit<BagArtworkProps, 'shape' | 'className'> {
  x: number;
  y: number;
  width: number;
  height: number;
  light?: boolean;
  colorBlock?: boolean;
}

function ProductLabel({
  x,
  y,
  width,
  height,
  name,
  category,
  quantity,
  batchCode,
  mark,
  accent = '#9fb3aa',
  light = false,
  colorBlock = false,
}: LabelProps) {
  const background = colorBlock ? accent : light ? '#f2eee4' : '#292b29';
  const foreground = colorBlock ? '#fffaf0' : light ? '#292b29' : '#fbfaf5';
  const muted = colorBlock ? '#e4f0f2' : light ? '#69665e' : '#c9cbc6';
  const headerBackground = colorBlock ? '#292b29' : accent;
  const headerForeground = colorBlock ? '#fffaf0' : '#20211f';
  const footerBackground = colorBlock ? '#292b29' : accent;
  const footerForeground = colorBlock ? '#fffaf0' : '#20211f';
  const normalizedName = name.trim().toUpperCase() || 'POWDER';
  const titleWords = normalizedName.split(/\s+/);
  const splitIndex =
    titleWords.length > 1
      ? Array.from({ length: titleWords.length - 1 }, (_, index) => index + 1).reduce(
          (best, candidate) => {
            const difference = Math.abs(
              titleWords.slice(0, candidate).join(' ').length -
                titleWords.slice(candidate).join(' ').length,
            );
            const bestDifference = Math.abs(
              titleWords.slice(0, best).join(' ').length - titleWords.slice(best).join(' ').length,
            );
            return difference < bestDifference ? candidate : best;
          },
          1,
        )
      : 1;
  const titleLines =
    titleWords.length > 1
      ? [titleWords.slice(0, splitIndex).join(' '), titleWords.slice(splitIndex).join(' ')]
      : [titleWords[0] ?? normalizedName];
  const longestTitleLine = Math.max(...titleLines.map((line) => line.length));
  const titleSize = longestTitleLine > 15 ? 18 : longestTitleLine > 12 ? 21 : 25;

  return (
    <svg x={x} y={y} width={width} height={height} viewBox="0 0 320 236">
      <rect width="320" height="236" rx="8" fill={background} stroke="#242522" strokeWidth="5" />
      <rect x="3" y="3" width="314" height="36" rx="5" fill={headerBackground} />
      <text
        x="18"
        y="27"
        fill={headerForeground}
        fontFamily="Arial, sans-serif"
        fontSize="14"
        fontWeight="800"
        letterSpacing="1.5"
      >
        QAREFULLY POWDER CO.
      </text>
      <circle
        cx="53"
        cy="91"
        r="26"
        fill={colorBlock ? '#dcecf0' : accent}
        stroke={foreground}
        strokeWidth="3"
      />
      <text
        x="53"
        y="97"
        textAnchor="middle"
        fill="#20211f"
        fontFamily="Arial, sans-serif"
        fontSize="15"
        fontWeight="900"
      >
        {mark}
      </text>
      <text
        x="91"
        y="76"
        fill={foreground}
        fontFamily="Arial, sans-serif"
        fontSize={titleSize}
        fontWeight="900"
        letterSpacing="-0.5"
      >
        {titleLines[0]}
      </text>
      {titleLines[1] && (
        <text
          x="91"
          y="103"
          fill={foreground}
          fontFamily="Arial, sans-serif"
          fontSize={Math.min(29, titleSize + 3)}
          fontWeight="900"
          letterSpacing="-0.5"
        >
          {titleLines[1]}
        </text>
      )}
      <text
        x="92"
        y="124"
        fill={muted}
        fontFamily="Arial, sans-serif"
        fontSize="11"
        fontWeight="800"
        letterSpacing="1.7"
      >
        {category.toUpperCase()}
      </text>
      <path d="M18 143H302" stroke={muted} strokeWidth="2" />
      <text
        x="19"
        y="164"
        fill={muted}
        fontFamily="Arial, sans-serif"
        fontSize="9"
        fontWeight="800"
      >
        NET QUANTITY
      </text>
      <text
        x="19"
        y="181"
        fill={foreground}
        fontFamily="Arial, sans-serif"
        fontSize="13"
        fontWeight="900"
      >
        {quantity.toUpperCase()}
      </text>
      <text
        x="183"
        y="164"
        fill={muted}
        fontFamily="Arial, sans-serif"
        fontSize="9"
        fontWeight="800"
      >
        BATCH
      </text>
      <text
        x="183"
        y="181"
        fill={foreground}
        fontFamily="Arial, sans-serif"
        fontSize="13"
        fontWeight="900"
      >
        {batchCode}
      </text>
      <rect x="18" y="195" width="284" height="25" rx="3" fill={footerBackground} />
      <text
        x="160"
        y="212"
        textAnchor="middle"
        fill={footerForeground}
        fontFamily="Arial, sans-serif"
        fontSize="10"
        fontWeight="900"
        letterSpacing="1.1"
      >
        NOT FOR CONSUMPTION
      </text>
    </svg>
  );
}

/** Data-driven inline SVG packaging artwork; no raster files are created. */
export function BagArtwork({
  shape,
  name,
  category,
  quantity,
  batchCode,
  mark,
  accent = '#9fb3aa',
  powderAccent = accent,
  decoration = 'none',
  ariaLabel,
  className,
}: BagArtworkProps) {
  const labelProps = { name, category, quantity, batchCode, mark, accent };

  return (
    <svg
      viewBox="0 0 720 720"
      role={ariaLabel === '' ? undefined : 'img'}
      aria-hidden={ariaLabel === '' ? true : undefined}
      aria-label={ariaLabel === '' ? undefined : (ariaLabel ?? `${name} ${shape} bag design`)}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="360" cy="632" rx="226" ry="30" fill="#252722" opacity="0.12" />

      {shape === 'tall' && (
        <>
          <path
            d="M142 90Q142 74 159 74H561Q578 74 578 90L562 550Q558 625 481 638H239Q162 625 158 550Z"
            fill="#eee9df"
            stroke="#333530"
            strokeWidth="7"
          />
          <path d="M165 105H555" stroke="#d2cabe" strokeWidth="25" />
          <path d="M166 126H554" stroke="#333530" strokeWidth="5" />
          <path d="M180 150H540" stroke="#faf8f2" strokeWidth="4" opacity="0.9" />
          <path d="M205 578Q360 605 515 578" fill="none" stroke="#c9c0b3" strokeWidth="6" />
          <ProductLabel {...labelProps} x={211} y={255} width={298} height={220} />
        </>
      )}

      {shape === 'gusseted' && (
        <>
          <path
            d="M124 148Q124 132 141 132H579Q596 132 596 148L578 548L606 620Q486 648 360 648Q234 648 114 620L142 548Z"
            fill="#eae5dc"
            stroke="#333530"
            strokeWidth="7"
          />
          <path d="M145 146H575" stroke="#faf8f2" strokeWidth="16" />
          <path d="M142 164H578" stroke="#333530" strokeWidth="5" />
          <path d="M142 548L114 620L175 596" fill="#ded7cb" stroke="#333530" strokeWidth="5" />
          <path d="M578 548L606 620L545 596" fill="#ded7cb" stroke="#333530" strokeWidth="5" />
          <path d="M177 596Q360 631 543 596" fill="none" stroke="#bdb4a6" strokeWidth="5" />
          <ProductLabel {...labelProps} x={210} y={280} width={300} height={221} />
        </>
      )}

      {shape === 'paper' && (
        <>
          <path
            d="M173 152L198 78H522L547 152L575 610Q468 640 360 640Q252 640 145 610Z"
            fill="#e7e0d2"
            stroke="#333530"
            strokeWidth="7"
          />
          <path d="M198 78H522L546 152H174Z" fill="#f3efe7" stroke="#333530" strokeWidth="7" />
          <path d="M184 129H536" stroke="#c5bbac" strokeWidth="5" />
          <path d="M548 153L575 610L526 581" fill="#d6cdbf" stroke="#333530" strokeWidth="5" />
          <path d="M194 582Q360 615 526 581" fill="none" stroke="#bdb3a4" strokeWidth="5" />
          <ProductLabel {...labelProps} x={221} y={270} width={278} height={205} light />
        </>
      )}

      {shape === 'paper-square' && (
        <>
          <path
            d="M158 158L192 80H528L562 158L579 592Q579 622 551 630Q360 655 169 630Q141 622 141 592Z"
            fill="#e7e0d2"
            stroke="#333530"
            strokeWidth="7"
          />
          <path d="M192 80H528L562 158H158Z" fill="#f3efe7" stroke="#333530" strokeWidth="7" />
          <path d="M174 130H546" stroke="#c5bbac" strokeWidth="5" />
          <path d="M562 159L579 592L532 574" fill="#d6cdbf" stroke="#333530" strokeWidth="5" />
          <path d="M185 584Q360 614 532 574" fill="none" stroke="#bdb3a4" strokeWidth="5" />
          {decoration !== 'none' && decoration !== 'original-dots' && (
            <g fill={powderAccent}>
              {[
                [418, 607, 6],
                [249, 536, 7],
                [474, 559, 8],
                [305, 582, 9],
                [530, 604, 4],
                [361, 540, 5],
                [192, 563, 6],
                [417, 586, 6],
                [248, 609, 7],
                [472, 545, 8],
                [303, 568, 9],
                [528, 590, 4],
                [359, 613, 5],
                [191, 549, 5],
                [415, 572, 6],
                [246, 595, 7],
              ].map(([cx, cy, r], index) => (
                <circle key={index} cx={cx} cy={cy} r={r} opacity={index % 3 === 0 ? 0.72 : 0.9} />
              ))}
            </g>
          )}
          {decoration === 'original-dots' && (
            <g fill={powderAccent}>
              <ellipse cx="330" cy="535" rx="88" ry="28" opacity="0.76" />
              <ellipse cx="401" cy="542" rx="82" ry="26" opacity="0.94" />
              {[
                [126, 540, 5],
                [154, 517, 7],
                [188, 562, 4],
                [225, 501, 6],
                [252, 550, 5],
                [282, 516, 8],
                [315, 574, 4],
                [348, 505, 5],
                [384, 561, 7],
                [416, 511, 4],
                [449, 571, 6],
                [474, 526, 8],
                [510, 558, 5],
                [547, 503, 6],
                [581, 541, 7],
                [604, 566, 4],
              ].map(([cx, cy, r], index) => (
                <circle key={index} cx={cx} cy={cy} r={r} opacity={index % 4 === 0 ? 0.68 : 0.9} />
              ))}
            </g>
          )}
          {decoration === 'base-scatter' && (
            <g fill={powderAccent}>
              <ellipse cx="337" cy="548" rx="92" ry="28" opacity="0.75" />
              <ellipse cx="405" cy="557" rx="76" ry="24" opacity="0.9" />
            </g>
          )}
          {decoration === 'asymmetric-spill' && (
            <g fill={powderAccent}>
              <ellipse cx="294" cy="543" rx="91" ry="27" opacity="0.9" />
              <ellipse cx="243" cy="528" rx="58" ry="20" opacity="0.68" />
            </g>
          )}
          {decoration === 'label-dusting' && (
            <g fill={powderAccent}>
              <ellipse cx="366" cy="509" rx="80" ry="23" opacity="0.82" />
              <ellipse cx="420" cy="518" rx="55" ry="19" opacity="0.62" />
              <circle cx="244" cy="360" r="9" opacity="0.72" />
              <circle cx="260" cy="405" r="5" opacity="0.58" />
              <circle cx="477" cy="382" r="8" opacity="0.7" />
              <circle cx="492" cy="430" r="5" opacity="0.55" />
              <circle cx="235" cy="451" r="4" opacity="0.48" />
              <circle cx="468" cy="475" r="4" opacity="0.5" />
            </g>
          )}
          {decoration === 'paired-ovals' && (
            <g fill={powderAccent}>
              <ellipse cx="330" cy="544" rx="76" ry="25" opacity="0.65" />
              <ellipse cx="399" cy="548" rx="88" ry="28" opacity="0.9" />
            </g>
          )}
          <ProductLabel {...labelProps} x={215} y={270} width={290} height={214} colorBlock />
        </>
      )}

      {shape === 'paper-soft' && (
        <>
          <path
            d="M176 151Q151 242 157 364L145 553Q140 616 207 633Q360 655 513 633Q580 616 575 553L563 364Q569 242 544 151Z"
            fill="#e7e0d2"
            stroke="#333530"
            strokeWidth="7"
          />
          <path
            d="M184 88H536L548 151Q457 165 360 154Q263 165 172 151Z"
            fill="#f3efe7"
            stroke="#333530"
            strokeWidth="7"
          />
          <path d="M185 116H535" stroke="#c5bbac" strokeWidth="5" />
          <path d="M176 151Q360 177 544 151" fill="none" stroke="#bdb3a4" strokeWidth="5" />
          <path d="M198 588Q360 620 522 588" fill="none" stroke="#bdb3a4" strokeWidth="5" />
          <ProductLabel {...labelProps} x={219} y={275} width={282} height={208} light />
        </>
      )}

      {shape === 'paper-tall' && (
        <>
          <path
            d="M203 137L221 68H499L517 137L552 607Q460 640 360 640Q260 640 168 607Z"
            fill="#e7e0d2"
            stroke="#333530"
            strokeWidth="7"
          />
          <path d="M221 68H499L517 137H203Z" fill="#f3efe7" stroke="#333530" strokeWidth="7" />
          <path d="M213 111H507" stroke="#c5bbac" strokeWidth="5" />
          <path d="M517 138L552 607L508 581" fill="#d6cdbf" stroke="#333530" strokeWidth="5" />
          <path d="M209 581Q360 614 508 581" fill="none" stroke="#bdb3a4" strokeWidth="5" />
          <ProductLabel {...labelProps} x={228} y={263} width={264} height={195} light />
        </>
      )}
    </svg>
  );
}
