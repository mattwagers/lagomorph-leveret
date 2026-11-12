# lagomorph-leveret: A-maze on PCIbex

First experiment in the **lagomorph** series (Conative x AFS). Logged as `experiment = lagomorph-leveret`, `build = leveret_v0-demo` (bump `build` in `CFG` for each new version).

**On the PCIbex Farm:** open the project → Git Sync → `https://github.com/mattwagers/lagomorph-leveret`, branch `main`.

PCIbex Farm project for the core design v2 (2 relativizer × 3 continuation, A-maze). It has the
same layout and helpers as the CRIMP build (`mattwagers/constint-crimp`): consent, demographics,
instructions with comprehension checks, practice, main block with breaks, debrief, Prolific IDs
from the URL, and `SetCounter` for the Latin square.

**Status: demo materials.** `critical.csv` holds item 1 in all six conditions and `fillers.csv`
holds two example fillers. Both use the final column format, so the full 36 + 72 can be dropped in.
`practice.csv` is finished.

## Files

| Path | What |
|---|---|
| `data_includes/main.js` | The experiment. All settings are in `CFG` at the top. |
| `js_includes/Maze.js` | Boyce's Maze controller (vboyce/Ibex-with-Maze, BSD licence, see `Maze.LICENSE`). Unchanged. |
| (styling) | The Maze styling is injected from `main.js` (`MAZE_CSS`), so it doesn't depend on the Farm's Aesthetics folder. Words are large (3vw, 30–56 px) and centered on screen. The `e`/`i` labels sit under each word, and the "Words so far" counter is hidden. |
| `chunk_includes/instructions{1,2,3}.html` | Task, mistakes and speed, probes and setup. Each page has comprehension checks. |
| `chunk_includes/practice.csv` | 6 practice sentences with hand-written distractors and probes (3 Yes, 3 No). |
| `chunk_includes/critical.csv`, `fillers.csv` | Demo rows in the final format. |
| `chunk_includes/welcome.html`, `demographic-survey.html`, `debrief.html` | Consent and survey from CRIMP; consent duration set to 35 min. Debrief rewritten for Maze. |

## Trial

1. "Press the space bar when you're ready for the next sentence." This is a self-paced rest point between items.
2. Maze in **redo mode**. A wrong choice shows *Incorrect!*, keys are ignored for 500 ms, then *Please try again.* appears until the correct word is chosen. The design doc calls for continue-after-error so that downstream regions aren't selectively lost in the hard condition.
3. 300 ms blank, then the yes/no probe: `e` = Yes (left), `i` = No (right), on the same keys as the Maze.
4. Practice only: feedback on the probe for 1.5 s.

## CSV columns

Required in every file: `sentence`, `distractor` (same number of space-separated tokens; the
first distractor is `x-x-x`), `question`, `answer` (`Yes`/`No`).

- Critical: `label` (`exp-crit-<cond>`), `Group` (A–F), `item`, `condition`, `relativizer`,
  `continuation`, `verb`, `idx_P`, `idx_NAME`, `idx_FROM`, `idx_REVEAL`. The `idx_*` columns are
  0-based word positions that match the Maze `Word number`. They differ between `*_do` and the
  other conditions because the adverb moves.
- Fillers: `label` (`exp-fill-…`), `filler`, `type`.
- Practice: `practice_id`, `before` (optional HTML shown before the sentence).
- Optional anywhere: `order`, e.g. `0 1 1 0 …` (0 = correct word on the left). This fixes the
  sides across participants. Leave it out to randomize per participant; the first word is always
  on the left.

To log more columns, add them to `criticalLog` or `fillerLog` in `CFG`.

## Distractors: rules used, and what the critical items need

The hand-written practice and demo distractors follow the A-maze conventions (Boyce, Futrell &
Levy 2020): a real word, roughly the same length as the correct word, and clearly ungrammatical
or incoherent as a continuation of the prefix. Each one was checked against every way the prefix
could continue, not just the intended one. Examples: *photographed the bridge loved…* (reduced
relative) and *outside its…* both rule a candidate out. The design adds some constraints:

- **One distractor per word across conditions.** If the correct word is the same (`Mark`, `from`,
  `before`), use the same distractor in every condition, so the region contrast isn't partly a
  distractor contrast. The demo item does this. The only distractors that differ are at the
  relativizer (*kind*/*their*) and the P (*we*/*taught*).
- **The NAME distractor must fail after *at*, after *beside*, and after *poking*.** *Seem* does;
  *hers* fails because *poking at hers* is fine.
- **Capitalize the distractor for proper names** (*Mark*/*Seem*). Otherwise case gives the answer away.
- **Give the last word and its distractor the same punctuation** (*down.*/*sure.*).
- **Check the where-conditions separately at `from`.** For where_at, if the colloquial *where … at*
  parse is live, the parser may expect a P object at NAME. The distractor at `from` must be bad
  under that parse too (*ours* is).

Suggested route for the full set: generate candidates with Boyce's `maze_automate` (it runs a
language model, so it has to run locally), then hand-vet the P, NAME, FROM and REVEAL positions.
To check them, score prefix + distractor with the `constint` `metrics/surprisal.py` pipeline
(same GPT-2 setup as the surprisal covariate). Any distractor whose surprisal falls inside the
range of correct words at that position gets flagged.

## Deploying

Git Sync this repo (`main`) on the Farm, as with `constint-crimp`. After
syncing, check that `Maze.js` is in **Modules**. A `Maze.css` in Aesthetics is harmless: the injected styles override it. Before launch, set `completionHtml` in `CFG`.

Recruitment: desktop only, physical keyboard (Prolific device filter).

## Duration (check before setting the Prolific time)

A-maze typically runs at about 0.8–1 s per word. With items of about 17 words and 108 trials, the
main block alone is roughly 27–32 min. Add probes, ready screens, instructions and practice, and
the session is about **35 min**, not the ~15 min in the design doc. The consent page now says
35 min. Options if that's too long: shorter fillers, fewer fillers (72 → 54 gives 1.5:1), or
probes on a subset of trials.

## Output

Each Maze word is one result line: `PennElementName` = `maze`, `Parameter` = word number (0-based),
`Value` = word, plus `Alternative`, `Word on (0=left, 1=right)`, `Correct` (the **first** press,
yes/no), `Reading time to first answer` (ms, the RT to analyse), and `Total time to correct answer`
(this includes the 500 ms lockout after an error). Every line also carries `list`, the item
columns, and the probe results `qResponse`, `qCorrect` and `qRT`.

```r
read.pcibex <- function(file) {   # standard PCIbex reader: column names come from the comment lines
  n.cols <- max(count.fields(file, sep = ",", quote = NULL), na.rm = TRUE)
  raw <- read.csv(file, header = FALSE, comment.char = "#", col.names = seq_len(n.cols),
                  encoding = "UTF-8", fill = TRUE, quote = "")
  cmts <- grep("^# \\d+\\. ", readLines(file), value = TRUE)
  nms <- unique(sub("^# \\d+\\. ", "", cmts))
  names(raw)[seq_along(nms)] <- nms
  raw
}
maze <- read.pcibex("results.csv") |>
  dplyr::filter(PennElementName == "maze", grepl("^exp-", Label)) |>
  dplyr::mutate(word_num = as.integer(Parameter),
                rt = as.numeric(Reading.time.to.first.answer))
```

The header names for the Maze columns repeat across controllers in the Farm's `results.csv`, so
check `names(maze)` on the first pilot file. Participant exclusion, following Boyce: overall Maze
accuracy below 80% suggests random pressing.

## Tested

Run end to end in headless Chrome against PennController 2.0, using `constint`'s
`ibex/tools/serve_local.py`. The run covered all 6 lists, practice feedback, redo after errors,
breaks, and results submission. Maze lines, probe variables and list assignment were all logged
correctly.

## Sources

- Boyce, Futrell & Levy (2020), A-maze; docs and the redo-mode rationale at <https://vboyce.github.io/Maze/>
- Maze controller: <https://github.com/vboyce/Ibex-with-Maze>
- Layout of other PCIbex Maze projects consulted: UMWordLab's `ibex-2024-verbbias-maze-study` and `ibex-2026-xu-etal-maze`
