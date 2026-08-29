/**
 * Front-end stand-in for the diarization + summarization pipeline.
 * Mirrors the real contract: audio in, clean candidate answer + 1-2 sentence
 * executive summary out. Swap the body for a real API call in services/api.
 */

const SUMMARIES: Record<string, { summary: string; transcript: string; insights: string }> = {
  q1: {
    summary:
      "Six years in applied ML, led a recommendation system to production; frames the role as a chance to own a full inference pipeline end-to-end.",
    transcript:
      "I've spent the last six years building ML systems, most recently shipping a real-time recommendation engine to production at scale. Before that I worked mainly on tabular forecasting, and I moved into deep learning because I wanted ownership of the whole pipeline rather than just the model.",
    insights: "Clear narrative arc; production ownership; low filler speech.",
  },
  q2: {
    summary:
      "Defines the core problem as reducing cold-start latency; proposes a two-tier retrieval architecture with an offline fallback path.",
    transcript:
      "The problem statement is that new items get almost no exposure for the first few days, so the catalogue effectively goes stale. I'm treating it as a retrieval problem rather than a ranking one, with a cheap content-based tier that covers the cold window.",
    insights: "Frames scope tightly; separates retrieval from ranking.",
  },
  q3: {
    summary:
      "Plans a staged rollout: offline evaluation harness first, then shadow traffic, then a UNet-style encoder for the vision branch.",
    transcript:
      "First I'd build the evaluation harness so we can measure anything at all, then run the new path in shadow mode for a week. Only once the offline and shadow numbers agree would I put it in front of users.",
    insights: "Evaluation-first instinct; risk-aware rollout plan.",
  },
  q4: {
    summary:
      "Explains bias-variance trade-offs and regularization confidently, with concrete examples from a defect-detection project.",
    transcript:
      "Regularization is really about constraining the hypothesis space. On the defect project we had 900 labelled images, so heavy augmentation plus a frozen backbone did more for us than any architecture change.",
    insights: "Fundamentals solid; reasons from data constraints.",
  },
  q5: {
    summary:
      "Reasons out loud through a sliding-window solution, correctly identifying the O(n) improvement over the naive approach.",
    transcript:
      "My first instinct is the brute force double loop, which is quadratic. But since the window only ever grows from the right, I can keep a running count in a hash map and move the left pointer when it breaks — that gets me linear time.",
    insights: "Thinks aloud; self-corrects toward optimal complexity.",
  },
  q6: {
    summary:
      "Views training and development as structured feedback loops rather than courses; cites a peer code-review ritual they started.",
    transcript:
      "To me development is mostly about feedback frequency. I started a weekly review rotation on my last team, and that did more for the juniors than any formal course we bought.",
    insights: "Initiative in team learning; feedback-oriented.",
  },
  q7: {
    summary:
      "Wants to sit at the boundary of research and infrastructure, turning prototypes into reliable production services.",
    transcript:
      "I don't want to be purely a researcher. The part I enjoy is the translation layer — taking something that works in a notebook and making it something you can page someone about at 3am.",
    insights: "Clear self-positioning; production-minded.",
  },
  q8: {
    summary:
      "Most drawn to the perception and multimodal side of AAC, specifically low-latency on-device inference.",
    transcript:
      "The perception work is what pulled me here, particularly anything that has to run on-device with a tight latency budget.",
    insights: "Focus area aligns with current roadmap.",
  },
  q9: {
    summary:
      "Handles an unscripted follow-up on quantization trade-offs without hesitation, noting accuracy loss thresholds.",
    transcript:
      "Int8 usually costs us about a point of accuracy, which is fine for detection but not for the fine-grained classes, so we kept those in fp16.",
    insights: "Comfortable off-script; specific numbers.",
  },
  q10: {
    summary:
      "Available for extended hours around delivery milestones, with a preference for planned crunch over ad-hoc.",
    transcript:
      "Yes, around a release I'm happy to stay. I'd just ask that it's planned rather than a surprise, so I can arrange things at home.",
    insights: "Flexible with healthy boundaries.",
  },
  q11: {
    summary:
      "Actively interested in mentoring, having already onboarded two interns and written the team's ramp-up guide.",
    transcript:
      "I've mentored two interns before and I wrote the onboarding doc the team still uses, so yes, that's something I'd want to keep doing.",
    insights: "Proven mentorship track record.",
  },
  q12: {
    summary:
      "Describes de-escalating a stalled cross-team dependency by writing a shared spec and running a single decision meeting.",
    transcript:
      "Two teams disagreed on ownership of the ingestion layer and it stalled for three weeks. I wrote a one-page spec of both options, got the leads in a room once, and we shipped the following sprint.",
    insights: "Resolves conflict with artifacts, not escalation.",
  },
};

const GENERIC = {
  summary:
    "Answers directly with a concrete example from recent work, then connects it back to the requirements of the role.",
  transcript:
    "I'd approach that by starting from what we already have in place, then looking for the smallest change that moves the metric. On my last project that meant fixing the data before touching the model.",
  insights: "Concrete, example-led answer.",
};

export function synthesizeAnswer(questionId: string) {
  return SUMMARIES[questionId] ?? GENERIC;
}

export const NOT_ANSWERED = "[Not answered in session]";
