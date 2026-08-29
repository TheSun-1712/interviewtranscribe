// Initial seed data for Candidates and Pre-decided Questions

export const INITIAL_CANDIDATES = [
  {
    id: "cand_1",
    name: "Alex Morgan",
    role: "Senior Software Engineer",
    department: "Engineering",
    email: "alex.morgan@techcorp.com",
    status: "Completed",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    dateAdded: "2026-08-25",
    sessionsCount: 1,
    notes: "Candidate has 6+ years experience in React, Node, and distributed systems."
  },
  {
    id: "cand_2",
    name: "Samantha Vance",
    role: "Product Design Lead",
    department: "Design & UX",
    email: "samantha.vance@designhub.io",
    status: "In Progress",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    dateAdded: "2026-08-28",
    sessionsCount: 1,
    notes: "Strong portfolio showcasing design system architecture and user research."
  },
  {
    id: "cand_3",
    name: "David Chen",
    role: "AI & ML Specialist",
    department: "Data Science",
    email: "david.chen@ai-labs.org",
    status: "Pending",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    dateAdded: "2026-08-29",
    sessionsCount: 0,
    notes: "Specializes in Large Language Models, speech recognition pipelines, and NLP."
  },
  {
    id: "cand_4",
    name: "Priya Sharma",
    role: "Engineering Manager",
    department: "Leadership",
    email: "priya.sharma@enterprise.com",
    status: "Pending",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    dateAdded: "2026-08-29",
    sessionsCount: 0,
    notes: "Extensive background managing cross-functional technical teams."
  }
];

export const QUESTION_CATEGORIES = [
  "Background & Overview",
  "Technical Competency",
  "Problem Solving & Architecture",
  "Culture & Collaboration",
  "Role-Specific Scenarios",
  "Wrap-Up & Q&A"
];

export const INITIAL_QUESTIONS = [
  {
    id: "q_1",
    category: "Background & Overview",
    text: "Can you walk us through your professional journey and highlight your key milestones?",
    description: "Evaluates career trajectory, communication clarity, and self-awareness.",
    isPreDecided: true
  },
  {
    id: "q_2",
    category: "Background & Overview",
    text: "What attracted you to this role and why do you want to join our organization?",
    description: "Assesses company research, alignment with team mission, and intrinsic motivation.",
    isPreDecided: true
  },
  {
    id: "q_3",
    category: "Technical Competency",
    text: "Describe a complex technical problem you solved recently. What was your approach?",
    description: "Looks for technical depth, decision-making logic, and handling edge cases.",
    isPreDecided: true
  },
  {
    id: "q_4",
    category: "Technical Competency",
    text: "How do you maintain quality and reliability when delivering features under tight deadlines?",
    description: "Evaluates testing strategies, code review processes, and prioritization.",
    isPreDecided: true
  },
  {
    id: "q_5",
    category: "Problem Solving & Architecture",
    text: "If you had to redesign a system that is failing under high traffic load, what steps would you take?",
    description: "Tests system architecture thinking, bottleneck identification, and scalability.",
    isPreDecided: true
  },
  {
    id: "q_6",
    category: "Culture & Collaboration",
    text: "Tell us about a time you had a significant disagreement with a teammate or stakeholder. How did you handle it?",
    description: "Assesses emotional intelligence, conflict resolution, and communication skills.",
    isPreDecided: true
  },
  {
    id: "q_7",
    category: "Wrap-Up & Q&A",
    text: "Do you have any questions for us regarding the team structure, expectations, or upcoming challenges?",
    description: "Gauges candidate engagement, curiosity, and strategic thinking.",
    isPreDecided: true
  }
];
