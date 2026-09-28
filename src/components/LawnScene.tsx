/*
  Plænen nederst på forsiden: en lille pixelfigur der møjsommeligt skubber
  en orange hjørnesten fra venstre mod højre — et tungt skub ad gangen, så en
  pause hvor den tager sig sammen (og sveder lidt), og videre. Samme
  pixelstil som Corner IQ-logoet. Ren CSS-animation; står stille hvis
  brugeren har slået bevægelse fra (prefers-reduced-motion).
*/

const PX = 4; // én pixel i tegningen = 4 skærm-pixels

const COLORS: Record<string, string> = {
  H: "#3a2d22", // hår
  S: "#d9a37a", // hud
  T: "#6b5a4c", // trøje
  A: "#7d6a5a", // ærme
  P: "#241c17", // bukser
  B: "#14100c", // støvler
};

// Figuren læner sig frem mod stenen med armene strakt ud.
const BODY = [
  "......HHH.....",
  ".....HHHHH....",
  ".....HSSSS....",
  ".....HSSSS....",
  "......SSS.....",
  "....TTTTAAAAS.",
  "...TTTTTAAAAS.",
  "...TTTTT......",
  "..TTTTT.......",
  "..PPPPP.......",
  ".PPP.PP.......",
];
// To skridt-positioner, der skiftes mellem mens den skubber.
const LEGS_A = [
  ".PP...PP......",
  "PP.....PP.....",
  "PP......PP....",
  "BB......BB....",
  "BBB.....BBB...",
];
const LEGS_B = [
  "..PP.PP.......",
  "..PP..PP......",
  ".PP...PP......",
  ".BB...BB......",
  ".BBB..BBB.....",
];

function Sprite({ rows, y0 = 0, className }: { rows: string[]; y0?: number; className?: string }) {
  return (
    <g className={className}>
      {rows.flatMap((row, r) =>
        [...row].map((ch, c) =>
          COLORS[ch] ? (
            <rect key={`${r}-${c}`} x={c * PX} y={(r + y0) * PX} width={PX} height={PX} fill={COLORS[ch]} />
          ) : null,
        ),
      )}
    </g>
  );
}

// Hjørnestenen: 12×12 pixels i clay med lys kant øverst/venstre og mørk
// nederst/højre, og en lille revne.
function Stone() {
  const cells: { x: number; y: number; fill: string }[] = [];
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      let fill = "#e35f1e";
      if (y === 0 || x === 0) fill = "#f0894a";
      if (y === 11 || x === 11) fill = "#b8481a";
      if ((x === 7 && y >= 3 && y <= 5) || (x === 8 && y === 6) || (x === 3 && y === 8)) fill = "#c9531b";
      cells.push({ x, y, fill });
    }
  }
  return (
    <g>
      {cells.map((c) => (
        <rect key={`${c.x}-${c.y}`} x={c.x * PX} y={c.y * PX} width={PX} height={PX} fill={c.fill} />
      ))}
    </g>
  );
}

// Æbletræet i højre side: en krone af overlappende cirkler med lys kant
// foroven, mørk forneden og lidt spredte blade, en stamme med rodhals og
// røde æbler. 40×50 pixels.
const TPX = 5; // træet tegnes lidt større end figuren
const TREE_W = 40;
const TREE_H = 50;
const CROWN: [number, number, number][] = [
  [20, 13, 12],
  [10, 19, 9],
  [30, 19, 9],
  [13, 9, 8],
  [27, 9, 8],
  [20, 22, 10],
];
const APPLES: [number, number][] = [
  [9, 17],
  [16, 11],
  [24, 6],
  [31, 14],
  [21, 20],
  [13, 24],
  [28, 23],
  [35, 20],
];
const FALLING_APPLE: [number, number] = [26, 27];

function inCrown(x: number, y: number) {
  return CROWN.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
}

function Tree() {
  const cells: { x: number; y: number; fill: string }[] = [];
  for (let y = 0; y < TREE_H; y++) {
    for (let x = 0; x < TREE_W; x++) {
      // Stamme (bag kronen), bredere nederst og med to små grene
      const trunk =
        (y >= 24 && x >= 18 && x <= 21) ||
        (y >= 46 && x >= 17 && x <= 22) ||
        (y === 49 && (x === 16 || x === 23)) ||
        (y >= 27 && y <= 29 && x === 17 - (y - 27)) ||
        (y >= 26 && y <= 28 && x === 22 + (y - 26));
      if (inCrown(x, y)) {
        const h = (x * 73 + y * 151) % 17;
        let fill = "#5f8a4f";
        if (!inCrown(x, y - 1) || !inCrown(x - 1, y - 1)) fill = "#86ad68";
        else if (!inCrown(x, y + 1) || !inCrown(x + 1, y + 1)) fill = "#44693b";
        else if (h === 0 || h === 5) fill = "#4d7543";
        else if (h === 9) fill = "#76a05e";
        cells.push({ x, y, fill });
      } else if (trunk) {
        let fill = "#7a5a3e";
        if (x === 18 || x === 17 || x === 16) fill = "#94704f";
        if (x === 21 || x === 22 || x === 23) fill = "#5e4430";
        if ((x === 20 && (y === 33 || y === 34)) || (x === 19 && y === 40)) fill = "#5e4430";
        cells.push({ x, y, fill });
      }
    }
  }
  return (
    <svg width={TREE_W * TPX} height={TREE_H * TPX} style={{ overflow: "visible" }}>
      {cells.map((c) => (
        <rect key={`${c.x}-${c.y}`} x={c.x * TPX} y={c.y * TPX} width={TPX} height={TPX} fill={c.fill} />
      ))}
      {APPLES.map(([x, y]) => (
        <Apple key={`${x}-${y}`} x={x} y={y} />
      ))}
      {/* Et æble der en gang imellem falder ned i græsset */}
      <g className="lawn-apple">
        <Apple x={FALLING_APPLE[0]} y={FALLING_APPLE[1]} />
      </g>
    </svg>
  );
}

function Apple({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x * TPX} y={y * TPX} width={2 * TPX} height={2 * TPX} fill="#c8402a" />
      <rect x={x * TPX} y={y * TPX} width={TPX} height={TPX} fill="#e8735a" />
      <rect x={(x + 1) * TPX} y={(y + 1) * TPX} width={TPX} height={TPX} fill="#9e3020" />
      <rect x={(x + 1) * TPX} y={(y - 1) * TPX} width={TPX} height={TPX} fill="#5e4430" />
    </g>
  );
}

// Keyframes for det besværlige skub: N skub, hvert med et træk fremad og en
// pause. Stenen tipper en anelse i hvert skub.
function pushKeyframes(n: number) {
  const lines: string[] = [];
  const start = -140;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 100;
    const p = i / n;
    const pos = `calc((100% + 180px) * ${p.toFixed(4)} + ${start}px)`;
    lines.push(`${t.toFixed(3)}% { left: ${pos}; }`);
    if (i < n) {
      // Hold stille den sidste del af hvert skub-segment
      const hold = ((i + 0.62) / n) * 100;
      const pNext = (i + 1) / n;
      lines.push(`${hold.toFixed(3)}% { left: calc((100% + 180px) * ${pNext.toFixed(4)} + ${start}px); }`);
    }
  }
  return lines.join("\n");
}

const N = 14;
const DURATION = 70; // sekunder over hele plænen
const SEG = DURATION / N;

const CSS = `
@keyframes lawn-push { ${pushKeyframes(N)} }
@keyframes lawn-legs { 0%, 49.99% { opacity: 1; } 50%, 100% { opacity: 0; } }
@keyframes lawn-legs-b { 0%, 49.99% { opacity: 0; } 50%, 100% { opacity: 1; } }
@keyframes lawn-strain {
  0%, 62% { transform: translateY(0); }
  70% { transform: translateY(2px); }
  80% { transform: translateY(0); }
  90% { transform: translateY(2px); }
  100% { transform: translateY(0); }
}
@keyframes lawn-tilt {
  0% { transform: rotate(0deg); }
  30% { transform: rotate(-2deg); }
  62% { transform: rotate(0deg); }
  100% { transform: rotate(0deg); }
}
@keyframes lawn-sweat {
  0%, 62% { opacity: 0; transform: translate(0, 0); }
  70% { opacity: 1; transform: translate(0, 0); }
  95% { opacity: 0; transform: translate(-6px, 10px); }
  100% { opacity: 0; }
}
@keyframes lawn-apple {
  0%, 78% { transform: translate(0, 0); opacity: 1; }
  84% { transform: translate(0, ${20 * TPX}px); }
  86% { transform: translate(${TPX}px, ${18 * TPX}px); }
  88% { transform: translate(${2 * TPX}px, ${20 * TPX}px); opacity: 1; }
  97% { transform: translate(${2 * TPX}px, ${20 * TPX}px); opacity: 1; }
  100% { transform: translate(${2 * TPX}px, ${20 * TPX}px); opacity: 0; }
}
.lawn-apple { animation: lawn-apple 17s ease-in infinite; }
.lawn-mover { position: absolute; bottom: 38px; left: -140px; animation: lawn-push ${DURATION}s ease-in-out infinite; }
.lawn-legs-a { animation: lawn-legs 0.5s steps(1) infinite; }
.lawn-legs-b { animation: lawn-legs-b 0.5s steps(1) infinite; }
.lawn-body { animation: lawn-strain ${SEG}s ease-in-out infinite; }
.lawn-stone { transform-box: fill-box; transform-origin: 100% 100%; animation: lawn-tilt ${SEG}s ease-in-out infinite; }
.lawn-sweat { animation: lawn-sweat ${SEG}s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .lawn-mover { animation: none; left: 30%; }
  .lawn-legs-a, .lawn-legs-b, .lawn-body, .lawn-stone, .lawn-sweat, .lawn-apple { animation: none; }
  .lawn-legs-b, .lawn-sweat { opacity: 0; }
}
`;

// Et stykke græs der gentages i hele bredden: strå i to grønne nuancer og en
// enkelt blomst, lagt oven på en mørkere græsflade og en stribe jord.
function GrassPattern({ id, front }: { id: string; front?: boolean }) {
  // Forreste strå er lave (højst 4 pixels) og står nede ved fødderne; de
  // bagerste er højere og står bag figuren.
  const blades = front
    ? [[2, 3], [9, 2], [15, 4], [22, 2], [29, 3], [35, 2], [41, 4], [47, 3], [53, 2], [58, 3]]
    : [[0, 3], [3, 5], [6, 2], [9, 4], [12, 3], [15, 6], [18, 2], [21, 4], [24, 3], [28, 5], [31, 2], [34, 4], [37, 3], [40, 5], [43, 2], [46, 4], [49, 3], [52, 5], [55, 2], [58, 4]];
  const rows = front ? 4 : 8;
  return (
    <pattern id={id} width={60 * PX / 2} height={rows * PX} patternUnits="userSpaceOnUse">
      {blades.map(([x, h], i) => (
        <rect
          key={i}
          x={(x * PX) / 2}
          y={(rows - h) * PX}
          width={PX}
          height={h * PX}
          fill={front ? "#5f8a4f" : i % 2 ? "#6f9a56" : "#86ad68"}
        />
      ))}
      {!front && (
        // En lille blomst: kronblade om en midte, på en stilk
        <>
          <rect x={(26 * PX) / 2} y={2 * PX} width={PX} height={PX} fill="#f0894a" />
          <rect x={(26 * PX) / 2 - PX} y={3 * PX} width={PX} height={PX} fill="#f0894a" />
          <rect x={(26 * PX) / 2} y={3 * PX} width={PX} height={PX} fill="#fdf0e6" />
          <rect x={(26 * PX) / 2 + PX} y={3 * PX} width={PX} height={PX} fill="#f0894a" />
          <rect x={(26 * PX) / 2} y={4 * PX} width={PX} height={PX} fill="#f0894a" />
          <rect x={(26 * PX) / 2} y={5 * PX} width={PX} height={3 * PX} fill="#5f8a4f" />
        </>
      )}
    </pattern>
  );
}

export function LawnScene() {
  return (
    // På brede skærme er plænen højere, så æbletræet kan rage op i den tomme
    // plads til højre over plænen (pointer-events-none, så intet bliver dækket).
    <div
      className="pointer-events-none relative h-[120px] w-full overflow-hidden md:-mt-[170px] md:h-[290px]"
      aria-hidden
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Æbletræet i højre side, bag figuren og græsstråene */}
      <div className="absolute bottom-[36px] right-[7%] hidden md:block">
        <Tree />
      </div>

      {/* Baggrund: strå, græsflade og jord */}
      <svg className="absolute bottom-0 left-0 h-[70px] w-full" preserveAspectRatio="none">
        <GrassPattern id="lawn-back" />
        <rect x="0" y="0" width="100%" height={8 * PX} fill="url(#lawn-back)" />
        <rect x="0" y={8 * PX} width="100%" height="26" fill="#6f9a56" />
        <rect x="0" y={8 * PX + 26} width="100%" height="4" fill="#5f8a4f" />
        <rect x="0" y={8 * PX + 30} width="100%" height="8" fill="#b89a74" />
      </svg>

      {/* Figuren og stenen */}
      <div className="lawn-mover">
        <svg width={27 * PX} height={17 * PX} style={{ overflow: "visible" }}>
          <g className="lawn-body">
            <Sprite rows={BODY} />
            <rect className="lawn-sweat" x={4 * PX} y={1 * PX} width={PX} height={PX} fill="#9fb7c4" />
          </g>
          <Sprite rows={LEGS_A} y0={BODY.length} className="lawn-legs-a" />
          <Sprite rows={LEGS_B} y0={BODY.length} className="lawn-legs-b" />
          <g transform={`translate(${13 * PX}, ${4 * PX})`}>
            <g className="lawn-stone">
              <Stone />
            </g>
          </g>
        </svg>
      </div>

      {/* Forreste strå, så fødderne og stenen står lidt nede i græsset */}
      <svg className="pointer-events-none absolute bottom-[34px] left-0 h-[16px] w-full">
        <GrassPattern id="lawn-front" front />
        <rect x="0" y={0} width="100%" height={4 * PX} fill="url(#lawn-front)" />
      </svg>
    </div>
  );
}
