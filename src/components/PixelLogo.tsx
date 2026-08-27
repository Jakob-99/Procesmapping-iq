const PIXEL_FONT: Record<string, string[]> = {
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  N: ["10001", "11001", "10101", "10101", "10011", "10001", "10001"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10011", "01111"],
  " ": ["000", "000", "000", "000", "000", "000", "000"],
};

const WORD = "CORNER IQ";
const PIXEL = 10;

/* Pixel-logoet der åbner hjernens forside, før man har spurgt om noget. */
export function PixelLogo() {
  return (
    <div className="flex justify-start gap-3.5">
      {[...WORD].map((ch, i) => {
        const pattern = PIXEL_FONT[ch];
        const cols = pattern[0].length;
        return (
          <div
            key={i}
            className="grid gap-0.5"
            style={{
              gridTemplateColumns: `repeat(${cols}, ${PIXEL}px)`,
              gridTemplateRows: `repeat(7, ${PIXEL}px)`,
            }}
          >
            {pattern.flatMap((row, r) =>
              [...row].map((bit, c) => (
                <div
                  key={`${r}-${c}`}
                  style={{
                    width: PIXEL,
                    height: PIXEL,
                    background: bit === "1" ? "var(--color-clay)" : "transparent",
                  }}
                />
              )),
            )}
          </div>
        );
      })}
    </div>
  );
}
