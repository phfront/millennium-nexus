'use client';

import { useId } from 'react';

/** Superfície da onda (morphing `d` em 0 / 25 / 50 / 75 / 100%). */
const PATH_B_0 =
  'M 0,400 L 0,233 C 71.04568876674679,253.388869804191 142.09137753349358,273.777739608382 218,272 C 293.9086224665064,270.222260391618 374.68017863277225,246.277911370663 443,232 C 511.31982136722775,217.722088629337 567.1879079354173,213.11061490896603 630,205 C 692.8120920645827,196.88938509103397 762.5681896255581,185.27962899347304 828,184 C 893.4318103744419,182.72037100652696 954.5393335623498,191.77086911714184 1017,208 C 1079.4606664376502,224.22913088285816 1143.274476125043,247.63689453795945 1214,253 C 1284.725523874957,258.36310546204055 1362.3627619374784,245.68155273102028 1440,233 L 1440,400 L 0,400 Z';

const PATH_B_25 =
  'M 0,400 L 0,233 C 83.44829955341808,250.50669872895912 166.89659910683616,268.01339745791824 225,257 C 283.10340089316384,245.98660254208176 315.8619031260734,206.45310889728614 375,198 C 434.1380968739266,189.54689110271386 519.6557883888698,212.17416695293716 599,210 C 678.3442116111302,207.82583304706284 751.5149433184473,180.8502232909653 823,194 C 894.4850566815527,207.1497767090347 964.2844383373413,260.42493988320166 1036,261 C 1107.7155616626587,261.57506011679834 1181.347303332188,209.4500171762281 1249,196 C 1316.652696667812,182.5499828237719 1378.326348333906,207.77499141188594 1440,233 L 1440,400 L 0,400 Z';

const PATH_B_50 =
  'M 0,400 L 0,233 C 57.30195809000345,222.40707660597732 114.6039161800069,211.81415321195465 181,227 C 247.3960838199931,242.18584678804535 322.88629336997593,283.1504637581587 398,276 C 473.11370663002407,268.8495362418413 547.8509103400894,213.5839917554105 614,195 C 680.1490896599106,176.4160082445895 737.7100652696669,194.5135692201993 809,212 C 880.2899347303331,229.4864307798007 965.3088285812435,246.3617313637925 1046,257 C 1126.6911714187565,267.6382686362075 1203.054620405359,272.03950532463074 1268,267 C 1332.945379594641,261.96049467536926 1386.4726897973205,247.48024733768463 1440,233 L 1440,400 L 0,400 Z';

const PATH_B_75 =
  'M 0,400 L 0,233 C 50.852627962899334,241.01855032634833 101.70525592579867,249.03710065269667 175,257 C 248.29474407420133,264.96289934730333 344.0316042597046,272.87014771556164 417,260 C 489.9683957402954,247.12985228443836 540.1683270353831,213.4823084850567 613,200 C 685.8316729646169,186.5176915149433 781.2950875987633,193.2006183442116 859,214 C 936.7049124012367,234.7993816557884 996.651322569564,269.71521813809693 1052,268 C 1107.348677430436,266.28478186190307 1158.0996221229816,227.9385091034009 1222,216 C 1285.9003778770184,204.0614908965991 1362.9501889385092,218.53074544829957 1440,233 L 1440,400 L 0,400 Z';

function cssPath(d: string) {
  return `path("${d}")`;
}

function buildKeyframes(name: string, p0: string, p25: string, p50: string, p75: string) {
  return `@keyframes ${name}{
0%{d:${cssPath(p0)};}
25%{d:${cssPath(p25)};}
50%{d:${cssPath(p50)};}
75%{d:${cssPath(p75)};}
100%{d:${cssPath(p0)};}
}`;
}

/** Recorte vertical do viewBox: menos altura em unidades SVG = ondas mais subtis no ecrã. */
const VB_X = 0;
const VB_Y = 248;
const VB_W = 1440;
const VB_H = 400 - VB_Y;
/**
 * Mapeamento linear em Y: crista (~PATH_Y_MIN) → topo do recorte (`VB_Y`); y=400 mantém-se no fundo.
 * Evita `translate` após `scale`, que subia a onda mas descolava a base do líquido.
 */
const PATH_Y_MIN = 176;
const WAVE_MAP_A = (400 - VB_Y) / (400 - PATH_Y_MIN);
const WAVE_MAP_B = 400 * (1 - WAVE_MAP_A);

export function HydrationMorphingWaves() {
  const raw = useId().replace(/:/g, '');
  const uid = `w${raw}`;
  const gradFrontId = `hydration-morph-grad-f-${uid}`;
  const gradBackId = `hydration-morph-grad-b-${uid}`;
  const kf = `hydrationMorph_${uid}`;
  const clsBack = `hydration-morph-back-${uid}`;
  const clsFront = `hydration-morph-front-${uid}`;

  const css = `
.${clsBack}{
  animation:${kf} 5.2s ease-in-out infinite;
  animation-delay:-2.6s;
}
.${clsFront}{
  animation:${kf} 5.2s ease-in-out infinite;
}
${buildKeyframes(kf, PATH_B_0, PATH_B_25, PATH_B_50, PATH_B_75)}
@media (prefers-reduced-motion: reduce){
.${clsBack},.${clsFront}{animation:none!important;}
}
`;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      className="isolate block h-full w-full transform-gpu"
      shapeRendering="geometricPrecision"
      aria-hidden
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <defs>
        <linearGradient id={gradBackId} x1="52%" y1="0%" x2="48%" y2="100%">
          <stop offset="4%" stopColor="#023a5c" />
          <stop offset="55%" stopColor="#0b4f8c" />
          <stop offset="96%" stopColor="#3d8bd9" />
        </linearGradient>
        <linearGradient id={gradFrontId} x1="67%" y1="2%" x2="33%" y2="98%">
          <stop offset="4%" stopColor="#0a7ccf" />
          <stop offset="92%" stopColor="#9fe0ff" />
        </linearGradient>
      </defs>
      {/* Coluna de água no recorte visível — os paths só pintam abaixo da crista; sem isto fica “vazio” acima da onda. */}
      <rect
        x={VB_X}
        y={VB_Y}
        width={VB_W}
        height={VB_H}
        fill={`url(#${gradBackId})`}
        fillOpacity={0}
      />
      {/* Crista encosta em y = VB_Y (topo do rect / viewBox); fundo em y = 400. */}
      <g transform={`matrix(1, 0, 0, ${WAVE_MAP_A}, 0, ${WAVE_MAP_B})`}>
        {/* Segunda onda: deslocamento reduzido = menos “volume” duplo */}
        <g transform="translate(0, -4)">
          <path
            d={PATH_B_0}
            fill={`url(#${gradBackId})`}
            fillOpacity={0.42}
            stroke="none"
            strokeWidth={0}
            className={clsBack}
          />
        </g>
        <path
          d={PATH_B_0}
          fill={`url(#${gradFrontId})`}
          fillOpacity={0.3}
          stroke="none"
          strokeWidth={0}
          className={clsFront}
        />
      </g>
    </svg>
  );
}
