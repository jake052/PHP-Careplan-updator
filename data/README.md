# Demo dataset: fictional supported person

This directory holds the **anonymised, fictional** dataset that drives the PHP care-plan-refresh demo. Every name, date, address, school, and clinical detail is invented. None of this data describes a real person.

## Files

```
demo-dataset/
├── README.md                          ← this file
├── persona-template.md                ← one-page profile + biography + comms (fill out by hand)
├── outdated-care-plan-template.md     ← the stale plan we are refreshing (intentionally outdated)
├── embedded-patterns.md               ← the "answer key": what the refresh should surface
└── notes-corpus/
    ├── README.md                      ← corpus structure + writing style guide
    ├── 2026-01-seed-notes.md          ← 20 hand-crafted seed notes (you write these)
    └── 2026-02-to-04-generated.md     ← AI-generated notes guided by your seeds (built day 2)
```

## How the files fit together

```
persona-template.md         ┐
outdated-care-plan-template │── input to demo
notes-corpus/*              ┘
                              ↓
                     [LLM refresh pipeline]
                              ↓
                     refreshed-care-plan.md  (demo output)
                              ↓
                     evidence-trail.json     (every claim → source note)
                              ↓
              [embedded-patterns.md]  ← grading rubric
```

The refresh's job is to take the persona + outdated plan + notes corpus, produce a refreshed plan, and surface the patterns listed in `embedded-patterns.md`. The patterns are the test. If the refresh finds them, the demo is real. If it doesn't, the demo is theatre.

## How to spend your time this week

**Day 1 (today):** write `persona-template.md` and `outdated-care-plan-template.md` in your own voice as if you were inducting a new agency support worker. Budget 3-4 hours total. Read NICE NG93 (autism) and NG142 (LD) skim-only first if you want a structure check.

**Day 2:** write the 20 seed shift notes by hand (`notes-corpus/2026-01-seed-notes.md`). Embed the 5 patterns from `embedded-patterns.md` across the seeds and the AI-generated extension. Budget 3 hours.

**Day 2-3:** AI-generate the remaining 100-220 notes using your seeds as a style guide and the embedded-patterns file as the plot points. You spot-check every 20th note. Budget 4-6 hours.

**Day 3-5:** build the demo on top of this dataset.

## The fictional supported person

The skeleton is built around **Sam Hartley**, age 28, who lives in a 12-bed supported living service called Brindley Lodge in the fictional Yorkshire town of Wakebridge. Diagnoses: Autism Spectrum Condition, Mild-Moderate Learning Disability, Epilepsy. Verbal with ~30-40 words plus Makaton plus a communication book. Family: Mum (Anna), Brother (Owen).

You can rename Sam if you want. The structure works for any small-service LD/autism persona.

## Why these patterns

The five embedded patterns reflect the actual job a refresh has to do for a registered manager pre-CQC: surface things the team has noticed in notes but not yet rolled into the plan. They span:

1. A new sensory preference (small but personal)
2. A clinical pattern change (medically significant)
3. A reduced tolerance (safeguarding signal)
4. A new positive relationship (outcome evidence)
5. A new communication skill (development signal)

If the refresh catches all five with evidence trails, you have a demo that an RM will respect.
