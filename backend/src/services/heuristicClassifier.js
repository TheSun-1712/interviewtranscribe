/**
 * Smart Local Heuristic Search & Sentence Classifier Service
 * Provides offline filler word stripping, sentence partitioning, and answer matching.
 */

// Common filler words and disfluencies to strip
const FILLER_PATTERNS = [
  /\b(so\s+yeah|okay\s+so|fine\s+so|you\s+know|i\s+mean|basically|actually)\b/gi,
  /\b(uhm+|um+|uh+|er+|ah+|yea+|yeah+)\b/gi,
  /\b(like)\b(?=\s+(?:i|my|the|we|a|an|to|it|that|this|there|and|so|building|doing))/gi
];

/**
 * Strips speech disfluencies and filler words from candidate transcripts
 * @param {string} text
 * @returns {string} Cleaned transcript
 */
function stripFillerWords(text) {
  if (!text || typeof text !== "string") return "";

  let cleaned = text;
  FILLER_PATTERNS.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, " ");
  });

  return cleaned
    .replace(/\s+/g, " ")
    .replace(/\s+([,.?!])/g, "$1")
    .replace(/(^\s*[,.?!]\s*)+/g, "")
    .trim();
}

/**
 * Smart Local Search & Sentence Classification Engine
 * Classifies candidate transcript sentences into the 12 interview questions.
 * Only populates questions if keywords or topics were actually encountered.
 */

const KEYWORD_DICTIONARY = [
  {
    qNum: 1,
    category: "Background & Overview",
    keywords: ["name", "introduce", "myself", "i am", "my name", "student", "department", "college", "year", "studying", "background"]
  },
  {
    qNum: 2,
    category: "Project & Strategy",
    keywords: ["problem statement", "problem is", "aim is", "building a", "project is", "cloud cover", "satellite", "detecting", "classification", "solution"]
  },
  {
    qNum: 3,
    category: "Project & Strategy",
    keywords: ["approach", "implementation", "implement", "using a", "unet", "resnet", "gan", "neural network", "model", "architecture", "dataset", "layers", "pipeline"]
  },
  {
    qNum: 4,
    category: "Domain Technical",
    keywords: ["domain", "technical", "basic questions", "concept", "overfitting", "underfitting", "convolution", "gradient", "loss function", "pytorch", "tensorflow", "python"]
  },
  {
    qNum: 5,
    category: "Data Structures & Ideation",
    keywords: ["dsa", "data structure", "algorithm", "array", "tree", "hash", "ideation", "time complexity", "binary search", "graph", "dp", "sorting"]
  },
  {
    qNum: 6,
    category: "Training & Development",
    keywords: ["training and development", "training", "development", "learning", "upskilling", "workshop", "skills", "growth", "course", "certification"]
  },
  {
    qNum: 7,
    category: "Career Vision & Tech Role",
    keywords: ["in tech", "you do in tech", "career", "future", "aspire", "developer", "engineer", "vision", "goal", "role"]
  },
  {
    qNum: 8,
    category: "AAC Focus Area",
    keywords: ["aac", "aac area", "interested in aac", "advanced agentic", "research", "focus area", "applied ai", "agentic"]
  },
  {
    qNum: 9,
    category: "Domain Spontaneity",
    keywords: ["spontaneous", "spontaneity", "on the spot", "custom question", "quick thinking", "spontaneous question"]
  },
  {
    qNum: 10,
    category: "Logistics & Availability",
    keywords: ["stay after hours", "after hours", "overtime", "extra hours", "project delivery", "available", "schedule", "commitment", "late hours"]
  },
  {
    qNum: 11,
    category: "Mentorship & Leadership",
    keywords: ["mentor", "mentorship", "junior", "leading", "team", "guidance", "help others", "collaborate", "peer"]
  },
  {
    qNum: 12,
    category: "Behavioral & Soft Skills",
    keywords: ["behavioural", "behavioral", "challenge", "navigated", "conflict", "disagreed", "situation", "overcame", "teamwork", "deadline"]
  }
];

function smartClassifyTranscript(transcriptText, questionsList = []) {
  if (!transcriptText || !transcriptText.trim()) {
    return questionsList.map((q, idx) => ({
      questionId: q.id,
      qNumber: idx + 1,
      category: q.category || "General",
      questionText: q.text,
      aiSummary: "Question not asked in session",
      keyTakeaways: "N/A",
      candidateAnswerOnly: "[Not answered in this session]"
    }));
  }

  const cleanText = stripFillerWords(transcriptText);

  // Split into candidate speech chunks by punctuation or question transition patterns
  let rawChunks = cleanText
    .split(/(?<=[.?!])\s+|\b(?:can you|what is|tell me|next question|how are|what do you|are you|describe|so what)\b/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  if (rawChunks.length === 0) {
    rawChunks = [cleanText];
  }

  return questionsList.map((q, idx) => {
    const qNum = idx + 1;
    const rule = KEYWORD_DICTIONARY.find((r) => r.qNum === qNum) || {
      keywords: [q.text.toLowerCase()]
    };

    // Filter chunks matching topic keywords
    const matchedChunks = rawChunks.filter((chunk) => {
      const lower = chunk.toLowerCase();
      return rule.keywords.some((kw) => lower.includes(kw));
    });

    let wasEncountered = matchedChunks.length > 0;

    // Special case for Question 1: If opening introduction text is present
    if (!wasEncountered && idx === 0 && cleanText.length > 10) {
      wasEncountered = true;
      matchedChunks.push(rawChunks[0]);
    }

    if (wasEncountered) {
      const candidateAns = stripFillerWords(matchedChunks.join(" "));
      const summary = candidateAns.length > 180 ? candidateAns.slice(0, 180) + "..." : candidateAns;

      return {
        questionId: q.id,
        qNumber: qNum,
        category: q.category || rule.category || "General",
        questionText: q.text,
        aiSummary: summary || "Candidate response recorded.",
        keyTakeaways: "Topic encountered and analyzed.",
        candidateAnswerOnly: candidateAns || "[Response recorded in full transcript]"
      };
    } else {
      // Question was NOT asked or encountered in the interview session
      return {
        questionId: q.id,
        qNumber: qNum,
        category: q.category || rule.category || "General",
        questionText: q.text,
        aiSummary: "Question not asked in session",
        keyTakeaways: "N/A",
        candidateAnswerOnly: "[Not answered in this session]"
      };
    }
  });
}

module.exports = {
  stripFillerWords,
  smartClassifyTranscript
};
