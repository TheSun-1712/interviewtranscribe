export type Question = {
  id: string;
  n: number | null;
  category: string;
  prompt: string;
  objective: string;
  custom?: boolean;
};

export const OFFICIAL_QUESTIONS: Question[] = [
  {
    id: "q1",
    n: 1,
    category: "Background & Overview",
    prompt: "Name, introduce yourself.",
    objective: "Career background, self-presentation, and communication clarity.",
  },
  {
    id: "q2",
    n: 2,
    category: "Project & Strategy",
    prompt: "What is your problem statement.",
    objective: "Problem identification, project scope clarity, and core motivation.",
  },
  {
    id: "q3",
    n: 3,
    category: "Project & Strategy",
    prompt: "What is your approach / implementation plan to your project?",
    objective: "System architecture, technical roadmap, and model selection.",
  },
  {
    id: "q4",
    n: 4,
    category: "Domain Technical",
    prompt: "Basic questions on your domain.",
    objective: "Core technical fundamentals, domain competence, and depth.",
  },
  {
    id: "q5",
    n: 5,
    category: "Data Structures & Ideation",
    prompt: "Ask a DSA question and gauge their ideation capabilities.",
    objective: "Algorithmic thinking, data structure selection, creative problem-solving.",
  },
  {
    id: "q6",
    n: 6,
    category: "Training & Development",
    prompt: "What did you understand about training and development?",
    objective: "Growth mindset, learning agility, receptivity to feedback.",
  },
  {
    id: "q7",
    n: 7,
    category: "Career Vision & Tech Role",
    prompt: "What do you think that YOU would do in tech?",
    objective: "Long-term ambitions, engineering passion, technology vision.",
  },
  {
    id: "q8",
    n: 8,
    category: "AAC Focus Area",
    prompt: "What area in AAC are you most interested in?",
    objective: "Alignment with AAC focus domains and specialized skills.",
  },
  {
    id: "q9",
    n: 9,
    category: "Domain Spontaneity",
    prompt: "Spontaneous question based on candidate domain & background.",
    objective: "On-the-spot thinking, adaptability, domain spontaneity.",
  },
  {
    id: "q10",
    n: 10,
    category: "Logistics & Availability",
    prompt: "Are you able to stay after hours when required for project delivery?",
    objective: "Commitment, availability, and delivery flexibility.",
  },
  {
    id: "q11",
    n: 11,
    category: "Mentorship & Leadership",
    prompt: "Are you interested in becoming a mentor to junior team members?",
    objective: "Leadership potential and eagerness to share knowledge.",
  },
  {
    id: "q12",
    n: 12,
    category: "Behavioral & Soft Skills",
    prompt: "Describe a challenging situation and how you navigated it.",
    objective: "Emotional intelligence, resilience, conflict resolution, teamwork.",
  },
];

export const OFFICIAL_COUNT = OFFICIAL_QUESTIONS.length;
