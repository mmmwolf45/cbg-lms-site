// The scroll-played frame sets (hero explode.ts, band site-orbit.ts, course films course-story.ts). Each
// frame's AVIF bytes are fetched once and kept (30 to 60 KB each); only the frames within R of the one on
// show are decoded, off the main thread (createImageBitmap), into bitmaps the canvas draws with no decode
// of its own, two at a time, nearest first; frames further than R + 2 are closed again, so a phone holds
// a dozen decoded frames, not a film. Measured 6 Oct 2026 on an Intel UHD laptop: drawing the AVIF <img>s
// made Chrome decode them again on the main thread at paint (50 to 220 ms a frame, the lag Maasoom saw).
// Frames are fetched with CORS (GitHub Pages sends Access-Control-Allow-Origin: *). Decoding straight to the
// canvas's size (createImageBitmap's resizeWidth) was tried for the course films and dropped: in Chrome it
// brought back long main-thread tasks (12 a run with a 4x slower CPU, against 1).
export type Frames = ReturnType<typeof frameSet>;

// Decodes off the main thread. A browser that can't make a bitmap straight from the bytes decodes them as
// an <img> first (and still draws a bitmap).
const bitmap = (b: Blob) =>
  createImageBitmap(b).catch(() => {
    const img = new Image();
    img.src = URL.createObjectURL(b);
    return img.decode().then(() => createImageBitmap(img)).finally(() => URL.revokeObjectURL(img.src));
  });

export function frameSet(url: (i: number) => string, n: number, onDecoded: () => void, R = 6) {
  const blobs: (Blob | undefined)[] = [];
  const bits: (ImageBitmap | undefined)[] = [];
  const busy = new Set<number>();
  let at = 0, dead = false;
  const pump = () => {
    for (let d = 0; d <= R && busy.size < 2; d++) for (const j of [at + d, at - d]) {
      const blob = blobs[j];
      if (!blob || bits[j] || busy.has(j) || busy.size >= 2) continue;
      busy.add(j);
      bitmap(blob).then((b) => {
        if (dead || Math.abs(j - at) > R + 2) return b.close();
        bits[j] = b;
        onDecoded();
      }, () => {}).finally(() => {
        busy.delete(j);
        if (!dead) pump();
      });
    }
  };
  return {
    n,
    // Fetches frame i's bytes; true once they are in. decode: also decode it now (the first frame: a set
    // whose first frame can't be decoded, AVIF unsupported, isn't used at all).
    load: (i: number, decode = false) =>
      fetch(url(i), { priority: i ? 'low' : 'high' } as RequestInit)
        .then((r) => (r.ok ? r.blob() : Promise.reject()))
        .then(async (b) => {
          if (decode) bits[i] = await bitmap(b);
          blobs[i] = b;
          pump();
          return !dead;
        })
        .catch(() => false),
    loaded: (i: number) => !!blobs[i],
    // The frame on show is about i: decode around it, close the far ones.
    focus(i: number) {
      at = Math.max(0, Math.min(n - 1, Math.round(i)));
      bits.forEach((b, j) => {
        if (b && Math.abs(j - at) > R + 2) {
          b.close();
          bits[j] = undefined;
        }
      });
      pump();
    },
    get: (j: number) => bits[j],
    // Close every decoded frame (the bytes stay): a chapter the story has left.
    drop() {
      bits.forEach((b) => b?.close());
      bits.length = 0;
    },
    nearest(i: number) {
      for (let d = 0; d < n; d++) for (const j of [i - d, i + d]) if (bits[j]) return j;
      return -1;
    },
    close() {
      dead = true;
      this.drop();
    },
  };
}
