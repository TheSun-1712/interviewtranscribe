// Official 12-Question Interview Bank and Initial Candidates Seed Data

export const INITIAL_CANDIDATES = [
  {
    id: "cand_1",
    name: "Alex Morgan",
    role: "Full Stack Engineer",
    department: "Engineering",
    email: "alex.morgan@techcorp.com",
    status: "not_started",
    dateAdded: "2026-08-30",
    questionsCount: 0,
    recordingsCount: 0,
    notes: "Candidate for technical role."
  },
  {
    id: "cand_2",
    name: "Samantha Vance",
    role: "AI & ML Engineer",
    department: "AAC Research",
    email: "samantha.vance@designhub.io",
    status: "not_started",
    dateAdded: "2026-08-30",
    questionsCount: 0,
    recordingsCount: 0,
    notes: "Interested in AI & AAC mentorship."
  },
  {
    id: "cand_3",
    name: "David Chen",
    role: "Backend Architect",
    department: "Infrastructure",
    email: "david.chen@ai-labs.org",
    status: "not_started",
    dateAdded: "2026-08-30",
    questionsCount: 0,
    recordingsCount: 0,
    notes: "Strong system design background."
  },
  {
    id: "cand_4",
    name: "Priya Sharma",
    role: "DevOps & Systems Engineer",
    department: "Operations",
    email: "priya.sharma@enterprise.com",
    status: "not_started",
    dateAdded: "2026-08-30",
    questionsCount: 0,
    recordingsCount: 0,
    notes: "Focus on cloud deployment and CI/CD."
  }
];

export const QUESTION_CATEGORIES = [
  "Background & Overview",
  "Project & Strategy",
  "Domain Technical",
  "Data Structures & Ideation",
  "Training & Development",
  "Career Vision & Tech Role",
  "AAC Focus Area",
  "Domain Spontaneity",
  "Logistics & Availability",
  "Mentorship & Leadership",
  "Behavioral & Soft Skills"
];

export const INITIAL_QUESTIONS = [
  {
    id: "q_1",
    category: "Background & Overview",
    text: "Name, introduce yourself.",
    description: "Evaluates candidate background, self-presentation, and general communication clarity.",
    isPreDecided: true
  },
  {
    id: "q_2",
    category: "Project & Strategy",
    text: "What is your problem statement.",
    description: "Evaluates problem identification skills, clarity of scope, and core motivation.",
    isPreDecided: true
  },
  {
    id: "q_3",
    category: "Project & Strategy",
    text: "What is your approach/implementation plan to your project?",
    description: "Assesses architectural roadmap, execution milestones, and technical strategy.",
    isPreDecided: true
  },
  {
    id: "q_4",
    category: "Domain Technical",
    text: "Basic questions on your domain.",
    description: "Tests core foundational knowledge and domain competence.",
    isPreDecided: true
  },
  {
    id: "q_5",
    category: "Data Structures & Ideation",
    text: "Ask a DSA question and basically just know their ideation capabilities.",
    description: "Evaluates algorithmic thinking, data structure selection, and creative problem-solving.",
    isPreDecided: true
  },
  {
    id: "q_6",
    category: "Training & Development",
    text: "What did you understand about training and development?",
    description: "Gauges learning agility, feedback receptivity, and growth mindset.",
    isPreDecided: true
  },
  {
    id: "q_7",
    category: "Career Vision & Tech Role",
    text: "What do you think that YOU would do in tech?",
    description: "Explores long-term technology vision, career ambitions, and personal passion.",
    isPreDecided: true
  },
  {
    id: "q_8",
    category: "AAC Focus Area",
    text: "What area in AAC that you are most interested in?",
    description: "Identifies candidate alignment with AAC domains and specialized interest.",
    isPreDecided: true
  },
  {
    id: "q_9",
    category: "Domain Spontaneity",
    text: "Spontaneous question based on candidate domain & background.",
    description: "Tests on-the-spot thinking, adaptability, and domain depth.",
    isPreDecided: true
  },
  {
    id: "q_10",
    category: "Logistics & Availability",
    text: "Are you able to stay after hours when required for project delivery?",
    description: "Confirms flexibility, time commitment, and availability.",
    isPreDecided: true
  },
  {
    id: "q_11",
    category: "Mentorship & Leadership",
    text: "Are you interested in becoming a mentor to junior team members?",
    description: "Gauges leadership potential, knowledge-sharing eagerness, and team impact.",
    isPreDecided: true
  },
  {
    id: "q_12",
    category: "Behavioral & Soft Skills",
    text: "Behavioural question: Describe a challenging situation and how you navigated it.",
    description: "Evaluates emotional intelligence, resilience, conflict resolution, and teamwork.",
    isPreDecided: true
  }
];
