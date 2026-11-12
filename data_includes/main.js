// lagomorph-leveret (Conative x AFS, experiment 1) — A-maze (PennController for IBEX 2.0)
//
// Structure and helpers follow the CRIMP build (constint/ibex template): consent ->
// demographics -> 3 instruction pages with comprehension checks -> practice -> main
// (critical + fillers, random order, breaks) -> debrief -> send -> end.
//
// Trial: "press space" ready screen -> Maze (two words per step, e = left, i = right) in
// redo mode (an error shows "Incorrect!", keys are ignored for redoDelayMs, then
// "Please try again." until the correct word is chosen) -> yes/no probe (e = Yes, i = No).
// Practice probes get feedback; main-phase probes don't.
//
// Requires js_includes/Maze.js and css_includes/Maze.css (Boyce, Futrell & Levy 2020;
// github.com/vboyce/Ibex-with-Maze, BSD licence). Git Sync copies them to the Farm's
// Modules and Aesthetics folders.

PennController.ResetPrefix(null);
DebugOff();   // comment out while piloting to get the PCIbex debugger panel

const CFG = {
    name: "lagomorph-leveret",
    build: "leveret_v0-demo",
    criticalFile: "critical.csv",    // Latin square via the Group column (logged as "list")
    fillerFile: "fillers.csv",       // every participant sees all rows
    practiceFile: "practice.csv",    // run in file order
    criticalLog: ["item", "condition", "relativizer", "continuation", "verb",
                  "idx_P", "idx_NAME", "idx_FROM", "idx_REVEAL"],
    fillerLog: ["filler", "type"],
    practiceLog: ["practice_id"],

    // Maze settings (Boyce's controller options)
    redo: true,                      // continue after errors; see design doc "Maze decisions"
    redoDelayMs: 500,                // keys ignored this long after an error
    errorMessage: "Incorrect!",
    retryMessage: "Please try again.",
    postSentenceMs: 300,             // blank between the last word and the probe

    // Probe
    fontSize: "1.6em",
    font: "Helvetica Neue, Helvetica, Arial, sans-serif",
    yesLabel: "Yes", noLabel: "No",
    yesKey: "E", noKey: "I",
    keyHint: "e = Yes &nbsp;&nbsp;&nbsp;&nbsp; i = No",
    practiceFeedbackMs: 1500,

    readyMessage: "Press the <b>space bar</b> when you're ready for the next sentence.",
    breakEvery: 36,
    breakMessage: "Time for a short break. Rest your eyes and hands for a moment.<br><br>Press the space bar when you're ready to continue.",
    beginMessage: "That's the end of the practice.<br><br>From now on there's no feedback on the questions. " +
                  "Remember: read for meaning, as quickly as you comfortably can, and don't worry about occasional mistakes.<br><br>" +
                  "Rest your fingers on <tt>e</tt> and <tt>i</tt>, and click the button when you're ready to begin.",
    completionHtml: "Thank you for your participation! <b>[COMPLETION CODE NOT SET]</b>"
};

// ---------------------------------------------------------------- sequence
// Insert the `sep` trial(s) after every n trials of `main` (not after the last one).
function BreakEvery(sep, main, n) {
    this.args = [sep, main];
    this.run = function (arrays) {
        const sep = arrays[0], main = arrays[1], out = [];
        main.forEach((m, i) => {
            out.push(m);
            if ((i + 1) % n === 0 && i < main.length - 1) sep.forEach(s => out.push(s));
        });
        return out;
    };
}
function breakEvery(sep, main, n) { return new BreakEvery(sep, main, n); }

SetCounter("counter", "inc", 1);

Sequence(
    "counter",
    "welcome", "demographics",
    "instructions",
    "practice",
    "begin",
    breakEvery("break", randomize(startsWith("exp-")), CFG.breakEvery),
    "debrief",
    "send",
    "end"
);

Header(
    newVar("pid").global().set(GetURLParameter("PROLIFIC_PID"))
)
.log("PROLIFIC_PID", GetURLParameter("PROLIFIC_PID"))
.log("STUDY_ID", GetURLParameter("STUDY_ID"))
.log("SESSION_ID", GetURLParameter("SESSION_ID"))
.log("experiment", CFG.name)
.log("build", CFG.build);

// ---------------------------------------------------------------- helpers
const CENTER = ["center at 50vw", "middle at 45vh"];
const TEXT_CSS = {"font-size": "1.2em", "max-width": "40em", "line-height": "1.5em",
                  "font-family": "Helvetica Neue, Helvetica, Arial, sans-serif"};

// Options for Boyce's Maze controller. An optional `order` column ("0 1 1 0 ...", 0 = correct
// word on the left) fixes sides across participants; without it, sides are random per
// participant (first word always left).
function mazeOptions(row) {
    const opts = {
        s: row.sentence.trim(),
        a: row.distractor.trim(),
        redo: CFG.redo,
        time: CFG.redoDelayMs,
        emess: CFG.errorMessage,
        rmess: CFG.retryMessage
    };
    if (row.order && row.order.trim() !== "")
        opts.order = row.order.trim().split(/\s+/).map(Number);
    return opts;
}

// Optional message (with button) at the start of a trial, used for practice guidance.
function intro(html) {
    if (!html || html.trim() === "") return [];
    return [
        newText("intro", html).css(TEXT_CSS).center().print(),
        newButton("introBtn", "Continue").css({"margin": "1em"}).center().print().wait(),
        getText("intro").remove(),
        getButton("introBtn").remove()
    ];
}

// Yes/No probe with e/i, logging response, correctness and RT (ms from probe onset).
function probe(row, feedback) {
    const ans = row.answer.trim();   // "Yes" or "No"
    const cmds = [
        newVar("qResponse", "NA").global(),
        newVar("qCorrect", "NA").global(),
        newVar("qRT", "NA").global(),
        getVar("qResponse").set("NA"), getVar("qCorrect").set("NA"), getVar("qRT").set("NA"),
        newText("q", row.question).css({"font-size": CFG.fontSize}),
        newText("qyes", CFG.yesLabel).css({"font-size": CFG.fontSize, "cursor": "pointer"}),
        newText("qno", CFG.noLabel).css({"font-size": CFG.fontSize, "cursor": "pointer"}),
        newText("qhint", CFG.keyHint).css({"font-size": "1em", "color": "#888"}),
        newCanvas("qbox", 700, 220).css({"font-family": CFG.font})
            .add("center at 50%", 0, getText("q"))
            .add("center at 25%", 90, getText("qyes"))
            .add("center at 75%", 90, getText("qno"))
            .add("center at 50%", 170, getText("qhint"))
            .print("center at 50vw", "top at 35vh"),
        getVar("qRT").set(v => Date.now()),
        newSelector("qsel")
            .add(getText("qyes"), getText("qno"))
            .keys(CFG.yesKey, CFG.noKey)
            .once()
            .log()
            .wait(),
        getVar("qRT").set(v => Date.now() - v),
        getSelector("qsel").test.selected(getText("qyes"))
            .success(getVar("qResponse").set("Yes"))
            .failure(getVar("qResponse").set("No")),
        getVar("qCorrect").set(getVar("qResponse")),
        getVar("qCorrect").set(v => v === ans ? "yes" : "no")
    ];
    if (feedback) cmds.push(
        getVar("qCorrect").test.is("yes")
            .success(newText("fb", "Correct!").css({"font-size": "1.3em", "color": "#080"})
                         .css({"font-family": CFG.font}).print("center at 50vw", "top at 70vh"))
            .failure(newText("fb", "Not quite: the answer was <b>" + ans + "</b>.")
                         .css({"font-size": "1.3em", "color": "#c00", "font-family": CFG.font})
                         .print("center at 50vw", "top at 70vh")),
        newTimer("fbT", CFG.practiceFeedbackMs).start().wait(),
        getText("fb").remove()
    );
    cmds.push(getCanvas("qbox").remove());
    return cmds;
}

// One Maze trial. Every result line (one per Maze word, plus the probe selector line)
// carries the row's `cols` and the probe variables.
function mazeTrial(label, row, cols, feedback) {
    let t = newTrial(label,
        ...intro(row.before),
        newText("ready", CFG.readyMessage).css(TEXT_CSS).print(...CENTER),
        newKey("readyKey", " ").wait(),
        getText("ready").remove(),
        newController("maze", "Maze", mazeOptions(row))
            .print()
            .log()
            .wait()
            .remove(),
        newTimer("post", CFG.postSentenceMs).start().wait(),
        ...probe(row, feedback)
    )
    .log("question", row.question)
    .log("answer", row.answer)
    .log("qResponse", getVar("qResponse"))
    .log("qCorrect", getVar("qCorrect"))
    .log("qRT", getVar("qRT"));
    if (row.Group) t = t.log("list", row.Group);   // Ibex's own Group column is NULL for Template trials
    cols.forEach(c => { t = t.log(c, row[c]); });
    return t;
}

function formPage(label, file) {
    return newTrial(label,
        newHtml("form", file).log().print(),
        newButton("continue", "Continue").css({"margin": "1em"}).center().print()
            .wait(getHtml("form").test.complete().failure(getHtml("form").warn()))
    );
}

function message(label, html, buttonText) {
    return newTrial(label,
        newText("msg", html).css(TEXT_CSS).center().print(),
        newButton("continue", buttonText || "Continue").css({"margin": "1em"}).center().print().wait()
    );
}

// ---------------------------------------------------------------- trials
formPage("welcome", "welcome.html");
formPage("demographics", "demographic-survey.html");
formPage("instructions", "instructions1.html");
formPage("instructions", "instructions2.html");
formPage("instructions", "instructions3.html");

Template(CFG.practiceFile, row => mazeTrial("practice", row, CFG.practiceLog, true));
message("begin", CFG.beginMessage, "Begin");

Template(CFG.criticalFile, row => mazeTrial(row.label, row, CFG.criticalLog, false));
Template(CFG.fillerFile,   row => mazeTrial(row.label, row, CFG.fillerLog, false));

newTrial("break",
    newText("breakMsg", CFG.breakMessage).css(TEXT_CSS).center().print(...CENTER),
    newKey("space", " ").wait()
);

formPage("debrief", "debrief.html");

SendResults("send");

newTrial("end",
    newText("endMsg", CFG.completionHtml).css(TEXT_CSS).center().print(),
    newButton("void").wait()
);
