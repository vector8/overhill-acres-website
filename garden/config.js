// ============================================================
//  GARDEN SITE CONFIG
// ============================================================
//
//  1. Create a Google Sheet with two tabs named exactly:
//       - "Beds"
//       - "Plants"
//
//     "Beds" columns (header row required):
//       id | name | is_greenhouse | photos | notes | updated | order | row | col
//       - id:            short unique id, e.g.  bed1, bed2, gh
//       - name:          display name, e.g.  "Bed 1: Brassicas"
//       - is_greenhouse: TRUE / FALSE  (styles the card differently)
//       - photos:        one or more Google Drive share links,
//                        separated by commas or newlines.
//                        Share each photo as "Anyone with the link".
//       - notes:         optional short text shown at the bottom
//       - updated:       optional date (YYYY-MM-DD) for the bed
//       - order:         optional number — beds display low-to-high.
//                        Beds without an order fall back to sheet
//                        row order (and appear after numbered beds).
//       - row / col:     optional 1-based grid position to lay beds
//                        out spatially (row 1 = top, col 1 = left).
//                        Example: a bed at row=2, col=3 sits in the
//                        2nd row, 3rd column. Empty cells become
//                        gaps (great for representing paths).
//                        Mode kicks in if ANY bed has row or col set.
//                        Unplaced beds auto-fill remaining cells.
//                        Falls back to a single column on phones.
//       - row_span /     optional — make a bed cover multiple cells.
//         col_span       Use a number (e.g. col_span=2 → two cells wide)
//                        or the word "all" to stretch across the whole
//                        row/column. Example for a greenhouse that fills
//                        the top row: row=1, col=1, col_span=all.
//
//     "Plants" columns (header row required):
//       bed_id | name | percent | stage | notes | updated
//       - bed_id:   matches an id from the Beds tab
//       - name:     plant name, e.g.  "Cherry tomatoes"
//       - percent:  number 0-100 (how much of the bed it occupies)
//       - stage:    one of: Seed, Sprouted, Growing, Flowering, Fruiting
//       - notes:    optional short note
//       - updated:  optional date (YYYY-MM-DD)
//
//  2. File > Share > Publish to web > "Entire document" > CSV.
//     (This makes the gviz endpoint readable without auth.)
//     Also: Share > "Anyone with the link" = Viewer.
//
//  3. Copy the sheet ID from the URL between /d/ and /edit and
//     paste it below.
//
//  4. Deploy to GitHub Pages: push these files to a repo and turn
//     on Pages in the repo settings (Source: main branch, root).
//
// ============================================================

window.GARDEN_CONFIG = {
  // Paste your Google Sheet ID here, e.g. "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"
  SHEET_ID: "19AZJBNT4UDS2fq53g5s2Z_sIbIm3-wVMsvv8zwMFMOM",

  // Tab names — leave as-is unless you renamed the tabs.
  BEDS_SHEET: "Beds",
  PLANTS_SHEET: "Plants",

  // How often to auto-refresh while the page is open (minutes).
  REFRESH_MINUTES: 10,
};
