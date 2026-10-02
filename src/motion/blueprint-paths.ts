// Blueprint lines for the home hero (T15), traced over brand/assets/photos/hero-structure.png.
// Coordinates are SOURCE pixels of that 1536x1024 photo; the phone image is a crop of it, so the same
// data serves both (only the SVG viewBox changes). Each segment is [x1, y1, x2, y2, order]: it draws
// from (x1, y1) to (x2, y2), and `order` sequences it inside its group (columns from the near corner
// out, beams floor by floor from the ground up, braces bottom first, crane mast then jib then ties).
// Traced by hand from zoomed crops, then snapped to the steel with a luminance search
// (each line sits on its member's centre line, within about 2px of source).

export type Group = 'column' | 'beam' | 'brace' | 'crane';
export type Seg = readonly [x1: number, y1: number, x2: number, y2: number, order: number];

export const SOURCE = { w: 1536, h: 1024 } as const;
// Must match src/images.json "hero-structure-phone".crop (a test checks).
export const PHONE_CROP = { x: 171, y: 0, w: 1365, h: 1024 } as const;

export const PATHS: Readonly<Record<Group, readonly Seg[]>> = {
  // Columns of the two visible faces (near corner at x 935), bottom up, plus two seen through the frame.
  column: [
    [935, 910, 935, 225, 0], [825, 910, 826, 250, 1], [1051, 910, 1051, 267, 1], [657, 910, 662, 313, 2],
    [1148, 910, 1147, 319, 2], [596, 910, 601, 336, 3], [1253, 910, 1253, 371, 3], [687, 738, 687, 345, 4],
    [1224, 910, 1222, 478, 4], [1276, 910, 1276, 454, 4],
  ],
  // Ground line, the two concrete slabs (top and bottom edges), five steel floors, then the roof grid.
  // Every face beam runs out from the near corner.
  beam: [
    [937, 913, 440, 913, 0], [937, 913, 1455, 913, 0],
    [937, 801, 580, 823, 1], [937, 816, 580, 836, 1], [937, 801, 1290, 831, 1], [937, 816, 1290, 846, 1],
    [937, 704, 580, 742, 2], [937, 719, 580, 756, 2], [937, 704, 1290, 760, 2], [937, 719, 1290, 773, 2],
    [937, 610, 597, 669, 3], [937, 614, 1277, 692, 3], [936, 516, 597, 589, 4], [938, 517, 1276, 617, 4],
    [937, 422, 597, 511, 5], [938, 422, 1278, 546, 5], [937, 329, 597, 434, 6], [937, 330, 1277, 475, 6],
    [936, 230, 598, 351, 7], [936, 238, 1253, 393, 7],
    [829, 285, 931, 325, 8], [658, 332, 801, 389, 8], [1046, 293, 945, 314, 8], [1145, 338, 1062, 347, 8],
  ],
  // The X braces between the near corner and the next column on the left face.
  brace: [
    [840, 638, 928, 703, 0], [927, 627, 843, 713, 0], [839, 549, 928, 607, 1], [927, 532, 836, 616, 1],
  ],
  // Mast rails and base, cat head, jib chords and counter-jib, then the ties and the hook line.
  crane: [
    [1315, 895, 1315, 240, 0], [1355, 895, 1355, 240, 0], [1298, 895, 1372, 895, 0],
    [1332, 90, 1319, 182, 1], [1338, 89, 1352, 180, 1],
    [1312, 161, 763, 61, 2], [1312, 179, 763, 76, 2], [1356, 196, 1490, 207, 2],
    [1339, 92, 1461, 202, 3], [1330, 96, 935, 89, 3], [1237, 182, 1237, 330, 3],
  ],
};
