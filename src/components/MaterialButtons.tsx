"use client";

/*
  Partnermaterialet er tekst genereret ud fra forslaget — ikke et separat
  dokument der kan komme ud af trit. Preview åbner det i en ny fane, download
  gemmer det som en fil.
*/
export function MaterialButtons({ filename, content }: { filename: string; content: string }) {
  function blobUrl() {
    return URL.createObjectURL(new Blob([content], { type: "text/markdown" }));
  }

  function preview() {
    const url = blobUrl();
    window.open(url, "_blank");
  }

  function download() {
    const url = blobUrl();
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={preview}
        className="rounded-md border border-(--color-line) px-2.5 py-1 text-[11px] font-medium text-(--color-muted) transition-colors hover:border-(--color-clay-line) hover:text-(--color-text)"
      >
        Preview materiale
      </button>
      <button
        onClick={download}
        className="rounded-md border border-(--color-clay) px-2.5 py-1 text-[11px] font-medium text-(--color-clay) transition-opacity hover:opacity-80"
      >
        Download
      </button>
    </div>
  );
}
