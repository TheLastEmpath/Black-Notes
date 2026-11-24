import type { Verdict } from "./db";

// Rule-based candidate spotting. It only decides what to SHOW as a possible
// project. Nothing becomes a project until the author adds the verify emoji,
// so a wrong guess here is harmless. An AI detector could slot in behind the
// same function later (off by default: message text would leave this machine).

const POSITIVE: [RegExp, number, string][] = [
  [
    /\b(i'?m|we'?re|i am|we are)\s+(building|making|working on|developing|writing|shipping|launching|coding)\b/i,
    3,
    "says they are building something",
  ],
  [
    /\b(i|we)\s+(built|made|wrote|shipped|launched|released|deployed)\b/i,
    3,
    "says they built or shipped something",
  ],
  [
    /\b(just|now)\s+(shipped|released|launched|deployed)\b/i,
    2,
    "announces a release",
  ],
  [
    /\b(my|our)\s+(project|tool|app|bot|framework|scanner|script|repo|fuzzer|dataset|platform)\b/i,
    2,
    "calls it their project",
  ],
  [/github\.com\/\S+/i, 2, "links a repo"],
  [
    /\b(looking for|need)\s+(help|testers|contributors|collaborators)\b/i,
    2,
    "asks for help",
  ],
  [
    /\b(repo|prototype|demo|beta|alpha|mvp|wip|open[- ]source|roadmap|v\d+(\.\d+)*)\b/i,
    1,
    "mentions a build stage",
  ],
];

const THEORY: [RegExp, number, string][] = [
  [
    /\b(idea|what if|someone should|thinking about|wondering|hypothetical|in theory|would be cool|not sure yet|maybe)\b/i,
    -3,
    "sounds like an idea, not a build",
  ],
  [/\bshould i\b/i, -2, "asks whether to start"],
];

export type Detection = { verdict: Verdict; score: number; reason: string };

export function detect(content: string): Detection {
  let pos = 0;
  let neg = 0;
  const why: string[] = [];
  for (const [re, w, label] of POSITIVE)
    if (re.test(content)) {
      pos += w;
      why.push(label);
    }
  for (const [re, w, label] of THEORY)
    if (re.test(content)) {
      neg += w;
      why.push(label);
    }
  const score = pos + neg;
  const reason = why.join("; ");
  if (score >= 3) return { verdict: "candidate", score, reason };
  if (pos > 0 || neg < 0) return { verdict: "theory", score, reason };
  return { verdict: "noise", score, reason: "" };
}

/** A short title from the message: first sentence, no links, max 80 chars. */
export function titleFrom(content: string): string {
  const clean = content
    .replace(/https?:\/\/\S+|github\.com\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const first = clean.split(/(?<=[.!?])\s/)[0] || clean || "Untitled project";
  if (first.length <= 80) return first;
  // Cut at a word boundary so titles don't end mid-word.
  const cut = first.slice(0, 77);
  const at = cut.lastIndexOf(" ");
  return (at > 40 ? cut.slice(0, at) : cut).trimEnd() + "…";
}
