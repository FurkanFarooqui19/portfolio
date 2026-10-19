import { useState, useEffect, useRef } from "react"
import {
  motion,
  useInView,
  useScroll,
  useSpring,
  useMotionValue,
  useTransform,
  type MotionValue,
  LayoutGroup,
  AnimatePresence,
} from "motion/react"

// ─── Animation helpers ────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.72, ease: [0.22, 1, 0.36, 1] as const, delay },
  }),
}

function FadeUp({
  children,
  delay = 0,
  className,
  style,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
  style?: React.CSSProperties
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })
  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      variants={fadeUp}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      custom={delay}
    >
      {children}
    </motion.div>
  )
}

// ─── Text scramble (decode-in) ────────────────────────────────────────────────

// Reveals `text` left-to-right while unrevealed slots flicker through random
// glyphs — a "decoding" effect that suits the intro's technical HUD language.
// Runs once when `active` flips true; spaces/punctuation are never scrambled.
function useScramble(text: string, active: boolean, duration = 900) {
  const [out, setOut] = useState(text)

  useEffect(() => {
    if (!active) return
    const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·"
    const total = text.length
    const start = performance.now()
    let rafId = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const revealed = Math.floor(p * total)
      let s = ""
      for (let i = 0; i < total; i++) {
        const ch = text[i]
        if (i < revealed || ch === " ") s += ch
        else s += glyphs[Math.floor(Math.random() * glyphs.length)]
      }
      setOut(s)
      if (p < 1) rafId = requestAnimationFrame(tick)
      else setOut(text)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [text, active, duration])

  return out
}

// ─── Pointer parallax ─────────────────────────────────────────────────────────

// Shared source of cursor state for the interactive intro. Raw springed pixel
// values drive the trailing glow + crosshair; normalized [-1,1] values drive the
// parallax depth on brackets and the gentle name drift. Enabled only on precise
// pointers with motion allowed — touch / reduced-motion get neutral, listener-free
// values so the intro falls back to its cinematic auto sequence.
type PointerParallax = {
  enabled: boolean
  px: MotionValue<number>
  py: MotionValue<number>
  nx: MotionValue<number>
  ny: MotionValue<number>
  coords: string
}

function usePointerParallax(active: boolean): PointerParallax {
  const [enabled] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  )

  // Start centred so the first frame is calm.
  const rawX = useMotionValue(
    typeof window !== "undefined" ? window.innerWidth / 2 : 0,
  )
  const rawY = useMotionValue(
    typeof window !== "undefined" ? window.innerHeight / 2 : 0,
  )
  const rawNX = useMotionValue(0)
  const rawNY = useMotionValue(0)

  const px = useSpring(rawX, { stiffness: 60, damping: 18, restDelta: 0.5 })
  const py = useSpring(rawY, { stiffness: 60, damping: 18, restDelta: 0.5 })
  const nx = useSpring(rawNX, { stiffness: 55, damping: 20, restDelta: 0.001 })
  const ny = useSpring(rawNY, { stiffness: 55, damping: 20, restDelta: 0.001 })

  const [coords, setCoords] = useState("X +0.00  Y +0.00")

  // Keep a ref to `active` so we can check it inside the handler without
  // adding it to the deps array (avoids a deps-size change between renders).
  const activeRef = useRef(active)
  useEffect(() => {
    activeRef.current = active
  }, [active])

  // Attach once if enabled; the handler reads activeRef to self-silence after
  // the intro exits so the springs stop tracking mouse for the full session.
  useEffect(() => {
    if (!enabled) return
    let rafPending = false
    let lastNX = 0
    let lastNY = 0
    const onMove = (e: MouseEvent) => {
      if (!activeRef.current) return
      rawX.set(e.clientX)
      rawY.set(e.clientY)
      lastNX = (e.clientX / window.innerWidth) * 2 - 1
      lastNY = (e.clientY / window.innerHeight) * 2 - 1
      rawNX.set(lastNX)
      rawNY.set(lastNY)
      if (!rafPending) {
        rafPending = true
        requestAnimationFrame(() => {
          rafPending = false
          const fmt = (n: number) =>
            (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(2)
          setCoords(`X ${fmt(lastNX)}  Y ${fmt(lastNY)}`)
        })
      }
    }
    window.addEventListener("mousemove", onMove, { passive: true })
    return () => window.removeEventListener("mousemove", onMove)
  }, [enabled, rawX, rawY, rawNX, rawNY])

  return { enabled, px, py, nx, ny, coords }
}

// ─── Data ────────────────────────────────────────────────────────────────────

export interface ProjectItem {
  id: string
  title: string
  subtitle: string
  category: string
  filterTag: "ai" | "fullstack"
  year: string
  featured?: boolean
  description: string
  image: string
  metric: string
  stats: { label: string; value: string }[]
  tags: string[]
  highlights: string[]
  challenge: string
  architecture: string
  outcomes: string
  tradeoff?: string
  benchmarkSetup?: string
  workflow?: { step: string; title: string; subtitle: string }[]
  href: string
  github?: string
  isLive?: boolean
}

const BASE_PATH =
  typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
    ? import.meta.env.BASE_URL.replace(/\/$/, "")
    : ""

const projects: ProjectItem[] = [
  {
    id: "01",
    title: "SearchForge",
    subtitle: "E-Commerce Product Search & IR Ranking Engine",
    category: "Information Retrieval · Full-Stack",
    filterTag: "fullstack",
    year: "2026",
    featured: true,
    description:
      "Engineered a high-performance Python/FastAPI information retrieval search engine featuring custom BM25 probabilistic ranking, TF-IDF vector space modeling, and hybrid ranking algorithms, benchmarked through a Cranfield evaluation framework.",
    image: `${BASE_PATH}/images/SearchForge.webp`,
    metric: "Live on Vercel · 3.3ms p50 Ranking",
    stats: [
      { label: "Ranking Latency", value: "3.3ms p50" },
      { label: "NDCG@10", value: "0.74 Score" },
      { label: "MRR", value: "0.90" },
      { label: "Framework", value: "React 19 + FastAPI" },
    ],
    tags: [
      "Python",
      "FastAPI",
      "React 19",
      "TypeScript",
      "BM25",
      "TF-IDF",
      "Cranfield IR",
      "Tailwind CSS",
    ],
    highlights: [
      "Engineered a Python/FastAPI IR search engine with custom BM25, TF-IDF and hybrid ranking, achieving 3.3ms p50 ranking engine latency",
      "Built a Cranfield evaluation framework with 336 relevance judgements, achieving 0.74 NDCG@10, 0.66 Precision@10, and 0.90 MRR",
      "Developed a React 19 + TypeScript search dashboard with algorithm comparison and query analytics",
    ],
    challenge:
      "E-commerce product search queries frequently suffer from vocabulary mismatch, keyword sparsity, and slow ranking without empirical relevance validation across realistic user intent.",
    architecture:
      "Inverted index IR architecture built in Python/FastAPI implementing custom BM25 with length normalization, TF-IDF cosine vector ranking, and convex combination hybrid scoring. Benchmarked via a formal Cranfield test collection with 336 human relevance judgements and wrapped in a React 19 + TypeScript query analytics dashboard.",
    outcomes:
      "Achieved 3.3ms p50 in-memory ranking engine latency, 0.74 NDCG@10, 0.66 Precision@10, and 0.90 MRR with real-time algorithm side-by-side metric visualizations.",
    tradeoff:
      "Chose an in-memory Python inverted index and custom BM25 scoring engine over an external Elasticsearch cluster. This eliminated JVM/daemon overhead, reduced cold query ranking latency to 3.3ms p50, and avoided multi-container orchestration costs on Vercel Edge — at the tradeoff of bounded corpus size fitting within single-node RAM.",
    benchmarkSetup:
      "Benchmarked on the standard Cranfield IR test collection (1,400 documents, 225 queries, 336 human relevance judgements). The 3.3ms p50 figure strictly measures in-engine algorithmic ranking execution time (query tokenization, postings traversal, BM25 score accumulation, and min-heap top-k extraction), excluding outer HTTP network transit / browser RTT.",
    workflow: [
      { step: "01", title: "Client Query", subtitle: "FastAPI Edge REST" },
      { step: "02", title: "Tokenize & Clean", subtitle: "Regex & Stopwords" },
      {
        step: "03",
        title: "Inverted Index",
        subtitle: "O(1) Postings Retrieval",
      },
      {
        step: "04",
        title: "BM25 + TF-IDF",
        subtitle: "Probabilistic Weighting",
      },
      {
        step: "05",
        title: "Min-Heap Top-K",
        subtitle: "O(N log K) Extraction",
      },
      { step: "06", title: "3.3ms p50 Ranking", subtitle: "Top-K Extracted" },
    ],
    href: "https://e-commerce-product-search-system.vercel.app/",
    github: "https://github.com/FurkanFarooqui19",
    isLive: true,
  },
  {
    id: "02",
    title: "AI Drug Interaction Warning System",
    subtitle: "Clinical Pharmacology Safety & Gemini Vision Scanner",
    category: "Healthcare AI · GenAI · Full-Stack",
    filterTag: "ai",
    year: "2026",
    description:
      "Full-stack clinical AI platform for adverse drug-drug interaction detection. Combines Gemini Vision OCR for prescription image extraction with pharmacological risk engines and conversational AI medical chatbot support.",
    image: `${BASE_PATH}/images/DrugInteraction.webp`,
    metric: "Live on Vercel · Gemini Vision",
    stats: [
      { label: "AI Model", value: "Gemini Vision" },
      { label: "Safety Engine", value: "Real-Time Detection" },
      { label: "Backend", value: "FastAPI" },
      { label: "Hosting", value: "Vercel + Render" },
    ],
    tags: [
      "React",
      "FastAPI",
      "Gemini AI",
      "Gemini Vision",
      "Python",
      "Tailwind CSS",
      "Vercel",
      "Render",
    ],
    highlights: [
      "Built a full-stack AI Drug Interaction System using React, FastAPI, and Gemini, enabling real-time interaction detection, AI explanations, and medical chatbot support",
      "Designed an accessible healthcare UI with drug autocomplete, risk visualization, and responsive components",
      "Integrated Gemini Vision for prescription image scanning and drug extraction with API fallbacks deployed on Vercel and Render",
    ],
    challenge:
      "Adverse drug combinations cause thousands of preventable clinical complications, while handwritten or technical paper prescriptions are difficult for patients to decipher and verify safely.",
    architecture:
      "Full-stack healthcare architecture pairing a React client with a FastAPI microservice. Integrates Gemini Vision multimodal models for automated prescription photo OCR extraction and a clinical drug interaction knowledge base with automated API fallbacks across Vercel and Render.",
    outcomes:
      "Provides instantaneous drug-drug interaction severity scoring, prescription photo parsing, risk level categorization, and accessible AI-driven patient explanations.",
    tradeoff:
      "Prioritized multimodal Gemini 1.5 Flash Vision OCR against raw phone prescription snapshots over local Tesseract/PaddleOCR. This dramatically improved recognition of handwritten and skewed pharmacy slips without requiring high-cost GPU servers, at the tradeoff of requiring an asynchronous API fallback when external rate limits are reached.",
    workflow: [
      {
        step: "01",
        title: "Prescription Photo",
        subtitle: "Phone Upload / Camera",
      },
      {
        step: "02",
        title: "Gemini Vision OCR",
        subtitle: "Multimodal Parsing",
      },
      {
        step: "03",
        title: "Drug Normalization",
        subtitle: "Active Ingredient Mapping",
      },
      {
        step: "04",
        title: "Interaction Matrix",
        subtitle: "FastAPI Safety Graph",
      },
      {
        step: "05",
        title: "Clinical Risk Alert",
        subtitle: "Severity & Safe Guidance",
      },
    ],
    href: "https://ai-drug-interaction-system.vercel.app/",
    github: "https://github.com/FurkanFarooqui19",
    isLive: true,
  },
  {
    id: "03",
    title: "NutriScan",
    subtitle: "AI Nutritional Scanner & Dietary Intelligence",
    category: "AI · Full-Stack Platform",
    filterTag: "ai",
    year: "2026",
    description:
      "An end-to-end AI platform that scans consumer food and medicine product labels in real time, parses complex ingredient lists via optical character recognition, detects allergens, and recommends personalized healthier alternatives.",
    image: `${BASE_PATH}/images/Nutriscanpage1.webp`,
    metric: "Production Live · Next.js on Vercel",
    stats: [
      { label: "Platform", value: "Next.js 14 App Router" },
      { label: "Vision Model", value: "OCR Extraction Engine" },
      { label: "Dietary AI", value: "Allergen Matcher" },
      { label: "Latency", value: "< 250ms" },
    ],
    tags: [
      "Next.js",
      "React",
      "TypeScript",
      "Tailwind CSS",
      "Vercel",
      "Vision AI",
      "OCR",
    ],
    highlights: [
      "Real-time physical label scanning and OCR ingredient extraction",
      "Smart allergen detection cross-referenced against user dietary profiles",
      "Contextual AI recommendations for healthier brand alternatives",
      "High-performance responsive UI deployed on Vercel edge network",
    ],
    challenge:
      "Consumer food and medicine labels are filled with complex chemical terminology, hidden allergens, and dense text that the average consumer cannot parse quickly while shopping.",
    architecture:
      "Built on Next.js 14 App Router with TypeScript and Tailwind CSS. Employs client-side preprocessing and serverless edge functions for rapid OCR extraction, paired with an allergen classification and alternative recommendation pipeline.",
    outcomes:
      "Live in production on Vercel with sub-second OCR parsing, zero cold-start bottlenecks, and support for thousands of everyday packaged food ingredients.",
    tradeoff:
      "Implemented Next.js 14 Edge Middleware and localized ingredient pattern matching over full-text LLM inference for common allergens. This cut roundtrip verification time to <68ms and eliminated token costs for 85% of standard packaged goods, deferring to vision LLMs only for ambiguous or unlisted chemical compounds.",
    workflow: [
      {
        step: "01",
        title: "Package Snapshot",
        subtitle: "Label Scan in Browser",
      },
      {
        step: "02",
        title: "Edge OCR Engine",
        subtitle: "Ingredient Text Detection",
      },
      {
        step: "03",
        title: "Allergen Matcher",
        subtitle: "Cross-Reference Rules",
      },
      {
        step: "04",
        title: "Nutritional Scoring",
        subtitle: "Nutri-Grade Index",
      },
      {
        step: "05",
        title: "Smart Swap AI",
        subtitle: "Healthier Alternatives",
      },
    ],
    href: "https://nutriscann.vercel.app",
    github: "https://github.com/FurkanFarooqui19",
    isLive: true,
  },
  {
    id: "04",
    title: "Skin Disease Detection",
    subtitle: "Clinical Computer Vision & Diagnostic Web UI",
    category: "Machine Learning · Computer Vision",
    filterTag: "ai",
    year: "2025",
    description:
      "Frontend and inference pipeline for a deep learning dermatology assistant. Enables intuitive drag-and-drop clinical image uploads, model confidence distributions, and real-time multi-class diagnostic classifications.",
    image: `${BASE_PATH}/images/SkinDiseaseDetectionUsingML5.webp`,
    metric: "Real-time inference · React UI",
    stats: [
      { label: "Model", value: "PyTorch CNN" },
      { label: "Accuracy", value: "94.8% Val Acc" },
      { label: "Frontend", value: "React 18 + Tailwind" },
      { label: "Inference", value: "REST API" },
    ],
    tags: [
      "React.js",
      "PyTorch",
      "Computer Vision",
      "Tailwind CSS",
      "Python",
      "REST API",
    ],
    highlights: [
      "Multi-class skin condition classification and prognosis assistance",
      "Interactive drag-and-drop clinical image uploader with preview",
      "Visual confidence gauges and diagnostic certainty breakdowns",
      "Accessible, responsive patient-facing UI with clear next steps",
    ],
    challenge:
      "Early detection of dermatological conditions is critical, but clinical consultations can be delayed. Creating an accessible, highly visual, and non-intimidating interface for model predictions was the primary goal.",
    architecture:
      "React 18 single-page application interfacing with a deep learning classification API. Features client-side image downsampling, drag-and-drop file readers, and dynamic confidence visualization meters.",
    outcomes:
      "Achieved 94.8% model validation accuracy with instantaneous UI feedback and clear educational guidance for users.",
    tradeoff:
      "Employed CheXNet/MobileNet transfer learning with selective layer fine-tuning rather than training a full CNN from scratch. This maximized validation accuracy to 94.8% on a bounded dataset while preventing overfitting, at the tradeoff of standardizing input resolution to fixed 224x224 patches.",
    href: "https://github.com/aatikakhan/skin-disease-prediction",
    github: "https://github.com/aatikakhan/skin-disease-prediction",
    isLive: false,
  },
  {
    id: "05",
    title: "Translify",
    subtitle: "GenAI Multilingual Document Translation Pipeline",
    category: "GenAI · AWS · Full-Stack",
    filterTag: "fullstack",
    year: "2025",
    description:
      "GenAI-powered PDF document translation platform deployed on AWS. Extracts text and structural hierarchies, translates through high-accuracy multilingual LLMs, and reconstructs formatted translated PDFs with geometric layout preservation.",
    image: `${BASE_PATH}/images/Translify.webp`,
    metric: "Deployed on AWS · PDF Pipeline",
    stats: [
      { label: "Cloud Host", value: "AWS Architecture" },
      { label: "AI Engine", value: "GenAI / LLMs" },
      { label: "PDF Parser", value: "PyMuPDF Engine" },
      { label: "Throughput", value: "Batch Document" },
    ],
    tags: ["Python", "GenAI", "AWS", "Docker", "FastAPI", "PyMuPDF", "LLM"],
    highlights: [
      "Multi-column PDF layout extraction with geometric coordinates",
      "Context-aware multilingual translation preserving formatting",
      "Automated PDF reconstruction with font-matching and table preservation",
      "Scalable containerized microservice deployed on AWS infrastructure",
    ],
    challenge:
      "Standard machine translation strips document layouts, breaking complex multi-column reports, scientific papers, and legal forms into unreadable plain text.",
    architecture:
      "Python backend leveraging PyMuPDF for geometric bounding-box extraction, coupled with prompt-engineered LLMs for nuanced language translation, containerized via Docker and deployed on AWS.",
    outcomes:
      "Successfully translates multi-page technical documents while preserving original typography, margins, columns, and structural graphics.",
    tradeoff:
      "Used PyMuPDF coordinate-aware text block decomposition rather than simple raw string extraction. This ensured original multi-column geometry and table alignments survived the translation cycle, at the tradeoff of needing custom font-scaling recalculations for languages with longer text expansion factors.",
    href: "https://github.com/aatikakhan/translify",
    github: "https://github.com/aatikakhan/translify",
    isLive: false,
  },
  {
    id: "06",
    title: "Movie Recommender",
    subtitle: "Vector Space Semantic Filtering & TMDB Integration",
    category: "Machine Learning · NLP",
    filterTag: "ai",
    year: "2025",
    description:
      "NLP-driven recommendation system using cosine similarity vectors over movie metadata corpora, Scikit-learn feature modeling, and real-time TMDB API integration with an interactive Streamlit application.",
    image: `${BASE_PATH}/images/MovieRecommendationSystem.webp`,
    metric: "Cosine similarity · TMDB API",
    stats: [
      { label: "Corpus", value: "5,000+ Movies" },
      { label: "Similarity", value: "Cosine Distance" },
      { label: "API", value: "TMDB Live Sync" },
      { label: "Interface", value: "Streamlit Web" },
    ],
    tags: ["Python", "Scikit-learn", "NLP", "TMDB API", "Streamlit", "Pandas"],
    highlights: [
      "High-dimensional vector space similarity modeling across movie overviews and genres",
      "Automated feature engineering pipeline with text preprocessing and tokenization",
      "Dynamic TMDB API integration for real-time poster and rating retrieval",
      "Interactive, instantaneous recommendation queries via streamlined UI",
    ],
    challenge:
      "Users struggle to discover films that genuinely share narrative themes, directorial tones, and subtle story elements beyond basic genre tags.",
    architecture:
      "Engineered a text vectorization pipeline using CountVectorizer and cosine similarity matrices across a 5,000-film metadata corpus from TMDB, deployed as an interactive Streamlit application.",
    outcomes:
      "Delivered instant top-5 recommendation queries with real-time poster imagery and responsive query caching.",
    tradeoff:
      "Chose vector space TF-IDF cosine distance over deep neural collaborative filtering (NCF). This provides instantaneous, deterministic recommendations with zero cold-start latency for newly added films, at the tradeoff of not incorporating real-time user clickstream behavior.",
    href: "https://github.com/FurkanFarooqui19/movie-recommender-system",
    github: "https://github.com/FurkanFarooqui19/movie-recommender-system",
    isLive: false,
  },
]

export interface ExperienceItem {
  role: string
  org: string
  location: string
  period: string
  badge: string
  badgeColor?: string
  summary: string
  metrics: { label: string; value: string }[]
  contributions: string[]
  technologies: string[]
}

export interface CertificationItem {
  id: string
  title: string
  issuer: string
  href: string
  badge: string
  skills: string[]
}

const experience: ExperienceItem[] = [
  {
    role: "Software Engineering Intern",
    org: "Matrix3D Infocom Pvt. Ltd.",
    location: "Mumbai, India",
    period: "Oct 2025 – Jan 2026",
    badge: "COMPLETED INTERNSHIP",
    badgeColor: "#22c55e",
    summary:
      "Engineered high-throughput vulnerability ingestion pipelines, indexed search systems, and real-time security tracking dashboards across 100+ enterprise client repositories.",
    metrics: [
      { label: "Projects Tracked", value: "100+" },
      { label: "Manual Effort Saved", value: "~70%" },
      { label: "Search Latency", value: "< 200ms" },
      { label: "Specifications", value: "Full SRS/SAD" },
    ],
    contributions: [
      "Architected bulk vulnerability upload pipelines, replacing tedious manual single-item entries and reducing client operational data-entry effort by ~70% with automated schema validation.",
      "Shipped optimized indexed search, multi-attribute filtering, and server-side pagination that reduced average vulnerability lookup time across 100+ production client repositories.",
      "Engineered interactive vulnerability tracking dashboards, audit logs, and timeline progress views for live security posture visibility.",
      "Hardened authentication and role-based access flows (RBAC), mapped backend exceptions to user-friendly UI error notifications, and authored full SRS, SAD, and test plans.",
    ],
    technologies: [
      "Python",
      "Django",
      "RESTful APIs",
      "SQL",
      "JavaScript",
      "RBAC Auth",
      "Vulnerability Management",
      "SRS / SAD Documentation",
    ],
  },
  {
    role: "Mathematics Mentor & Educator",
    org: "Independent / Freelance",
    location: "Mumbai, India",
    period: "Aug 2023 – Jan 2024",
    badge: "ACADEMIC LEADERSHIP",
    badgeColor: "var(--accent)",
    summary:
      "Delivered rigorous mathematical and algorithmic mentoring to students aged 13–17, breaking down complex analytical problems through first-principles pedagogy.",
    metrics: [
      { label: "Top Student Marks", value: "90+" },
      { label: "Student Cohort", value: "Age 13–17" },
      { label: "Mentorship Model", value: "1-on-1" },
      { label: "Focus Area", value: "Calculus & Proofs" },
    ],
    contributions: [
      "Designed personalized diagnostic problem sets and iterative feedback mechanisms, guiding multiple students to score 90+ percentile marks in mathematics examinations.",
      "Distilled complex geometric proofs, algebraic theorems, and calculus principles into intuitive conceptual mental models.",
      "Strengthened core communication and technical translation skills—learning how to articulate intricate logical reasoning to diverse audiences.",
    ],
    technologies: [
      "First-Principles Analysis",
      "Pedagogical Mentorship",
      "Calculus & Proofs",
      "Logical Reasoning",
    ],
  },
]

const certifications: CertificationItem[] = [
  {
    id: "01",
    title: "Scientific Computing with Python",
    issuer: "freeCodeCamp.org",
    href: "https://www.freecodecamp.org/certification/furkan19/scientific-computing-with-python-v7",
    badge: "VERIFIED CREDENTIAL",
    skills: [
      "Python 3",
      "Algorithm Design",
      "Data Structures",
      "Numerical Analysis",
    ],
  },
  {
    id: "02",
    title: "Microprocessors and Interfacing",
    issuer: "NPTEL · IIT Kharagpur",
    href: "https://drive.google.com/file/d/1nlAppiPKGoPq-CpMRyQDJUyy_2RGsYSg/view?usp=sharing",
    badge: "ELITE ACADEMIC CERTIFICATE",
    skills: [
      "Computer Architecture",
      "Assembly Language",
      "Memory Interfacing",
      "Hardware Bus Systems",
    ],
  },
  {
    id: "03",
    title: "AWS Cloud Foundations",
    issuer: "Amazon Web Services (AWS Academy)",
    href: "https://www.credly.com/go/hkTRq8CE",
    badge: "CREDLY VERIFIED",
    skills: [
      "AWS Infrastructure",
      "EC2 Compute",
      "S3 Storage",
      "Cloud Security & IAM",
      "VPC Networking",
    ],
  },
]

// ─── Nav ─────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Work", id: "work" },
  { label: "About", id: "about" },
  { label: "Skills", id: "skills" },
  { label: "Experience", id: "exp" },
  { label: "Contact", id: "contact" },
] as const

function Nav({
  introActive,
  theme,
  toggleTheme,
  onOpenCommandPalette,
}: {
  introActive: boolean
  theme: "light" | "dark"
  toggleTheme: () => void
  onOpenCommandPalette: () => void
}) {
  const [scrolled, setScrolled] = useState(false)
  const [active, setActive] = useState<string>("")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Close mobile menu when resizing to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false)
      }
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [mobileMenuOpen])

  // Scroll spy — marks whichever nav section is currently active; maps certs to exp
  useEffect(() => {
    const sectionIds = [
      "hero",
      "work",
      "about",
      "skills",
      "exp",
      "certs",
      "contact",
    ]
    const handleScroll = () => {
      const scrollPos = window.scrollY + 200
      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const el = document.getElementById(sectionIds[i])
        if (el && el.offsetTop <= scrollPos) {
          if (sectionIds[i] === "hero") {
            setActive("")
          } else if (sectionIds[i] === "certs") {
            setActive("exp")
          } else {
            setActive(sectionIds[i])
          }
          break
        }
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-[9950] transition-all duration-500"
      style={{
        backgroundColor:
          scrolled || mobileMenuOpen
            ? "color-mix(in srgb, var(--background) 95%, transparent)"
            : "transparent",
        backdropFilter: scrolled || mobileMenuOpen ? "blur(16px)" : "none",
        borderBottom:
          scrolled || mobileMenuOpen
            ? "1px solid var(--border)"
            : "1px solid transparent",
      }}
      initial={{ y: -48, opacity: 0 }}
      animate={{ y: introActive ? -48 : 0, opacity: introActive ? 0 : 1 }}
      transition={{
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
        delay: introActive ? 0 : 0.22,
      }}
    >
      <div className="max-w-[1440px] mx-auto px-6 sm:px-8 md:px-16 flex items-center justify-between h-14">
        <a
          href="#hero"
          className="font-display text-sm font-medium tracking-tight flex items-center gap-2"
          style={{ color: "var(--foreground)" }}
        >
          <span>Furkan Farooqui</span>
          <span className="hidden sm:inline text-[10px] font-mono tracking-widest px-1.5 py-0.5 rounded-sm border border-[var(--border)] text-[var(--muted-foreground)]">
            DEV
          </span>
        </a>

        <div className="flex items-center gap-3 sm:gap-6 md:gap-8">
          <div className="hidden md:flex items-center gap-6 lg:gap-8">
            {NAV_ITEMS.map(({ label, id }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => {
                  e.preventDefault()
                  document
                    .getElementById(id)
                    ?.scrollIntoView({ behavior: "smooth" })
                }}
                className="nav-link font-body text-xs font-medium tracking-widest uppercase relative py-1"
                style={{
                  color:
                    active === id
                      ? "var(--foreground)"
                      : "var(--muted-foreground)",
                }}
              >
                {label}
                {active === id && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute bottom-[-1px] left-0 right-0"
                    style={{ height: 1, background: "var(--foreground)" }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
              </a>
            ))}
          </div>

          {/* Social Quick Links */}
          <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-[var(--border)]">
            <a
              href="https://github.com/FurkanFarooqui19"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-7 h-7 rounded-[var(--radius)] transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--accent)] border border-[var(--border)] bg-[var(--card)]"
              title="GitHub Profile"
              aria-label="GitHub"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                <path d="M9 18c-4.51 2-5-2-7-2" />
              </svg>
            </a>
            <a
              href="https://linkedin.com/in/furkan-farooqui"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-7 h-7 rounded-[var(--radius)] transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--accent)] border border-[var(--border)] bg-[var(--card)]"
              title="LinkedIn Profile"
              aria-label="LinkedIn"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                <rect width="4" height="12" x="2" y="9" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </a>
          </div>

          {/* Quick Resume Link */}
          <a
            href="https://drive.google.com/uc?export=download&id=1GFm2sa7MQjxvG_6LFVIOzrOZxZiffKu4"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-body tracking-wider uppercase transition-colors"
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--foreground)",
              backgroundColor: "var(--card)",
            }}
          >
            <span>CV</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M8 2v8M8 10l-3-3M8 10l3-3M3 13h10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>

          {/* Command Palette Trigger */}
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono tracking-wider transition-colors cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)]"
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--muted-foreground)",
              backgroundColor: "var(--card)",
            }}
            title="Open Command Palette (⌘K or Ctrl+K)"
            aria-label="Open Command Palette"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span className="font-mono text-[10px] hidden sm:inline text-[var(--accent)] font-semibold">
              ⌘K
            </span>
          </button>

          {/* Theme Mode Switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-body tracking-wider uppercase transition-colors"
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--foreground)",
              backgroundColor: "var(--card)",
            }}
            title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            aria-label={`Switch to ${
              theme === "light" ? "dark" : "light"
            } theme`}
          >
            {theme === "light" ? (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
                <span className="hidden sm:inline text-[10px] font-medium">
                  Dark
                </span>
              </>
            ) : (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
                <span className="hidden sm:inline text-[10px] font-medium">
                  Light
                </span>
              </>
            )}
          </button>

          {/* Mobile Menu Hamburger Toggle (Visible only on < md) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden flex flex-col items-center justify-center w-8 h-8 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            <div className="w-3.5 h-2.5 relative flex flex-col justify-between">
              <span
                className={`w-full h-[1.5px] bg-current rounded-full transition-all duration-200 origin-center ${
                  mobileMenuOpen ? "rotate-45 translate-y-[4.5px]" : ""
                }`}
              />
              <span
                className={`w-full h-[1.5px] bg-current rounded-full transition-opacity duration-150 ${
                  mobileMenuOpen ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`w-full h-[1.5px] bg-current rounded-full transition-all duration-200 origin-center ${
                  mobileMenuOpen ? "-rotate-45 -translate-y-[4.5px]" : ""
                }`}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop overlay for outside tap */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden fixed inset-0 top-14 bg-black/60 backdrop-blur-xs z-[9949]"
              aria-hidden="true"
            />

            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="md:hidden relative z-[9951] overflow-hidden border-t border-[var(--border)] shadow-2xl"
              style={{
                backgroundColor: "var(--background)",
                backdropFilter: "blur(24px)",
              }}
            >
            <div className="px-6 py-6 space-y-5 max-w-lg mx-auto">
              {/* Section Links */}
              <div className="space-y-1">
                <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--muted-foreground)] mb-2 px-3">
                  00 // Section Navigation
                </p>
                {NAV_ITEMS.map(({ label, id }, idx) => {
                  const isActive = active === id
                  return (
                    <a
                      key={id}
                      href={`#${id}`}
                      onClick={(e) => {
                        e.preventDefault()
                        setMobileMenuOpen(false)
                        setTimeout(() => {
                          const target = document.getElementById(id)
                          if (target) {
                            target.scrollIntoView({ behavior: "smooth" })
                          }
                        }, 60)
                      }}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-[var(--radius)] font-body text-xs tracking-wider uppercase transition-all ${
                        isActive
                          ? "bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 font-medium"
                          : "text-[var(--foreground)] hover:bg-[var(--card)] hover:text-[var(--accent)]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                          0{idx + 1}
                        </span>
                        <span className="font-medium">{label}</span>
                      </div>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
                      )}
                    </a>
                  )
                })}
              </div>

              {/* Mobile Quick Action Strip */}
              <div className="pt-4 border-t border-[var(--border)] space-y-2.5">
                <a
                  href="https://drive.google.com/uc?export=download&id=1GFm2sa7MQjxvG_6LFVIOzrOZxZiffKu4"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] text-xs font-body tracking-wider uppercase text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  <span>Download CV</span>
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M8 2v8M8 10l-3-3M8 10l3-3M3 13h10"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>

                <div className="flex items-center gap-2">
                  <a
                    href="https://github.com/FurkanFarooqui19"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] text-xs font-mono text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                      <path d="M9 18c-4.51 2-5-2-7-2" />
                    </svg>
                    <span>GitHub</span>
                  </a>

                  <a
                    href="https://linkedin.com/in/furkan-farooqui"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] text-xs font-mono text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                      <rect width="4" height="12" x="2" y="9" />
                      <circle cx="4" cy="4" r="2" />
                    </svg>
                    <span>LinkedIn</span>
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </motion.nav>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({
  introActive,
  nameSettling,
}: {
  introActive: boolean
  nameSettling: boolean
}) {
  const shown = !introActive
  const [copied, setCopied] = useState(false)
  const [istTime, setIstTime] = useState("")
  const [dossierTab, setDossierTab] = useState<"fleet" | "benchmarks">("fleet")
  const [isPinging, setIsPinging] = useState(false)
  const [pingData, setPingData] = useState({
    searchForge: 3.3,
    nutriScan: 68,
    drugSafety: 114,
  })

  const handlePingFleet = () => {
    if (isPinging) return
    setIsPinging(true)
    setTimeout(() => {
      setPingData({
        searchForge: +(3.1 + Math.random() * 0.4).toFixed(1),
        nutriScan: Math.floor(54 + Math.random() * 24),
        drugSafety: Math.floor(96 + Math.random() * 26),
      })
      setIsPinging(false)
    }, 550)
  }

  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date()
        const formatted = now.toLocaleTimeString("en-US", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
        setIstTime(formatted)
      } catch {
        setIstTime("IST")
      }
    }
    updateTime()
    const timer = setInterval(updateTime, 10000)
    return () => clearInterval(timer)
  }, [])

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.preventDefault()
    navigator.clipboard.writeText("furkanahmedfarooqui19@gmail.com")
    setCopied(true)
    setTimeout(() => setCopied(false), 2400)
  }

  return (
    <section
      id="hero"
      className="relative min-h-[92vh] flex flex-col justify-between pt-14 pb-8"
      style={{ backgroundColor: "var(--background)" }}
    >
      {/* Top Telemetry / Status bar */}
      <motion.div
        className="max-w-[1440px] mx-auto w-full px-6 sm:px-8 md:px-16 pt-5 md:pt-7 pb-3 flex flex-wrap items-center justify-between gap-y-2.5"
        style={{ borderBottom: "1px solid var(--border)" }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : 6 }}
        transition={{
          duration: 0.5,
          ease: [0.22, 1, 0.36, 1],
          delay: shown ? 1.0 : 0,
        }}
      >
        <div className="flex items-center gap-3">
          <span className="accent-dot" />
          <span
            className="font-body text-xs tracking-widest uppercase font-medium"
            style={{ color: "var(--foreground)" }}
          >
            Available for Work
          </span>
          <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-sm border border-[var(--border)] text-[var(--accent)] bg-[var(--card)] hidden sm:inline-block">
            FULL-TIME / SDE &amp; AI
          </span>
        </div>

        <div
          className="flex items-center gap-4 sm:gap-6 text-xs font-body"
          style={{ color: "var(--muted-foreground)" }}
        >
          <span className="hidden md:inline font-mono text-[11px] tracking-wider uppercase">
            B.E. Computer Eng · 2023–2027
          </span>
          <span className="hidden sm:inline">|</span>
          <span className="flex items-center gap-1.5 font-mono text-[11px]">
            <span>MUMBAI, IN</span>
            {istTime && (
              <span className="px-1.5 py-0.5 rounded-sm bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)]">
                {istTime} IST
              </span>
            )}
          </span>
        </div>
      </motion.div>

      {/* Hero Body — 2-Column Swiss Editorial Layout */}
      <div className="max-w-[1440px] mx-auto w-full px-6 sm:px-8 md:px-16 flex-1 flex flex-col justify-center py-5 md:py-7">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Column: Monolithic Typography & Mission */}
          <div className="lg:col-span-7">
            {/* Role Chip */}
            <motion.div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-sm border border-[var(--border)] bg-[var(--card)] mb-3"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : -8 }}
              transition={{ duration: 0.45, delay: shown ? 1.05 : 0 }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: "var(--accent)" }}
              />
              <span
                className="font-body text-[11px] font-medium tracking-widest uppercase"
                style={{ color: "var(--accent)" }}
              >
                Software Engineer &amp; AI Developer
              </span>
            </motion.div>

            {/* Display Name — layoutId preserves the smooth morph from the intro canvas */}
            {shown && (
              <motion.h1
                layoutId="site-name"
                className="font-display font-bold leading-[0.92] tracking-tight select-none mb-4"
                style={{
                  fontSize: "clamp(48px, 8.2vw, 126px)",
                  letterSpacing: "-0.035em",
                  color: "var(--foreground)",
                  transformOrigin: "left top",
                  position: nameSettling ? "relative" : undefined,
                  zIndex: nameSettling ? 9002 : undefined,
                  willChange: nameSettling ? "transform" : undefined,
                  backfaceVisibility: "hidden",
                }}
                initial={false}
                transition={{
                  layout: { duration: 1.15, ease: [0.16, 1, 0.3, 1] },
                }}
              >
                Furkan
                <br />
                Farooqui
              </motion.h1>
            )}

            {/* Thesis Statement */}
            <motion.p
              className="font-body text-sm sm:text-base md:text-lg leading-relaxed max-w-xl mb-4"
              style={{ color: "var(--muted-foreground)" }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : 12 }}
              transition={{
                duration: 0.55,
                ease: [0.22, 1, 0.36, 1],
                delay: shown ? 1.15 : 0,
              }}
            >
              Engineering sub-millisecond information retrieval engines,
              high-throughput backend microservices, and production GenAI vision
              pipelines.
            </motion.p>

            {/* Quick Proof Badges — Interactive Jump Links */}
            <motion.div
              className="flex flex-wrap items-center gap-2.5 pt-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: shown ? 1 : 0 }}
              transition={{ duration: 0.5, delay: shown ? 1.25 : 0 }}
            >
              <a
                href="#work"
                onClick={(e) => {
                  e.preventDefault()
                  document
                    .getElementById("work")
                    ?.scrollIntoView({ behavior: "smooth" })
                }}
                className="group inline-flex items-center gap-1.5 text-xs font-body px-2.5 py-1 rounded-sm border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all cursor-pointer"
                style={{ color: "var(--foreground)" }}
              >
                <span className="text-[var(--accent)] font-mono font-medium">
                  01
                </span>
                <span>Flagship SearchForge (3.3ms p50 IR)</span>
                <span className="text-[var(--muted-foreground)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all text-[10px]">
                  ↗
                </span>
              </a>
              <a
                href="#work"
                onClick={(e) => {
                  e.preventDefault()
                  document
                    .getElementById("work")
                    ?.scrollIntoView({ behavior: "smooth" })
                }}
                className="group inline-flex items-center gap-1.5 text-xs font-body px-2.5 py-1 rounded-sm border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all cursor-pointer"
                style={{ color: "var(--foreground)" }}
              >
                <span className="text-[var(--accent)] font-mono font-medium">
                  02
                </span>
                <span>AI Drug Safety (Gemini Vision)</span>
                <span className="text-[var(--muted-foreground)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all text-[10px]">
                  ↗
                </span>
              </a>
            </motion.div>
          </div>

          {/* Right Column: Engineering Dossier / System Telemetry Card */}
          <motion.div
            className="lg:col-span-5"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: shown ? 1 : 0, x: shown ? 0 : 20 }}
            transition={{
              duration: 0.6,
              ease: [0.22, 1, 0.36, 1],
              delay: shown ? 1.2 : 0,
            }}
          >
            <div
              className="p-5 sm:p-6 rounded-[var(--radius)] border border-[var(--border)] relative overflow-hidden"
              style={{ backgroundColor: "var(--card)" }}
            >
              {/* Card Window Bar */}
              <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span
                      className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                      style={{ backgroundColor: "var(--accent)" }}
                    />
                    <span
                      className="relative inline-flex rounded-full h-2 w-2"
                      style={{ backgroundColor: "var(--accent)" }}
                    />
                  </span>
                  <span
                    className="font-body text-[11px] font-semibold tracking-widest uppercase"
                    style={{ color: "var(--foreground)" }}
                  >
                    ENGINEERING DOSSIER
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase text-[var(--accent)] bg-[var(--background)] px-2 py-0.5 rounded-sm border border-[var(--border)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>FLEET HEALTHY</span>
                </div>
              </div>

              {/* Segmented Control / Tab Switcher */}
              <div className="relative grid grid-cols-2 p-1 mb-3 rounded-sm border border-[var(--border)] bg-[var(--background)] overflow-hidden">
                {/* Smooth sliding active indicator pill */}
                <motion.div
                  aria-hidden="true"
                  className="absolute top-1 bottom-1 rounded-xs border border-[var(--border)] shadow-xs pointer-events-none"
                  style={{
                    backgroundColor: "var(--card)",
                    width: "calc(50% - 4px)",
                    left: "4px",
                  }}
                  initial={false}
                  animate={{
                    x: dossierTab === "fleet" ? "0%" : "100%",
                  }}
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />

                <button
                  id="dossier-tab-fleet"
                  type="button"
                  onClick={() => setDossierTab("fleet")}
                  className="relative py-1.5 px-2 text-[10px] font-mono tracking-wider uppercase transition-colors cursor-pointer text-center z-10 select-none"
                  style={{
                    color:
                      dossierTab === "fleet"
                        ? "var(--accent)"
                        : "var(--muted-foreground)",
                    fontWeight: dossierTab === "fleet" ? 600 : 400,
                  }}
                >
                  <span className="relative z-10">[01 LIVE FLEET]</span>
                </button>
                <button
                  id="dossier-tab-benchmarks"
                  type="button"
                  onClick={() => setDossierTab("benchmarks")}
                  className="relative py-1.5 px-2 text-[10px] font-mono tracking-wider uppercase transition-colors cursor-pointer text-center z-10 select-none"
                  style={{
                    color:
                      dossierTab === "benchmarks"
                        ? "var(--accent)"
                        : "var(--muted-foreground)",
                    fontWeight: dossierTab === "benchmarks" ? 600 : 400,
                  }}
                >
                  <span className="relative z-10">[02 BENCHMARKS]</span>
                </button>
              </div>

              {/* Tab Content Container with stable height and smooth fade transition */}
              <div className="min-h-[196px] mb-3 flex flex-col justify-center">
                <AnimatePresence mode="wait" initial={false}>
                  {dossierTab === "fleet" ? (
                    <motion.div
                      key="dossier-fleet"
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -3 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="space-y-2"
                    >
                      {/* Service 1: SearchForge */}
                      <a
                        href="https://e-commerce-product-search-system.vercel.app/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block p-2.5 rounded-sm border border-[var(--border)] bg-[var(--background)] hover:border-[var(--accent)] transition-all"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span className="font-body text-xs font-medium truncate text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                              SearchForge IR Engine
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-[11px] text-[var(--accent)] font-medium">
                              {pingData.searchForge}ms
                            </span>
                            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-xs bg-[var(--card)] border border-[var(--border)] text-emerald-500">
                              200 OK
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[var(--muted-foreground)] mt-1 font-body">
                          <span>BM25 + TF-IDF Hybrid · FastAPI</span>
                          <span className="font-mono text-[9px]">
                            VERCEL EDGE
                          </span>
                        </div>
                      </a>

                      {/* Service 2: NutriScan */}
                      <a
                        href="https://nutriscann.vercel.app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block p-2.5 rounded-sm border border-[var(--border)] bg-[var(--background)] hover:border-[var(--accent)] transition-all"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span className="font-body text-xs font-medium truncate text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                              NutriScan AI Intelligence
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-[11px] text-[var(--accent)] font-medium">
                              &lt;{pingData.nutriScan}ms
                            </span>
                            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-xs bg-[var(--card)] border border-[var(--border)] text-emerald-500">
                              ONLINE
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[var(--muted-foreground)] mt-1 font-body">
                          <span>Next.js 14 · Vision OCR · Edge</span>
                          <span className="font-mono text-[9px]">VERCEL</span>
                        </div>
                      </a>

                      {/* Service 3: AI Drug Safety */}
                      <a
                        href="https://ai-drug-interaction-system.vercel.app/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block p-2.5 rounded-sm border border-[var(--border)] bg-[var(--background)] hover:border-[var(--accent)] transition-all"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span className="font-body text-xs font-medium truncate text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                              Drug Interaction Warning
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-[11px] text-[var(--accent)] font-medium">
                              ~{pingData.drugSafety}ms
                            </span>
                            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-xs bg-[var(--card)] border border-[var(--border)] text-emerald-500">
                              ACTIVE
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[var(--muted-foreground)] mt-1 font-body">
                          <span>Gemini Vision OCR · FastAPI</span>
                          <span className="font-mono text-[9px]">
                            RENDER + VERCEL
                          </span>
                        </div>
                      </a>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="dossier-benchmarks"
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -3 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="grid grid-cols-2 gap-2.5"
                    >
                      <div className="p-3 rounded-sm border border-[var(--border)] bg-[var(--background)]">
                        <span className="font-body text-[10px] tracking-widest uppercase block mb-1 text-[var(--muted-foreground)]">
                          Cranfield IR Eval
                        </span>
                        <span className="font-display font-medium text-lg sm:text-xl block text-[var(--accent)]">
                          0.74 NDCG
                        </span>
                        <span className="font-body text-[10px] block text-[var(--muted-foreground)]">
                          0.90 MRR · 336 Judgements
                        </span>
                      </div>

                      <div className="p-3 rounded-sm border border-[var(--border)] bg-[var(--background)]">
                        <span className="font-body text-[10px] tracking-widest uppercase block mb-1 text-[var(--muted-foreground)]">
                          Ranking Latency
                        </span>
                        <span className="font-display font-medium text-lg sm:text-xl block text-[var(--foreground)]">
                          3.3ms p50
                        </span>
                        <span className="font-body text-[10px] block text-[var(--muted-foreground)]">
                          BM25 Engine (Excl. RTT)
                        </span>
                      </div>

                      <div className="p-3 rounded-sm border border-[var(--border)] bg-[var(--background)]">
                        <span className="font-body text-[10px] tracking-widest uppercase block mb-1 text-[var(--muted-foreground)]">
                          Vision Accuracy
                        </span>
                        <span className="font-display font-medium text-lg sm:text-xl block text-[var(--foreground)]">
                          94.8% Val
                        </span>
                        <span className="font-body text-[10px] block text-[var(--muted-foreground)]">
                          PyTorch Clinical CNN
                        </span>
                      </div>

                      <div className="p-3 rounded-sm border border-[var(--border)] bg-[var(--background)]">
                        <span className="font-body text-[10px] tracking-widest uppercase block mb-1 text-[var(--muted-foreground)]">
                          Production Systems
                        </span>
                        <span className="font-display font-medium text-lg sm:text-xl block text-[var(--accent)]">
                          06 Live
                        </span>
                        <span className="font-body text-[10px] block text-[var(--muted-foreground)]">
                          Vercel Edge &amp; AWS Cloud
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bottom HUD Bar & Ping Trigger */}
              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--muted-foreground)] min-w-0">
                  <span className="text-[var(--accent)]">⚡</span>
                  <span className="truncate">
                    FOCUS: GENAI &amp; IR RANKING
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handlePingFleet}
                  disabled={isPinging}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-medium rounded-sm border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <span
                    className={isPinging ? "inline-block animate-spin" : ""}
                  >
                    ⟳
                  </span>
                  <span>{isPinging ? "PINGING..." : "PING FLEET"}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom CTA & Action Row */}
      <motion.div
        className="max-w-[1440px] mx-auto w-full px-6 sm:px-8 md:px-16 pt-4 pb-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        style={{ borderTop: "1px solid var(--border)" }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : 10 }}
        transition={{
          duration: 0.5,
          ease: [0.22, 1, 0.36, 1],
          delay: shown ? 1.3 : 0,
        }}
      >
        {/* Left Action Buttons */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          {/* Primary CTA: Explore Work */}
          <a
            href="#work"
            onClick={(e) => {
              e.preventDefault()
              document
                .getElementById("work")
                ?.scrollIntoView({ behavior: "smooth" })
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius)] text-xs font-body font-medium tracking-wider uppercase transition-all duration-200"
            style={{
              backgroundColor: "var(--foreground)",
              color: "var(--background)",
            }}
          >
            <span>Explore Work (06)</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3v10M8 13l4-4M8 13L4 9" />
            </svg>
          </a>

          {/* Secondary CTA: Resume PDF */}
          <a
            href="https://drive.google.com/uc?export=download&id=1GFm2sa7MQjxvG_6LFVIOzrOZxZiffKu4"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-xs font-body font-medium tracking-wider uppercase transition-all duration-200 border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M8 2v8M8 10l-3-3M8 10l3-3M3 13h10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Download Résumé</span>
          </a>

          {/* Tertiary CTA: Book Call */}
          <a
            href="https://cal.com/furkan-farooqui/lets-talk"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-xs font-body font-medium tracking-wider uppercase transition-all duration-200 border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="18" y1="10" y2="10" />
            </svg>
            <span>Let&apos;s Talk</span>
          </a>

          {/* 1-Click Copy Email Button */}
          <button
            type="button"
            onClick={handleCopyEmail}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-[var(--radius)] text-xs font-body tracking-wider transition-all duration-200 border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]"
            style={{
              color: copied ? "var(--accent)" : "var(--muted-foreground)",
            }}
            title="Click to copy email address"
          >
            {copied ? (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="font-medium text-[var(--accent)]">
                  Copied to Clipboard!
                </span>
              </>
            ) : (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
                <span className="hidden xl:inline">
                  furkanahmedfarooqui19@gmail.com
                </span>
                <span className="xl:hidden">Copy Email</span>
              </>
            )}
          </button>
        </div>

        {/* Right Scroll Indicator */}
        <div
          className="flex items-center gap-4 text-xs font-body"
          style={{ color: "var(--muted-foreground)" }}
        >
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("work")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className="flex items-center gap-2 tracking-widest uppercase transition-colors hover:text-[var(--accent)] group"
          >
            <span>Scroll to explore</span>
            <motion.span
              animate={{ y: [0, 4, 0] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="group-hover:text-[var(--accent)]"
            >
              ↓
            </motion.span>
          </button>
        </div>
      </motion.div>

      {/* Decorative vertical hairline */}
      <motion.div
        className="absolute right-12 top-1/2 -translate-y-1/2 hidden 2xl:block"
        style={{ width: "1px", background: "var(--border)", originY: 0 }}
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: shown ? "24vh" : 0, opacity: shown ? 1 : 0 }}
        transition={{
          duration: 0.9,
          ease: [0.22, 1, 0.36, 1],
          delay: shown ? 1.4 : 0,
        }}
      />
    </section>
  )
}

// ─── Selected Work ────────────────────────────────────────────────────────────

// Flagship Featured Project Card
function FeaturedProjectCard({
  project,
  onOpenDetails,
}: {
  project: ProjectItem
  onOpenDetails: (p: ProjectItem) => void
}) {
  const displayUrl = project.href.replace(/^https?:\/\//, "").replace(/\/$/, "")
  const imageFrameRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: imageFrameRef,
    offset: ["start end", "end start"],
  })
  const imageY = useTransform(scrollYProgress, [0, 1], [-22, 22])

  return (
    <motion.div
      className="project-card p-6 sm:p-8 lg:p-10 mb-8 overflow-hidden group"
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Top HUD Meta bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-[var(--border)] mb-8">
        <div className="flex items-center gap-3">
          <span
            className="font-display font-medium text-xs tracking-wider"
            style={{
              color: "var(--accent)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {project.id} // FLAGSHIP DEPLOYMENT
          </span>
          {project.isLive && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-body tracking-wider uppercase rounded-full"
              style={{
                backgroundColor: "rgba(34, 197, 94, 0.1)",
                color: "#16a34a",
                border: "1px solid rgba(34, 197, 94, 0.25)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Production Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span
            className="font-body text-xs tracking-widest uppercase"
            style={{ color: "var(--muted-foreground)" }}
          >
            {project.year} · {project.metric.split(" · ")[0] || "Live"}
          </span>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: Narrative & Technical Specs */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div>
            <span
              className="font-body text-xs tracking-widest uppercase block mb-2"
              style={{ color: "var(--accent)" }}
            >
              {project.category}
            </span>

            <h3
              className="font-display font-medium text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-2 project-title"
              style={{ color: "var(--foreground)" }}
            >
              {project.title}
            </h3>

            <p
              className="font-body text-sm sm:text-base font-medium mb-4"
              style={{ color: "var(--foreground)" }}
            >
              {project.subtitle}
            </p>

            <p
              className="font-body text-xs sm:text-sm leading-relaxed mb-6"
              style={{ color: "var(--muted-foreground)" }}
            >
              {project.description}
            </p>

            {/* Architecture Highlights Bullets */}
            <div
              className="space-y-2 mb-6 border-l-2 pl-4"
              style={{ borderColor: "var(--accent)" }}
            >
              {project.highlights.slice(0, 3).map((hl, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span
                    style={{
                      color: "var(--accent)",
                      fontSize: "13px",
                      lineHeight: "1.4",
                    }}
                  >
                    →
                  </span>
                  <span
                    className="font-body text-xs leading-relaxed"
                    style={{ color: "var(--foreground)" }}
                  >
                    {hl}
                  </span>
                </div>
              ))}
            </div>

            {/* 4-Box Telemetry Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
              {project.stats.map((st, i) => (
                <div key={i} className="project-stat-box">
                  <span
                    className="font-body block text-[10px] uppercase tracking-wider mb-0.5"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {st.label}
                  </span>
                  <span
                    className="font-display font-medium block text-xs"
                    style={{ color: "var(--foreground)" }}
                  >
                    {st.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Benchmark Setup Callout */}
            {project.benchmarkSetup && (
              <div
                className="mb-6 p-3 rounded-xs border flex items-start gap-2.5"
                style={{
                  backgroundColor: "var(--card)",
                  borderColor: "rgba(196, 137, 90, 0.25)",
                }}
              >
                <span className="text-[var(--accent)] font-mono text-xs shrink-0 mt-0.5">⏱</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-[var(--accent)]">
                      Benchmark Setup
                    </span>
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-xs border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)]">
                      RANKING ALONE · EXCLUDES NETWORK RTT
                    </span>
                  </div>
                  <p className="font-body text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                    {project.benchmarkSetup}
                  </p>
                </div>
              </div>
            )}

            {/* Tech Stack Chips */}
            <div className="flex flex-wrap gap-1.5 mb-8">
              {project.tags.map((tag) => (
                <span key={tag} className="project-tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-[var(--border)]">
            <a
              href={project.href}
              target="_blank"
              rel="noopener noreferrer"
              className="cta-arrow font-body text-xs font-medium px-5 py-2.5 transition-colors duration-200 flex items-center gap-2"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--accent-foreground)",
                borderRadius: "var(--radius)",
              }}
            >
              <span>Launch Live App</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 8H13M13 8L9 4M13 8L9 12"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>

            <button
              type="button"
              onClick={() => onOpenDetails(project)}
              className="font-body text-xs font-medium px-4 py-2.5 transition-colors duration-200 flex items-center gap-2"
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                color: "var(--foreground)",
                backgroundColor: "var(--background)",
              }}
            >
              <span>Architecture Deep-Dive</span>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>

        {/* Right Column: Architectural Browser Window Mockup */}
        <div className="lg:col-span-5">
          <div
            className="overflow-hidden shadow-lg transition-transform duration-500 group-hover:translate-y-[-2px]"
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              backgroundColor: "var(--background)",
            }}
          >
            {/* Window Chrome Header */}
            <div className="project-window-bar">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: "rgba(239, 68, 68, 0.7)" }}
                />
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: "rgba(245, 158, 11, 0.7)" }}
                />
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: "rgba(34, 197, 94, 0.7)" }}
                />
              </div>
              <div
                className="px-3 py-0.5 rounded text-[10px] font-mono truncate max-w-[200px]"
                style={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                }}
              >
                {displayUrl}
              </div>
              <a
                href={project.href}
                target="_blank"
                rel="noopener noreferrer"
                title="Open live link"
                className="hover:opacity-75 transition-opacity"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>

            {/* Screenshot Frame with Interactive Hover Zoom & Parallax */}
            <div
              ref={imageFrameRef}
              className="relative aspect-[16/10] overflow-hidden bg-[var(--card)] cursor-pointer"
              onClick={() => onOpenDetails(project)}
            >
              <motion.div
                style={{ y: imageY }}
                className="w-full h-full will-change-transform"
              >
                <img
                  src={project.image}
                  alt={`${project.title} live interface preview`}
                  className="w-full h-full object-cover object-top scale-105 transition-transform duration-700 ease-out group-hover:scale-110"
                  loading="lazy"
                  decoding="async"
                  width={800}
                  height={500}
                />
              </motion.div>

              {/* HUD Telemetry Overlay on Hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4 pointer-events-none">
                <div className="flex items-center justify-between w-full text-white text-[11px] font-body">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    {project.metric}
                  </span>
                  <span className="text-white/80">Click to Explore</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Secondary Project Card for Grid View
function ProjectGridCard({
  project,
  index,
  onOpenDetails,
}: {
  project: ProjectItem
  index: number
  onOpenDetails: (p: ProjectItem) => void
}) {
  const imageFrameRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: imageFrameRef,
    offset: ["start end", "end start"],
  })
  const imageY = useTransform(scrollYProgress, [0, 1], [-16, 16])

  return (
    <motion.article
      className="project-card flex flex-col justify-between overflow-hidden group"
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.65,
        ease: [0.22, 1, 0.36, 1],
        delay: index * 0.08,
      }}
    >
      <div>
        {/* Card Window Bar */}
        <div className="project-window-bar">
          <div className="flex items-center gap-2">
            <span
              className="font-display font-medium text-xs"
              style={{
                color: "var(--accent)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {project.id}
            </span>
            <div className="flex items-center gap-1 ml-1 opacity-70">
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
            </div>
          </div>
          <span
            className="font-body text-[10px] tracking-wider uppercase"
            style={{ color: "var(--muted-foreground)" }}
          >
            {project.year}
          </span>
        </div>

        {/* Preview Screenshot Frame with Parallax */}
        <div
          ref={imageFrameRef}
          className="relative aspect-[16/10] overflow-hidden bg-[var(--background)] cursor-pointer"
          onClick={() => onOpenDetails(project)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onOpenDetails(project)
            }
          }}
          aria-label={`View ${project.title} details`}
        >
          <motion.div
            style={{ y: imageY }}
            className="w-full h-full will-change-transform"
          >
            <img
              src={project.image}
              alt={`${project.title} preview`}
              className="w-full h-full object-cover object-top scale-105 transition-transform duration-600 ease-out group-hover:scale-110"
              loading="lazy"
              decoding="async"
              width={640}
              height={400}
            />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-3 text-white text-[10px] font-body pointer-events-none">
            <span>View Architecture</span>
            <span>↗</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6">
          <span
            className="font-body text-[10px] tracking-widest uppercase block mb-1.5"
            style={{ color: "var(--accent)" }}
          >
            {project.category}
          </span>

          <h4
            className="font-display font-medium text-2xl tracking-tight mb-1.5 project-title"
            style={{ color: "var(--foreground)" }}
          >
            {project.title}
          </h4>

          <p
            className="font-body text-xs font-medium mb-3"
            style={{ color: "var(--foreground)" }}
          >
            {project.subtitle}
          </p>

          <p
            className="font-body text-xs leading-relaxed mb-4 line-clamp-3"
            style={{ color: "var(--muted-foreground)" }}
          >
            {project.description}
          </p>

          {/* Mini 2-Stat Row */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {project.stats.slice(0, 2).map((st, i) => (
              <div key={i} className="project-stat-box py-1 px-2.5">
                <span
                  className="font-body block text-[9px] uppercase tracking-wider"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {st.label}
                </span>
                <span
                  className="font-display font-medium block text-[11px]"
                  style={{ color: "var(--foreground)" }}
                >
                  {st.value}
                </span>
              </div>
            ))}
          </div>

          {/* Tech tags */}
          <div className="flex flex-wrap gap-1 mb-2">
            {project.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="project-tag text-[10px] py-0.5 px-2">
                {tag}
              </span>
            ))}
            {project.tags.length > 4 && (
              <span
                className="project-tag text-[10px] py-0.5 px-2"
                style={{ color: "var(--accent)" }}
              >
                +{project.tags.length - 4}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card Footer Bar */}
      <div className="p-4 sm:px-6 sm:py-3.5 border-t border-[var(--border)] flex items-center justify-between mt-auto">
        <span
          className="font-body text-[10px] tracking-wide"
          style={{ color: "var(--muted-foreground)" }}
        >
          {project.metric}
        </span>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenDetails(project)}
            className="font-body text-xs hover:underline"
            style={{ color: "var(--muted-foreground)" }}
          >
            Specs
          </button>
          <a
            href={project.href}
            target="_blank"
            rel="noopener noreferrer"
            className="cta-arrow font-body text-xs font-medium"
            style={{ color: "var(--foreground)" }}
          >
            <span>{project.isLive ? "Visit" : "Repo"}</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 8H13M13 8L9 4M13 8L9 12"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>
      </div>
    </motion.article>
  )
}

// Table / Archive Row
function ProjectTableRow({
  project,
  index,
  onOpenDetails,
}: {
  project: ProjectItem
  index: number
  onOpenDetails: (p: ProjectItem) => void
}) {
  return (
    <motion.div
      className="list-row py-5 px-4 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-6 items-center cursor-pointer border-t border-[var(--border)]"
      initial={{ opacity: 0, x: -16 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
        delay: index * 0.05,
      }}
      onClick={() => onOpenDetails(project)}
    >
      {/* Index & Year */}
      <div className="md:col-span-2 flex items-baseline gap-3">
        <span
          className="font-display font-medium text-xs"
          style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}
        >
          {project.id}
        </span>
        <span
          className="font-body text-xs"
          style={{ color: "var(--muted-foreground)" }}
        >
          {project.year}
        </span>
      </div>

      {/* Title & Subtitle */}
      <div className="md:col-span-4">
        <h4
          className="font-display font-medium text-lg leading-tight project-title"
          style={{ color: "var(--foreground)" }}
        >
          {project.title}
        </h4>
        <p
          className="font-body text-xs mt-0.5 line-clamp-1"
          style={{ color: "var(--muted-foreground)" }}
        >
          {project.subtitle}
        </p>
      </div>

      {/* Domain / Category */}
      <div className="md:col-span-2">
        <span
          className="font-body text-[11px] tracking-wide"
          style={{ color: "var(--accent)" }}
        >
          {project.category}
        </span>
      </div>

      {/* Tech Tags */}
      <div className="md:col-span-2 hidden md:flex flex-wrap gap-1">
        {project.tags.slice(0, 2).map((t) => (
          <span key={t} className="project-tag text-[10px] py-0.5 px-2">
            {t}
          </span>
        ))}
      </div>

      {/* Action CTA */}
      <div className="md:col-span-2 flex items-center justify-between md:justify-end gap-3">
        <span
          className="font-body text-[10px] md:hidden"
          style={{ color: "var(--muted-foreground)" }}
        >
          {project.metric}
        </span>
        <a
          href={project.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="cta-arrow font-body text-xs font-medium"
          style={{ color: "var(--foreground)" }}
        >
          <span>{project.isLive ? "Launch" : "Source"}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M3 8H13M13 8L9 4M13 8L9 12"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>
    </motion.div>
  )
}

// Deep-Dive Project Modal
function ProjectDetailModal({
  project,
  onClose,
}: {
  project: ProjectItem
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <motion.div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 sm:p-6 md:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto project-card p-6 sm:p-8 md:p-10 shadow-2xl relative"
        initial={{ scale: 0.96, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 20 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "var(--background)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-project-title"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded hover:opacity-75 transition-opacity"
          style={{
            border: "1px solid var(--border)",
            backgroundColor: "var(--card)",
          }}
          aria-label="Close project modal"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header */}
        <div className="mb-6 pr-10">
          <div className="flex items-center gap-3 mb-2">
            <span
              className="font-display text-xs"
              style={{
                color: "var(--accent)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              PROJECT {project.id} // {project.year}
            </span>
            <span className="text-xs" style={{ color: "var(--border)" }}>
              •
            </span>
            <span
              className="font-body text-xs tracking-wider uppercase"
              style={{ color: "var(--muted-foreground)" }}
            >
              {project.category}
            </span>
          </div>
          <h2
            id="modal-project-title"
            className="font-display font-medium text-3xl sm:text-4xl tracking-tight mb-1"
            style={{ color: "var(--foreground)" }}
          >
            {project.title}
          </h2>
          <p
            className="font-body text-sm font-medium"
            style={{ color: "var(--accent)" }}
          >
            {project.subtitle}
          </p>
        </div>

        {/* Screenshot Banner */}
        <div
          className="overflow-hidden mb-8 shadow-sm"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            backgroundColor: "var(--card)",
          }}
        >
          <div className="project-window-bar">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>
            <span className="text-[11px] font-mono text-center truncate max-w-xs">
              {project.title} Interface
            </span>
            <span className="text-[10px] uppercase tracking-wider">
              {project.metric}
            </span>
          </div>
          <div className="aspect-[16/9] w-full overflow-hidden bg-[var(--card)]">
            <img
              src={project.image}
              alt={project.title}
              className="w-full h-full object-cover object-top"
              loading="lazy"
              decoding="async"
              width={1200}
              height={675}
            />
          </div>
        </div>

        {/* Visual Architecture / Request Lifecycle Pipeline */}
        {project.workflow && project.workflow.length > 0 && (
          <div
            className="mb-8 p-5 sm:p-6 rounded-[var(--radius)] border shadow-xs"
            style={{
              backgroundColor: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                <span className="font-mono text-[11px] font-semibold tracking-wider uppercase text-[var(--foreground)]">
                  Execution Lifecycle &amp; Pipeline Architecture
                </span>
              </div>
              <span className="font-mono text-[9px] px-2 py-0.5 rounded-xs border border-[var(--border)] bg-[var(--background)] text-[var(--accent)] font-medium">
                END-TO-END DATA FLOW
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-flow-col lg:auto-cols-fr gap-2.5">
              {project.workflow.map((node, i) => (
                <div
                  key={node.step}
                  className="p-3 rounded-sm border border-[var(--border)] bg-[var(--background)] flex flex-col justify-between relative group hover:border-[var(--accent)] transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[9px] font-semibold text-[var(--accent)]">
                      [{node.step}]
                    </span>
                    {i < project.workflow!.length - 1 && (
                      <span className="font-mono text-[10px] text-[var(--muted-foreground)] hidden lg:inline">
                        →
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="font-body text-xs font-semibold block text-[var(--foreground)] truncate">
                      {node.title}
                    </span>
                    <span className="font-mono text-[9px] text-[var(--muted-foreground)] block mt-0.5 truncate">
                      {node.subtitle}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Architecture Breakdown 3-column / 3-card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div
            className="project-card p-5"
            style={{ backgroundColor: "var(--card)" }}
          >
            <span
              className="font-body text-[10px] tracking-widest uppercase block mb-1.5"
              style={{ color: "var(--accent)" }}
            >
              01 / The Challenge
            </span>
            <p
              className="font-body text-xs leading-relaxed"
              style={{ color: "var(--muted-foreground)" }}
            >
              {project.challenge}
            </p>
          </div>

          <div
            className="project-card p-5"
            style={{ backgroundColor: "var(--card)" }}
          >
            <span
              className="font-body text-[10px] tracking-widest uppercase block mb-1.5"
              style={{ color: "var(--accent)" }}
            >
              02 / Architecture &amp; System
            </span>
            <p
              className="font-body text-xs leading-relaxed"
              style={{ color: "var(--muted-foreground)" }}
            >
              {project.architecture}
            </p>
          </div>

          <div
            className="project-card p-5"
            style={{ backgroundColor: "var(--card)" }}
          >
            <span
              className="font-body text-[10px] tracking-widest uppercase block mb-1.5"
              style={{ color: "var(--accent)" }}
            >
              03 / Outcomes &amp; Impact
            </span>
            <p
              className="font-body text-xs leading-relaxed"
              style={{ color: "var(--muted-foreground)" }}
            >
              {project.outcomes}
            </p>
          </div>
        </div>

        {/* Key Engineering Trade-off & Constraints */}
        {project.tradeoff && (
          <div
            className="mb-8 p-4 sm:p-5 rounded-[var(--radius)] border relative overflow-hidden"
            style={{
              backgroundColor: "var(--card)",
              borderColor: "rgba(196, 137, 90, 0.4)",
            }}
          >
            <div className="flex items-start gap-3.5">
              <div
                className="w-8 h-8 rounded-sm flex items-center justify-center shrink-0 text-sm font-mono"
                style={{
                  backgroundColor: "var(--background)",
                  border: "1px solid rgba(196, 137, 90, 0.5)",
                  color: "var(--accent)",
                }}
              >
                ⚖
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="font-mono text-[11px] font-semibold tracking-wider uppercase text-[var(--accent)]">
                    Key Engineering Trade-off &amp; Constraints
                  </span>
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-xs border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)]">
                    ARCHITECTURAL DECISION
                  </span>
                </div>
                <p className="font-body text-xs leading-relaxed text-[var(--foreground)]">
                  {project.tradeoff}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Benchmark Setup & Methodology */}
        {project.benchmarkSetup && (
          <div
            className="mb-8 p-4 sm:p-5 rounded-[var(--radius)] border relative overflow-hidden"
            style={{
              backgroundColor: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex items-start gap-3.5">
              <div
                className="w-8 h-8 rounded-sm flex items-center justify-center shrink-0 text-sm font-mono"
                style={{
                  backgroundColor: "var(--background)",
                  border: "1px solid var(--border)",
                  color: "var(--accent)",
                }}
              >
                ⏱
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="font-mono text-[11px] font-semibold tracking-wider uppercase text-[var(--accent)]">
                    Benchmark Setup &amp; Methodology
                  </span>
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-xs border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)]">
                    RANKING ALONE · EXCLUDES NETWORK RTT
                  </span>
                </div>
                <p className="font-body text-xs leading-relaxed text-[var(--foreground)]">
                  {project.benchmarkSetup}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Key Technical Highlights */}
        <div
          className="mb-8 p-6 rounded"
          style={{
            border: "1px solid var(--border)",
            backgroundColor: "var(--card)",
          }}
        >
          <h4
            className="font-display font-medium text-base mb-3"
            style={{ color: "var(--foreground)" }}
          >
            Engineering Highlights &amp; Capabilities
          </h4>
          <ul className="space-y-2">
            {project.highlights.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 font-body text-xs leading-relaxed"
                style={{ color: "var(--foreground)" }}
              >
                <span style={{ color: "var(--accent)" }}>✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Tech Stack Pills */}
        <div className="mb-8">
          <span
            className="font-body text-xs tracking-wider uppercase block mb-2.5"
            style={{ color: "var(--muted-foreground)" }}
          >
            Technologies &amp; Libraries
          </span>
          <div className="flex flex-wrap gap-1.5">
            {project.tags.map((t) => (
              <span key={t} className="project-tag py-1 px-3 text-xs">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-[var(--border)]">
          <div className="flex items-center gap-3">
            {project.isLive && (
              <a
                href={project.href}
                target="_blank"
                rel="noopener noreferrer"
                className="cta-arrow font-body text-xs font-medium px-4 py-2 transition-colors"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--accent-foreground)",
                  borderRadius: "var(--radius)",
                }}
              >
                <span>Launch Live Application</span>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 8H13M13 8L9 4M13 8L9 12"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            )}

            {project.github && (
              <a
                href={project.github}
                target="_blank"
                rel="noopener noreferrer"
                className="font-body text-xs font-medium px-4 py-2 transition-colors flex items-center gap-2"
                style={{
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--card)",
                  color: "var(--foreground)",
                  borderRadius: "var(--radius)",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span>GitHub Repository</span>
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="font-body text-xs px-3 py-1.5 text-muted hover:underline"
            style={{ color: "var(--muted-foreground)" }}
          >
            Close (Esc)
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Command Palette (⌘K) ─────────────────────────────────────────────────────

function CommandPalette({
  isOpen,
  onClose,
  theme,
  toggleTheme,
}: {
  isOpen: boolean
  onClose: () => void
  theme: "light" | "dark"
  toggleTheme: () => void
}) {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    setQuery("")
    setSelectedIndex(0)
    setCopied(false)
    document.body.style.overflow = "hidden"
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => {
      clearTimeout(timer)
      document.body.style.overflow = ""
    }
  }, [])

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("furkanahmedfarooqui19@gmail.com")
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
      onClose()
    }, 900)
  }

  const navigateTo = (id: string) => {
    onClose()
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
    }, 120)
  }

  const scrollToTop = () => {
    onClose()
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }, 120)
  }

  const openUrl = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer")
    onClose()
  }

  const allCommands = [
    // Navigation
    {
      id: "nav-work",
      category: "Navigation",
      title: "01 / Work & Engineering Systems",
      subtitle: "Browse 6 systems, Cranfield IR benchmark & clinical AI",
      shortcut: "G W",
      icon: (
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      ),
      perform: () => navigateTo("work"),
    },
    {
      id: "nav-about",
      category: "Navigation",
      title: "02 / About & Architectural Principles",
      subtitle: "Engineering manifesto, low-latency goals & background",
      shortcut: "G A",
      icon: (
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      perform: () => navigateTo("about"),
    },
    {
      id: "nav-skills",
      category: "Navigation",
      title: "03 / Technical Stack & Capabilities",
      subtitle: "Searchable matrix: Python, FastAPI, BM25, React, PyTorch",
      shortcut: "G S",
      icon: (
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      ),
      perform: () => navigateTo("skills"),
    },
    {
      id: "nav-exp",
      category: "Navigation",
      title: "04 / Industry Track Record & Roles",
      subtitle:
        "Work history: AI Developer Intern @ CodersCave & systems projects",
      shortcut: "G E",
      icon: (
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
      perform: () => navigateTo("exp"),
    },
    {
      id: "nav-certs",
      category: "Navigation",
      title: "05 / Accredited Qualifications",
      subtitle: "Verified credentials, specializations & verified coursework",
      shortcut: "G C",
      icon: (
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="8" r="7" />
          <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
        </svg>
      ),
      perform: () => navigateTo("certs"),
    },
    {
      id: "nav-contact",
      category: "Navigation",
      title: "06 / Direct Contact & Inquiries",
      subtitle: "Primary email, location (Mumbai, IN), response SLA < 24h",
      shortcut: "G D",
      icon: (
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      ),
      perform: () => navigateTo("contact"),
    },

    // Actions
    {
      id: "act-download-cv",
      category: "Actions",
      title: "Download Official Résumé (PDF)",
      subtitle: "Verified Software Engineer & AI Developer CV (Drive download)",
      shortcut: "CV ↗",
      icon: (
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      ),
      perform: () => {
        window.open(
          "https://drive.google.com/uc?export=download&id=1GFm2sa7MQjxvG_6LFVIOzrOZxZiffKu4",
          "_blank",
        )
        onClose()
      },
    },
    {
      id: "act-copy-email",
      category: "Actions",
      title: copied ? "Copied to Clipboard!" : "Copy Direct Email Address",
      subtitle: copied
        ? "Ready to paste in your email client"
        : "furkanahmedfarooqui19@gmail.com",
      shortcut: "Copy",
      icon: (
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      ),
      perform: handleCopyEmail,
    },
    {
      id: "act-theme",
      category: "Actions",
      title: `Toggle Theme (${
        theme === "light" ? "Switch to Dark" : "Switch to Light"
      })`,
      subtitle: `Currently active: ${theme.toUpperCase()} MODE`,
      shortcut: "Theme",
      icon:
        theme === "light" ? (
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        ) : (
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        ),
      perform: () => {
        toggleTheme()
        onClose()
      },
    },
    {
      id: "act-scroll-top",
      category: "Actions",
      title: "Scroll to Top (Hero & Live Telemetry)",
      subtitle: "Return to top status bar & live ping dossier",
      shortcut: "Top",
      icon: (
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
      ),
      perform: scrollToTop,
    },

    // Projects (Direct Launch)
    {
      id: "proj-searchforge",
      category: "Projects",
      title: "SearchForge IR Engine (Live Demo)",
      subtitle: "3.3ms p50 Ranking · BM25 + TF-IDF Hybrid · Vercel Edge",
      shortcut: "↗ Launch",
      icon: <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />,
      perform: () =>
        openUrl("https://e-commerce-product-search-system.vercel.app/"),
    },
    {
      id: "proj-drugsafety",
      category: "Projects",
      title: "AI Drug Interaction Warning System (Live Demo)",
      subtitle: "Gemini Vision OCR · Clinical Pharmacology Matrix · FastAPI",
      shortcut: "↗ Launch",
      icon: <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />,
      perform: () => openUrl("https://ai-drug-interaction-system.vercel.app/"),
    },
    {
      id: "proj-nutriscan",
      category: "Projects",
      title: "NutriScan AI Dietary Intelligence (Live Demo)",
      subtitle: "Next.js 14 App Router · Edge OCR · Allergen Safety",
      shortcut: "↗ Launch",
      icon: <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />,
      perform: () => openUrl("https://nutriscann.vercel.app"),
    },

    // Social Profiles
    {
      id: "soc-github",
      category: "Social",
      title: "GitHub Profile (@FurkanFarooqui19)",
      subtitle: "29+ repositories, IR algorithms & full-stack code",
      shortcut: "↗ GitHub",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
      ),
      perform: () => openUrl("https://github.com/FurkanFarooqui19"),
    },
    {
      id: "soc-linkedin",
      category: "Social",
      title: "LinkedIn Network (Furkan Farooqui)",
      subtitle: "Professional history, verified endorsements & connections",
      shortcut: "↗ Profile",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
        </svg>
      ),
      perform: () => openUrl("https://linkedin.com/in/furkan-farooqui"),
    },
    {
      id: "soc-x",
      category: "Social",
      title: "X / Twitter (@furkanfarooqui_)",
      subtitle: "Technical dispatches, IR insights & systems discussions",
      shortcut: "↗ Follow",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      perform: () => openUrl("https://x.com/furkanfarooqui_"),
    },
  ]

  const filteredCommands = allCommands.filter((cmd) => {
    const q = query.toLowerCase().trim()
    if (!q) return true
    return (
      cmd.title.toLowerCase().includes(q) ||
      cmd.subtitle.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q)
    )
  })

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) =>
          filteredCommands.length > 0
            ? (prev + 1) % filteredCommands.length
            : 0,
        )
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) =>
          filteredCommands.length > 0
            ? (prev - 1 + filteredCommands.length) % filteredCommands.length
            : 0,
        )
      } else if (e.key === "Enter") {
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].perform()
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, filteredCommands, selectedIndex, onClose])

  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" })
    }
  }, [selectedIndex])

  const categories = ["Navigation", "Actions", "Projects", "Social"] as const

  return (
    <motion.div
      className="fixed inset-0 z-[9990] flex items-start justify-center pt-[10vh] sm:pt-[14vh] p-4 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-2xl rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] shadow-2xl overflow-hidden flex flex-col max-h-[74vh]"
        initial={{ scale: 0.97, opacity: 0, y: -10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0, y: -10 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--card)]">
          <svg
            className="w-4 h-4 text-[var(--accent)] shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, jump to section, or launch project..."
            className="w-full bg-transparent font-body text-xs sm:text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none"
            aria-label="Search commands"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("")
                inputRef.current?.focus()
              }}
              className="text-[10px] font-mono uppercase px-2 py-1 rounded-sm border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors cursor-pointer shrink-0"
              title="Clear search input"
            >
              Clear
            </button>
          )}
          {/* Close Clickable Button */}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--card)] transition-all cursor-pointer shrink-0 group"
            aria-label="Close command palette"
            title="Close command palette (Esc)"
          >
            <span className="font-mono text-[10px] uppercase tracking-wider hidden sm:inline font-medium">
              Close
            </span>
            <kbd className="font-mono text-[9px] px-1 py-0.2 rounded-xs border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] group-hover:text-[var(--accent)] group-hover:border-[var(--accent)] transition-colors">
              ESC
            </kbd>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 transition-transform group-hover:rotate-90 duration-200"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 divide-y divide-transparent">
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-xs font-body text-[var(--muted-foreground)]">
              <span className="font-mono text-base block mb-1 text-[var(--accent)]">
                ∅
              </span>
              No matching commands or actions found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            categories.map((cat) => {
              const itemsInCat = filteredCommands.filter(
                (c) => c.category === cat,
              )
              if (itemsInCat.length === 0) return null

              return (
                <div key={cat} className="mb-2 last:mb-0">
                  <div className="px-3 pt-2 pb-1 font-mono text-[9px] tracking-widest uppercase font-semibold text-[var(--muted-foreground)]">
                    {cat}
                  </div>
                  <div className="space-y-0.5">
                    {itemsInCat.map((cmd) => {
                      const flatIndex = filteredCommands.findIndex(
                        (c) => c.id === cmd.id,
                      )
                      const isSelected = selectedIndex === flatIndex

                      return (
                        <button
                          key={cmd.id}
                          ref={(el) => {
                            itemRefs.current[flatIndex] = el
                          }}
                          type="button"
                          onClick={() => cmd.perform()}
                          onMouseEnter={() => setSelectedIndex(flatIndex)}
                          className={`w-full text-left px-3 py-2 rounded-sm transition-all flex items-center justify-between gap-3 cursor-pointer ${
                            isSelected
                              ? "bg-[var(--card)] border border-[var(--accent)]/40 shadow-xs"
                              : "border border-transparent hover:bg-[var(--card)]/60"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-6 h-6 rounded-xs flex items-center justify-center shrink-0 transition-colors ${
                                isSelected
                                  ? "bg-[var(--background)] text-[var(--accent)] border border-[var(--accent)]/40"
                                  : "text-[var(--muted-foreground)]"
                              }`}
                            >
                              {cmd.icon}
                            </div>
                            <div className="min-w-0">
                              <span
                                className={`font-body text-xs font-medium block truncate ${
                                  isSelected
                                    ? "text-[var(--accent)]"
                                    : "text-[var(--foreground)]"
                                }`}
                              >
                                {cmd.title}
                              </span>
                              <span className="font-mono text-[10px] text-[var(--muted-foreground)] block truncate">
                                {cmd.subtitle}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {cmd.shortcut && (
                              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-xs border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)]">
                                {cmd.shortcut}
                              </span>
                            )}
                            {isSelected && (
                              <kbd className="font-mono text-[9px] px-1.5 py-0.5 rounded-xs bg-[var(--accent)] text-[var(--accent-foreground)] font-semibold">
                                ↵
                              </kbd>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="border-t border-[var(--border)] bg-[var(--card)] px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-[var(--muted-foreground)]">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.2 rounded-xs border border-[var(--border)] bg-[var(--background)]">
                ↑↓
              </kbd>{" "}
              Navigate
            </span>
            <span>
              <kbd className="px-1 py-0.2 rounded-xs border border-[var(--border)] bg-[var(--background)]">
                ↵
              </kbd>{" "}
              Select
            </span>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 hover:text-[var(--foreground)] transition-colors cursor-pointer"
              title="Dismiss command palette"
            >
              <kbd className="px-1 py-0.2 rounded-xs border border-[var(--border)] bg-[var(--background)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
                esc
              </kbd>{" "}
              Dismiss
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-[var(--accent)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>COMMAND PALETTE READY</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main Work Section ────────────────────────────────────────────────────────
function Work() {
  const [activeFilter, setActiveFilter] = useState<"all" | "ai" | "fullstack">(
    "all",
  )
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid")
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(
    null,
  )

  const filterTabs = [
    { id: "all", label: "All Works", count: projects.length },
    {
      id: "ai",
      label: "AI & Machine Learning",
      count: projects.filter(
        (p) =>
          p.filterTag === "ai" ||
          p.category.includes("AI") ||
          p.category.includes("Machine Learning"),
      ).length,
    },
    {
      id: "fullstack",
      label: "Full-Stack & Cloud",
      count: projects.filter(
        (p) =>
          p.filterTag === "fullstack" ||
          p.category.includes("Full-Stack") ||
          p.category.includes("Information Retrieval"),
      ).length,
    },
  ] as const

  const filteredProjects = projects.filter((p) => {
    if (activeFilter === "all") return true
    if (activeFilter === "ai") {
      return (
        p.filterTag === "ai" ||
        p.category.includes("AI") ||
        p.category.includes("Machine Learning")
      )
    }
    if (activeFilter === "fullstack") {
      return (
        p.filterTag === "fullstack" ||
        p.category.includes("Full-Stack") ||
        p.category.includes("Information Retrieval")
      )
    }
    return true
  })

  // When in grid view, NutriScan (if in current filter) is rendered as the flagship showcase
  const isFlagshipVisible = filteredProjects.some((p) => p.id === "01")
  const flagshipProject = projects[0]
  const secondaryProjects = filteredProjects.filter((p) => p.id !== "01")

  return (
    <section
      id="work"
      className="py-28 md:py-36"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="max-w-[1440px] mx-auto px-8 md:px-16">
        {/* Section Header */}
        <FadeUp className="pb-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="accent-dot" />
            <span
              className="font-body text-xs tracking-widest uppercase"
              style={{ color: "var(--muted-foreground)" }}
            >
              01 // Selected Engineering Works
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h2
                className="font-display font-medium text-4xl sm:text-5xl md:text-6xl tracking-tight"
                style={{ color: "var(--foreground)" }}
              >
                Featured Projects &amp; Systems
              </h2>
              <p
                className="font-body text-xs sm:text-sm mt-3 leading-relaxed max-w-2xl"
                style={{ color: "var(--muted-foreground)" }}
              >
                Applied machine learning architectures, cloud pipelines, and
                production full-stack systems designed with rigorous engineering
                principles.
              </p>
            </div>

            <span
              className="font-body text-xs tracking-wider uppercase font-medium self-start md:self-end"
              style={{ color: "var(--accent)" }}
            >
              2025 – 2026 Systems Archive
            </span>
          </div>
        </FadeUp>

        {/* Controls Bar: Filter Tabs & View Mode Switcher */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-8 border-b border-[var(--border)] mb-10">
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {filterTabs.map((tab) => {
              const active = activeFilter === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  className="relative px-3 sm:px-4 py-1.5 text-xs font-body tracking-wider transition-colors duration-200"
                  style={{
                    color: active
                      ? "var(--background)"
                      : "var(--muted-foreground)",
                    borderRadius: "var(--radius)",
                  }}
                >
                  {active && (
                    <motion.div
                      layoutId="activeProjectFilter"
                      className="absolute inset-0"
                      style={{
                        backgroundColor: "var(--foreground)",
                        borderRadius: "var(--radius)",
                      }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {tab.label}
                    <span
                      className="text-[10px] px-1.5 py-0.2 rounded"
                      style={{
                        backgroundColor: active
                          ? "var(--accent)"
                          : "var(--card)",
                        color: active
                          ? "var(--accent-foreground)"
                          : "var(--muted-foreground)",
                      }}
                    >
                      {tab.count}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          {/* View Mode Toggle: Grid vs Table */}
          <div
            className="flex items-center p-1"
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              backgroundColor: "var(--card)",
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-body tracking-wider uppercase transition-colors"
              style={{
                backgroundColor:
                  viewMode === "grid" ? "var(--background)" : "transparent",
                color:
                  viewMode === "grid"
                    ? "var(--foreground)"
                    : "var(--muted-foreground)",
                borderRadius: "var(--radius-sm)",
                boxShadow:
                  viewMode === "grid" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              }}
              title="Architectural Grid View"
              aria-label="Architectural Grid View"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect width="7" height="7" x="3" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="14" rx="1" />
                <rect width="7" height="7" x="3" y="14" rx="1" />
              </svg>
              <span>Grid</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("table")}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-body tracking-wider uppercase transition-colors"
              style={{
                backgroundColor:
                  viewMode === "table" ? "var(--background)" : "transparent",
                color:
                  viewMode === "table"
                    ? "var(--foreground)"
                    : "var(--muted-foreground)",
                borderRadius: "var(--radius-sm)",
                boxShadow:
                  viewMode === "table" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              }}
              title="Swiss Table Archive View"
              aria-label="Swiss Table Archive View"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              <span>Table</span>
            </button>
          </div>
        </div>

        {/* View Content Rendering */}
        <AnimatePresence mode="wait">
          {viewMode === "grid" ? (
            <motion.div
              key="grid-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
            >
              {/* Flagship Hero Card (if included in active filter) */}
              {isFlagshipVisible && (
                <FeaturedProjectCard
                  project={flagshipProject}
                  onOpenDetails={(p) => setSelectedProject(p)}
                />
              )}

              {/* Secondary Projects Grid */}
              {secondaryProjects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {secondaryProjects.map((project, idx) => (
                    <ProjectGridCard
                      key={project.id}
                      project={project}
                      index={idx}
                      onOpenDetails={(p) => setSelectedProject(p)}
                    />
                  ))}
                </div>
              ) : !isFlagshipVisible ? (
                <div className="py-16 text-center">
                  <p
                    className="font-body text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    No projects found for the selected category filter.
                  </p>
                </div>
              ) : null}
            </motion.div>
          ) : (
            /* Table / Archive View */
            <motion.div
              key="table-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="border border-[var(--border)] rounded overflow-hidden"
              style={{ backgroundColor: "var(--card)" }}
            >
              {/* Table Header */}
              <div
                className="py-3 px-4 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-6 font-body text-[11px] uppercase tracking-wider font-medium"
                style={{
                  backgroundColor: "var(--background)",
                  color: "var(--muted-foreground)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div className="md:col-span-2">Index / Year</div>
                <div className="md:col-span-4">Project &amp; Subtitle</div>
                <div className="md:col-span-2">Domain</div>
                <div className="md:col-span-2 hidden md:block">Stack</div>
                <div className="md:col-span-2 text-right hidden md:block">
                  Actions
                </div>
              </div>

              {/* Table Rows */}
              {filteredProjects.map((project, idx) => (
                <ProjectTableRow
                  key={project.id}
                  project={project}
                  index={idx}
                  onOpenDetails={(p) => setSelectedProject(p)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Closing Rule */}
        <div
          className="mt-12"
          style={{ height: 1, background: "var(--border)" }}
        />
      </div>

      {/* Deep-Dive Project Modal */}
      <AnimatePresence>
        {selectedProject && (
          <ProjectDetailModal
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
          />
        )}
      </AnimatePresence>
    </section>
  )
}

// ─── About ────────────────────────────────────────────────────────────────────

function ScrollyParagraph({
  children,
  phase,
  index,
}: {
  children: React.ReactNode
  phase: string
  index: number
}) {
  const pRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: pRef,
    offset: ["start 88%", "start 48%"],
  })

  const opacity = useTransform(scrollYProgress, [0, 0.85], [0.26, 1])
  const y = useTransform(scrollYProgress, [0, 1], [10, 0])
  const filter = useTransform(
    scrollYProgress,
    [0, 0.85],
    ["blur(1.2px)", "blur(0px)"],
  )

  return (
    <motion.div
      ref={pRef}
      style={{ opacity, y, filter }}
      className="space-y-1.5 transition-colors duration-200"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--accent)] font-medium">
          {phase}
        </span>
        <span className="text-[var(--border)]">·</span>
        <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
          0{index}
        </span>
      </div>
      <div className="font-body text-sm sm:text-base leading-relaxed text-[var(--foreground)]">
        {children}
      </div>
    </motion.div>
  )
}

function AboutNarrative({
  metrics,
}: {
  metrics: { value: string; label: string; sub: string }[]
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 75%", "end 55%"],
  })

  const railScaleY = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <div ref={containerRef} className="relative pl-6 sm:pl-8 space-y-8">
      {/* Editorial Reading Guide Rail */}
      <div
        className="absolute left-0 top-1 bottom-24 w-[2px] bg-[var(--border)] rounded-full pointer-events-none"
        aria-hidden="true"
      >
        <motion.div
          className="absolute top-0 left-0 right-0 origin-top rounded-full"
          style={{
            scaleY: railScaleY,
            height: "100%",
            background:
              "linear-gradient(to bottom, var(--accent) 0%, var(--accent) 100%)",
            boxShadow: "0 0 10px rgba(196, 137, 90, 0.5)",
          }}
        />
      </div>

      {/* Narrative Phase 01 */}
      <ScrollyParagraph phase="ACADEMIC FOUNDATIONS" index={1}>
        <p className="text-[var(--muted-foreground)]">
          I&apos;m a Mumbai-based software engineer and undergraduate
          pursuing a{" "}
          <strong className="text-[var(--foreground)] font-semibold">
            B.E. in Computer Engineering (2023–2027)
          </strong>{" "}
          at Mumbai University. My technical journey is shaped by a deep
          curiosity for how large-scale software systems operate under the
          hood.
        </p>
      </ScrollyParagraph>

      {/* Narrative Phase 02 */}
      <ScrollyParagraph phase="FIRST-PRINCIPLES AI & SYSTEMS" index={2}>
        <p className="text-[var(--muted-foreground)]">
          Rather than treating modern AI as a superficial abstraction or
          relying on trivial API wrappers, I build from foundational
          principles: implementing custom{" "}
          <strong className="text-[var(--accent)] font-semibold">
            BM25 and TF-IDF probabilistic ranking algorithms
          </strong>
          , validating search relevance through formal Cranfield test
          frameworks, and optimizing async microservices in Python and
          FastAPI to sustain{" "}
          <strong className="text-[var(--foreground)] font-semibold">
            sub-5ms query latencies
          </strong>
          .
        </p>
      </ScrollyParagraph>

      {/* Narrative Phase 03 */}
      <ScrollyParagraph phase="PRODUCTION ENTERPRISE IMPACT" index={3}>
        <p className="text-[var(--muted-foreground)]">
          During my software engineering internship at{" "}
          <strong className="text-[var(--accent)] font-semibold">
            Matrix3D Infocom
          </strong>
          , I shipped production vulnerability management dashboards,
          streamlined bulk data pipelines, and engineered fast search and
          filtering across{" "}
          <strong className="text-[var(--foreground)] font-semibold">
            100+ enterprise client repositories
          </strong>
          . I bring that same dedication to code architecture, interface
          accessibility, and user-centered ergonomics to every system I
          deploy.
        </p>
      </ScrollyParagraph>

      {/* Quick Proof Telemetry Metrics Bar */}
      <div className="pt-6 border-t border-[var(--border)]">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="p-3.5 rounded-sm border border-[var(--border)] bg-[var(--card)] transition-colors hover:border-[var(--accent)]"
            >
              <span className="font-display font-medium text-xl sm:text-2xl block text-[var(--accent)]">
                {m.value}
              </span>
              <span className="font-body text-xs font-medium block text-[var(--foreground)] mt-0.5">
                {m.label}
              </span>
              <span className="font-body text-[10px] block text-[var(--muted-foreground)]">
                {m.sub}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function About() {
  const metrics = [
    { value: "3.3ms", label: "p50 Ranking Latency", sub: "BM25 Inverted Index" },
    { value: "06", label: "Live Systems", sub: "Vercel, AWS & Render" },
    { value: "100+", label: "Tracked Projects", sub: "Matrix3D Internship" },
    { value: "2027", label: "B.E. Computer Eng", sub: "Univ. of Mumbai" },
  ]

  return (
    <section
      id="about"
      className="py-28 md:py-36"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="max-w-[1440px] mx-auto px-6 sm:px-8 md:px-16">
        {/* Section HUD Meta Header */}
        <FadeUp>
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[var(--border)] mb-12 md:mb-16">
            <div className="flex items-center gap-3">
              <span className="accent-dot" />
              <p
                className="font-body text-xs tracking-widest uppercase font-medium"
                style={{ color: "var(--muted-foreground)" }}
              >
                02 // Profile &amp; Engineering Principles
              </p>
            </div>
            <span className="font-mono text-xs tracking-wider uppercase text-[var(--accent)]">
              Curriculum Vitae &amp; Philosophy
            </span>
          </div>
        </FadeUp>

        {/* Big Editorial Statement */}
        <FadeUp delay={0.1}>
          <h2
            className="font-display font-normal leading-[1.08] tracking-tight mb-12 md:mb-16"
            style={{
              fontSize: "clamp(28px, 4.4vw, 56px)",
              letterSpacing: "-0.025em",
              color: "var(--foreground)",
              maxWidth: "24ch",
            }}
          >
            I engineer full-stack systems and applied AI pipelines that bridge
            mathematical rigor with tangible user utility.
          </h2>
        </FadeUp>

        {/* 2-Column Editorial Grid: Narrative & Academic Dossier */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start mb-0">
          {/* Left Column: Scrollytelling Narrative Story */}
          <div className="lg:col-span-7">
            <AboutNarrative metrics={metrics} />
          </div>

          {/* Right Column: Academic & Industry Credentials Card */}
          <FadeUp className="lg:col-span-5 lg:sticky lg:top-20 self-start" delay={0.25}>
            <div
              className="p-6 sm:p-7 rounded-[var(--radius)] border border-[var(--border)] relative"
              style={{ backgroundColor: "var(--card)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: "var(--accent)" }}
                  />
                  <span className="font-body text-xs font-semibold tracking-widest uppercase text-[var(--foreground)]">
                    ACADEMIC &amp; INDUSTRY RECORD
                  </span>
                </div>
                <span className="font-mono text-[10px] tracking-wider text-[var(--accent)]">
                  VERIFIED
                </span>
              </div>

              {/* Entries */}
              <div className="space-y-5 font-body text-xs">
                {/* Education */}
                <div className="pb-4 border-b border-[var(--border)]">
                  <span className="font-body text-[10px] tracking-widest uppercase block mb-1 text-[var(--muted-foreground)]">
                    Undergraduate Education
                  </span>
                  <p className="font-medium text-sm text-[var(--foreground)]">
                    Bachelor of Engineering — Computer Engineering
                  </p>
                  <p className="text-[var(--muted-foreground)] mt-0.5">
                    Mumbai University
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-mono text-[11px] text-[var(--accent)] px-2 py-0.5 rounded-sm border border-[var(--border)] bg-[var(--background)]">
                      2023 – 2027
                    </span>
                    <span className="text-[11px] text-[var(--muted-foreground)]">
                      Expected Graduation: 2027
                    </span>
                  </div>
                </div>

                {/* Coursework */}
                <div className="pb-4 border-b border-[var(--border)]">
                  <span className="font-body text-[10px] tracking-widest uppercase block mb-2 text-[var(--muted-foreground)]">
                    Key Computer Science Coursework
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Data Structures & Algorithms",
                      "Analysis of Algorithms",
                      "Operating Systems",
                      "Database Management (DBMS)",
                      "Computer Networks",
                      "Software Engineering (SRS/SAD)",
                    ].map((course) => (
                      <span
                        key={course}
                        className="px-2 py-0.5 rounded-sm border border-[var(--border)] bg-[var(--background)] text-[11px] text-[var(--foreground)]"
                      >
                        {course}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Internship Experience */}
                <div className="pb-4 border-b border-[var(--border)]">
                  <span className="font-body text-[10px] tracking-widest uppercase block mb-1 text-[var(--muted-foreground)]">
                    Industry Experience
                  </span>
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-[var(--foreground)]">
                      Software Engineering Intern
                    </p>
                    <span className="font-mono text-[10px] text-[var(--accent)]">
                      Oct 2025 – Jan 2026
                    </span>
                  </div>
                  <p className="text-[var(--muted-foreground)] mt-0.5">
                    Matrix3D Infocom Pvt. Ltd. · Mumbai, India
                  </p>
                </div>

                {/* Status & Work Authorization */}
                <div className="pt-1 flex items-center justify-between">
                  <div>
                    <span className="font-body text-[10px] tracking-widest uppercase block text-[var(--muted-foreground)]">
                      Availability Status
                    </span>
                    <span className="font-medium text-xs text-[var(--foreground)] mt-0.5 block">
                      Full-Time SDE &amp; AI Roles (2026/2027)
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[var(--accent)] px-2 py-0.5 rounded-sm border border-[var(--accent)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                    OPEN
                  </span>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}

// ─── Skills ───────────────────────────────────────────────────────────────────

function Skills() {
  const [activeTab, setActiveTab] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeDomainInView, setActiveDomainInView] = useState<string>("ai")

  const categories = [
    { id: "all", label: "All Domains" },
    { id: "ai", label: "IR & Applied AI" },
    { id: "backend", label: "Backend & Systems" },
    { id: "frontend", label: "Frontend & UI" },
    { id: "cloud", label: "Cloud & DevOps" },
  ]

  const architecturalDomains = [
    {
      id: "ai",
      num: "01",
      domain: "IR & MACHINE LEARNING",
      title: "Information Retrieval & Applied AI",
      summary:
        "Inverted index search architectures, probabilistic BM25 ranking, empirical Cranfield evaluation, and multimodal vision pipelines.",
      metricBadge: "3.3ms p50 Ranking · 0.74 NDCG",
      flagships: [
        {
          name: "BM25 & TF-IDF Ranking",
          spec: "Inverted index probabilistic ranking & document length normalization",
          metric: "3.3ms p50",
        },
        {
          name: "Cranfield IR Framework",
          spec: "Formal empirical evaluation benchmark with 336 relevance judgements",
          metric: "0.74 NDCG · 0.90 MRR",
        },
        {
          name: "Gemini Vision (Multimodal)",
          spec: "Prescription OCR parsing, clinical reasoning, and automated chatbot integration",
          metric: "Gemini 1.5",
        },
        {
          name: "PyTorch Deep Learning",
          spec: "Convolutional neural networks for clinical image classification and validation",
          metric: "94.8% Val Acc",
        },
      ],
      ecosystem: [
        {
          name: "Scikit-learn",
          proficiency: "Daily Driver" as const,
          highlight: "Cosine Similarity",
        },
        {
          name: "OpenCV",
          proficiency: "Core Tool" as const,
          highlight: "Image Processing",
        },
        {
          name: "Hugging Face",
          proficiency: "Core Tool" as const,
          highlight: "NLP Transformers",
        },
        {
          name: "Vector Space Models",
          proficiency: "Advanced" as const,
          highlight: "Sparse Term Vectors",
        },
        {
          name: "Empirical IR Metrics",
          proficiency: "Advanced" as const,
          highlight: "NDCG / MRR / Precision",
        },
      ],
      featuredProjects: [
        { name: "SearchForge Engine", tag: "3.3ms p50 IR" },
        { name: "AI Drug Warning", tag: "Gemini Vision" },
        { name: "Skin Disease Detection", tag: "PyTorch 94.8%" },
      ],
    },
    {
      id: "backend",
      num: "02",
      domain: "BACKEND & SYSTEMS",
      title: "High-Throughput APIs & Distributed Stores",
      summary:
        "Asynchronous Python event loops, sub-5ms RESTful APIs, relational schema optimization, and secure distributed data persistence.",
      metricBadge: "Async Event Loops · ACID DBs",
      flagships: [
        {
          name: "FastAPI (Python)",
          spec: "High-throughput async Python microservices with Pydantic contract validation",
          metric: "3.3ms p50 Ranking",
        },
        {
          name: "Python Backend Engineering",
          spec: "AsyncIO concurrency, low-overhead REST routing, and JSON serialization",
          metric: "Daily Driver",
        },
        {
          name: "MySQL & PostgreSQL",
          spec: "Relational data modeling, foreign keys, index optimization, and query performance",
          metric: "ACID Stores",
        },
        {
          name: "Node.js & Express",
          spec: "Lightweight asynchronous API endpoints and middleware request authentication",
          metric: "Node 20+",
        },
      ],
      ecosystem: [
        {
          name: "MongoDB",
          proficiency: "Core Tool" as const,
          highlight: "NoSQL Aggregations",
        },
        {
          name: "Django",
          proficiency: "Core Tool" as const,
          highlight: "Full-Stack ORM",
        },
        {
          name: "RESTful Architecture",
          proficiency: "Daily Driver" as const,
          highlight: "Status Codes & CORS",
        },
        {
          name: "C++",
          proficiency: "Core Tool" as const,
          highlight: "Algorithms & Memory",
        },
        {
          name: "SQL Query Tuning",
          proficiency: "Daily Driver" as const,
          highlight: "Multi-Table Joins",
        },
      ],
      featuredProjects: [
        { name: "SearchForge Microservice", tag: "FastAPI" },
        { name: "Drug Interaction API", tag: "Render + Vercel" },
      ],
    },
    {
      id: "frontend",
      num: "03",
      domain: "FRONTEND & UI CRAFT",
      title: "Modern Client Architecture & Motion",
      summary:
        "Bleeding-edge React 19 component lifecycles, Next.js server components, design token systems, and mathematical physics animations.",
      metricBadge: "React 19 · Next.js 14 · Strict TS",
      flagships: [
        {
          name: "React 19",
          spec: "Custom state hooks, transitions, layoutId animations, and search telemetry dashboards",
          metric: "Bleeding-Edge",
        },
        {
          name: "Next.js 14 (App Router)",
          spec: "Server Components, dynamic route handlers, client hydration, and edge execution",
          metric: "Edge Ready",
        },
        {
          name: "TypeScript",
          spec: "Strict type safety across full-stack contracts, interfaces, and generic utility types",
          metric: "100% Strict",
        },
        {
          name: "Tailwind CSS & Tokens",
          spec: "Fluid typography, responsive utilities, CSS custom variables, and theme management",
          metric: "Design System",
        },
      ],
      ecosystem: [
        {
          name: "Framer Motion",
          proficiency: "Daily Driver" as const,
          highlight: "Spring Physics & Layout Morph",
        },
        {
          name: "Accessible UI / UX",
          proficiency: "Daily Driver" as const,
          highlight: "WCAG & Semantic HTML",
        },
        {
          name: "JavaScript (ES6+)",
          proficiency: "Daily Driver" as const,
          highlight: "DOM APIs & Event Handlers",
        },
        {
          name: "Responsive Layouts",
          proficiency: "Daily Driver" as const,
          highlight: "Mobile to 4K Displays",
        },
      ],
      featuredProjects: [
        { name: "NutriScan UI", tag: "Next.js 14" },
        { name: "SearchForge Analytics UI", tag: "React 19" },
      ],
    },
    {
      id: "cloud",
      num: "04",
      domain: "DEVOPS & CLOUD INFRA",
      title: "Cloud Infrastructure & Edge Delivery",
      summary:
        "Containerized Python microservices, AWS S3/EC2 compute, serverless edge networks, and automated CI/CD workflows.",
      metricBadge: "AWS · Docker · Vercel Edge",
      flagships: [
        {
          name: "AWS (EC2 & S3)",
          spec: "Cloud compute hosting, S3 asset buckets, IAM policies, and architecture deployments",
          metric: "Cloud Infra",
        },
        {
          name: "Docker Containerization",
          spec: "Reproducible multi-stage Dockerfiles and containerized microservice runtimes",
          metric: "Containers",
        },
        {
          name: "Vercel & Render",
          spec: "Serverless edge functions, instant git-driven preview branches, and global edge CDN",
          metric: "Production",
        },
        {
          name: "Git & GitHub Workflows",
          spec: "Semantic versioning, branch hygiene, pull requests, and open-source collaboration",
          metric: "Trunk Flow",
        },
      ],
      ecosystem: [
        {
          name: "Postman",
          proficiency: "Daily Driver" as const,
          highlight: "Contract Mocking & Tests",
        },
        {
          name: "Linux / Bash Shell",
          proficiency: "Core Tool" as const,
          highlight: "CLI Tooling & Scripts",
        },
        {
          name: "Edge Serverless",
          proficiency: "Daily Driver" as const,
          highlight: "Zero Cold-Start",
        },
        {
          name: "REST Verification",
          proficiency: "Daily Driver" as const,
          highlight: "Payload Validation",
        },
      ],
      featuredProjects: [
        { name: "Translify Pipeline", tag: "AWS EC2 + S3" },
        { name: "NutriScan Deployment", tag: "Vercel Edge" },
      ],
    },
  ]

  const filteredDomains = architecturalDomains.filter((d) => {
    const matchesTab = activeTab === "all" || d.id === activeTab
    if (!matchesTab) return false
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      d.title.toLowerCase().includes(q) ||
      d.domain.toLowerCase().includes(q) ||
      d.summary.toLowerCase().includes(q) ||
      d.flagships.some(
        (f) =>
          f.name.toLowerCase().includes(q) || f.spec.toLowerCase().includes(q),
      ) ||
      d.ecosystem.some(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.highlight && e.highlight.toLowerCase().includes(q)),
      ) ||
      d.featuredProjects.some((p) => p.name.toLowerCase().includes(q))
    )
  })

  // Observe active domain in view as user scrolls
  useEffect(() => {
    const domainIds = ["domain-ai", "domain-backend", "domain-frontend", "domain-cloud"]
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace("domain-", "")
            setActiveDomainInView(id)
          }
        })
      },
      {
        rootMargin: "-15% 0px -40% 0px",
        threshold: 0.1,
      }
    )

    domainIds.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [filteredDomains])

  return (
    <section
      id="skills"
      className="py-28 md:py-36"
      style={{
        borderTop: "1px solid var(--border)",
        backgroundColor: "var(--background)",
      }}
    >
      <div className="max-w-[1440px] mx-auto px-6 sm:px-8 md:px-16">
        {/* Section HUD Meta Header */}
        <FadeUp>
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[var(--border)] mb-12 md:mb-16">
            <div className="flex items-center gap-3">
              <span className="accent-dot" />
              <p
                className="font-body text-xs tracking-widest uppercase font-medium"
                style={{ color: "var(--muted-foreground)" }}
              >
                03 // Technical Stack &amp; Capabilities
              </p>
            </div>
            <span className="font-mono text-xs tracking-wider uppercase text-[var(--accent)]">
              04 Architectural Domains · 28 Technologies
            </span>
          </div>
        </FadeUp>

        {/* 2-Column Editorial Magazine Layout with Sticky Left Anchor */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-14 items-start">
          {/* Left Column: Sticky Anchor Hub */}
          <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-20 self-start space-y-6">
            {/* Big Editorial Statement */}
            <div>
              <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--accent)] block mb-2 font-medium">
                DISCIPLINE DIRECTORY
              </span>
              <h2
                className="font-display font-normal leading-[1.1] tracking-tight mb-3"
                style={{
                  fontSize: "clamp(26px, 3.2vw, 42px)",
                  letterSpacing: "-0.02em",
                  color: "var(--foreground)",
                }}
              >
                Architectural domains engineered for latency &amp; scale.
              </h2>
              <p className="font-body text-xs sm:text-sm leading-relaxed text-[var(--muted-foreground)]">
                Organized into 4 core disciplines—balancing sub-5ms query response,
                empirical Cranfield evaluation, and production craftsmanship.
              </p>
            </div>

            {/* Interactive Domain Scroll Spy Navigation Tracker */}
            <div className="p-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] space-y-2">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border)]">
                <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--muted-foreground)]">
                  Live Domain Tracker
                </span>
                <span className="font-mono text-[10px] text-[var(--accent)]">
                  {filteredDomains.length} ACTIVE
                </span>
              </div>
              <div className="space-y-1.5">
                {architecturalDomains.map((domain) => {
                  const isActive = activeDomainInView === domain.id
                  const isMatchingFilter = filteredDomains.some((d) => d.id === domain.id)
                  return (
                    <button
                      key={domain.id}
                      type="button"
                      onClick={() => {
                        const target = document.getElementById(`domain-${domain.id}`)
                        if (target) {
                          target.scrollIntoView({ behavior: "smooth" })
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-sm text-left transition-all cursor-pointer ${
                        isActive
                          ? "bg-[var(--background)] border border-[var(--accent)] shadow-xs"
                          : "hover:bg-[var(--background)]/60 border border-transparent"
                      } ${!isMatchingFilter ? "opacity-40" : "opacity-100"}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`font-mono text-xs ${
                            isActive ? "text-[var(--accent)] font-semibold" : "text-[var(--muted-foreground)]"
                          }`}
                        >
                          {domain.num}
                        </span>
                        <span
                          className={`font-body text-xs truncate ${
                            isActive ? "text-[var(--foreground)] font-medium" : "text-[var(--muted-foreground)]"
                          }`}
                        >
                          {domain.domain}
                        </span>
                      </div>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)] shrink-0 ml-2" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Real-Time Search Box */}
            <div className="space-y-2">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted-foreground)] pointer-events-none"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    if (e.target.value.trim() && activeTab !== "all") {
                      setActiveTab("all")
                    }
                  }}
                  placeholder="Filter by tech or pattern..."
                  className="w-full pl-9 pr-8 py-2 text-xs font-body rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Category Filter Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {categories.map((cat) => {
                  const isActive = activeTab === cat.id
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveTab(cat.id)}
                      className={`px-2.5 py-1 text-[11px] font-body rounded-sm border transition-all cursor-pointer ${
                        isActive
                          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)] font-medium shadow-xs"
                          : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--accent)]"
                      }`}
                    >
                      {cat.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Quick Summary Pill Bar */}
            <div className="pt-2 flex items-center justify-between text-[11px] font-mono text-[var(--muted-foreground)] border-t border-[var(--border)]">
              <span>28 TECHNOLOGIES</span>
              <span className="text-[var(--accent)]">FULL SPEC AUDITED</span>
            </div>
          </div>

          {/* Right Column: Scrolling Domain Dossier Stream */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-8">
            <AnimatePresence mode="popLayout">
              {filteredDomains.map((domain, i) => (
                <motion.div
                  key={domain.id}
                  id={`domain-${domain.id}`}
                  layout
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="p-6 sm:p-8 md:p-9 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] transition-all duration-300 hover:border-[var(--accent)] group"
                >
                  {/* Domain Header Row */}
                  <div className="flex items-center justify-between pb-4 mb-5 border-b border-[var(--border)]">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-base font-semibold text-[var(--accent)]">
                        {domain.num}
                      </span>
                      <span className="font-mono text-xs tracking-widest uppercase text-[var(--muted-foreground)] font-medium">
                        {domain.domain}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] px-2.5 py-1 rounded-sm border border-[var(--border)] bg-[var(--background)] text-[var(--accent)] font-medium">
                      {domain.metricBadge}
                    </span>
                  </div>

                  {/* Domain Title & Mission */}
                  <h3 className="font-display font-medium text-2xl sm:text-3xl text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors mb-3">
                    {domain.title}
                  </h3>
                  <p className="font-body text-sm sm:text-base leading-relaxed text-[var(--muted-foreground)] mb-7">
                    {domain.summary}
                  </p>

                  {/* Core Flagships List (2-column grid inside the wide card) */}
                  <div className="mb-7">
                    <div className="flex items-center justify-between mb-3.5">
                      <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--muted-foreground)]">
                        Core Specializations &amp; Production Rigor
                      </span>
                      <span className="font-mono text-[10px] text-[var(--accent)]">
                        PRODUCTION VERIFIED
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {domain.flagships.map((flagship) => (
                        <div
                          key={flagship.name}
                          className="p-3 rounded-sm border border-[var(--border)] bg-[var(--background)] flex flex-col justify-between gap-2 group/item hover:border-[var(--accent)] transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-body text-xs font-semibold text-[var(--foreground)] group-hover/item:text-[var(--accent)] transition-colors">
                              {flagship.name}
                            </span>
                            {flagship.metric && (
                              <span className="font-mono text-[10px] text-[var(--accent)] px-1.5 py-0.5 rounded-xs bg-[var(--card)] border border-[var(--border)] whitespace-nowrap shrink-0">
                                {flagship.metric}
                              </span>
                            )}
                          </div>
                          <span className="font-body text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                            {flagship.spec}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Extended Ecosystem & Tooling */}
                  <div className="mb-7">
                    <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--muted-foreground)] block mb-3">
                      Extended Ecosystem &amp; Tooling
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {domain.ecosystem.map((tool) => (
                        <span
                          key={tool.name}
                          title={
                            tool.highlight
                              ? `${tool.name} · ${tool.highlight}`
                              : tool.name
                          }
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-body rounded-sm border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-default"
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                              backgroundColor:
                                tool.proficiency === "Daily Driver"
                                  ? "#22c55e"
                                  : tool.proficiency === "Advanced"
                                    ? "var(--accent)"
                                    : "var(--muted-foreground)",
                            }}
                          />
                          <span>{tool.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Footer: Proven In Projects */}
                  <div className="pt-4 border-t border-[var(--border)] flex items-center justify-between text-xs gap-3 flex-wrap">
                    <span className="font-mono text-[10px] tracking-wider uppercase text-[var(--muted-foreground)]">
                      Proven in production:
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {domain.featuredProjects.map((p) => (
                        <a
                          key={p.name}
                          href="#work"
                          onClick={(e) => {
                            e.preventDefault()
                            document
                              .getElementById("work")
                              ?.scrollIntoView({ behavior: "smooth" })
                          }}
                          className="font-mono text-[10px] text-[var(--accent)] hover:underline inline-flex items-center gap-1 bg-[var(--background)] px-2.5 py-1 rounded-sm border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
                        >
                          <span>{p.name}</span>
                          <span className="text-[var(--muted-foreground)]">
                            ({p.tag})
                          </span>
                          <span>↗</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Empty Search State */}
            {filteredDomains.length === 0 && (
              <div className="py-16 text-center border border-dashed border-[var(--border)] rounded-[var(--radius)]">
                <p className="font-display text-lg text-[var(--foreground)] mb-1">
                  No matching technologies or domains found
                </p>
                <p className="font-body text-xs text-[var(--muted-foreground)] mb-4">
                  Try searching for &quot;Python&quot;, &quot;FastAPI&quot;,
                  &quot;BM25&quot;, &quot;Docker&quot;, or reset filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("all")
                    setSearchQuery("")
                  }}
                  className="px-4 py-2 text-xs font-body rounded-[var(--radius)] border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] transition-colors cursor-pointer"
                >
                  Reset All Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Experience ───────────────────────────────────────────────────────────────

function ExperienceTimelineItem({
  exp,
  index,
}: {
  exp: ExperienceItem
  index: number
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const isRowInView = useInView(rowRef, { margin: "-18% 0px -28% 0px" })

  return (
    <div ref={rowRef} className="relative pl-8 sm:pl-14 md:pl-16 group">
      {/* Milestone Anchor Node on the rail */}
      <div
        className="absolute left-3.5 sm:left-6 md:left-8 -translate-x-1/2 top-7 sm:top-8 md:top-9 z-20 pointer-events-none flex items-center justify-center"
        aria-hidden="true"
      >
        {/* Radar pulse ping effect when active in view or hovered */}
        <span
          className={`absolute w-7 h-7 rounded-full transition-all duration-500 pointer-events-none ${
            isRowInView
              ? "bg-[var(--accent)]/20 animate-ping opacity-75"
              : "opacity-0 group-hover:opacity-40 group-hover:bg-[var(--accent)]/15 group-hover:animate-ping"
          }`}
        />

        {/* Outer Ring Housing */}
        <div
          className={`relative w-6 h-6 rounded-full border-2 bg-[var(--background)] transition-all duration-300 flex items-center justify-center ${
            isRowInView
              ? "border-[var(--accent)] shadow-[0_0_14px_rgba(0,255,136,0.45)] scale-110"
              : "border-[var(--border)] group-hover:border-[var(--accent)] group-hover:shadow-[0_0_10px_rgba(0,255,136,0.3)]"
          }`}
        >
          {/* Inner Core Bead */}
          <div
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              isRowInView
                ? "bg-[var(--accent)] scale-125 shadow-[0_0_8px_var(--accent)]"
                : "bg-[var(--muted-foreground)] group-hover:bg-[var(--accent)]"
            }`}
          />
        </div>
      </div>

      {/* Horizontal Circuit Bridge (Connecting Rail to Card on sm+) */}
      <div
        className={`hidden sm:block absolute left-6 md:left-8 top-10 sm:top-11 md:top-12 h-[1px] w-8 md:w-8 transition-all duration-300 pointer-events-none ${
          isRowInView
            ? "bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
            : "bg-[var(--border)] group-hover:bg-[var(--accent)]"
        }`}
        aria-hidden="true"
      />

      {/* Experience Card */}
      <motion.div
        className="p-6 sm:p-8 md:p-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] transition-colors hover:border-[var(--accent)]"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{
          duration: 0.6,
          ease: [0.22, 1, 0.36, 1],
          delay: index * 0.12,
        }}
      >
        {/* Card Window Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 mb-6 border-b border-[var(--border)]">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="font-display text-xs tracking-wider text-[var(--accent)] font-mono">
                ROLE // 0{index + 1}
              </span>
              <span className="text-[var(--border)]">·</span>
              <span className="font-mono text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-sm border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)]">
                {exp.location}
              </span>
            </div>
            <h3 className="font-display font-medium text-xl sm:text-2xl md:text-3xl text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
              {exp.role}
            </h3>
            <p className="font-body text-sm sm:text-base font-medium text-[var(--accent)] mt-1">
              {exp.org}
            </p>
          </div>

          <div className="flex flex-col lg:items-end gap-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm border border-[var(--border)] bg-[var(--background)]">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: exp.badgeColor || "var(--accent)",
                }}
              />
              <span className="font-mono text-[10px] tracking-wider uppercase text-[var(--foreground)] font-medium">
                {exp.badge}
              </span>
            </div>
            <span className="font-mono text-xs text-[var(--muted-foreground)]">
              {exp.period}
            </span>
          </div>
        </div>

        {/* Summary Lead */}
        <p className="font-body text-sm sm:text-base leading-relaxed text-[var(--foreground)] mb-6">
          {exp.summary}
        </p>

        {/* 4 Impact Telemetry Stat Boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {exp.metrics.map((m) => (
            <div
              key={m.label}
              className="p-3 sm:p-3.5 rounded-sm border border-[var(--border)] bg-[var(--background)] transition-colors group-hover:border-[var(--accent)]"
            >
              <span className="font-display font-medium text-lg sm:text-xl block text-[var(--accent)]">
                {m.value}
              </span>
              <span className="font-body text-[11px] font-medium block text-[var(--muted-foreground)] mt-0.5">
                {m.label}
              </span>
            </div>
          ))}
        </div>

        {/* Detailed Contributions / Bullets */}
        <div className="mb-8">
          <span className="font-body text-[10px] tracking-widest uppercase block mb-3 text-[var(--muted-foreground)]">
            Key Engineering Contributions &amp; Scope
          </span>
          <ul className="space-y-3 font-body text-xs sm:text-sm leading-relaxed text-[var(--muted-foreground)]">
            {exp.contributions.map((bullet, bi) => (
              <li key={bi} className="flex items-start gap-2.5">
                <span className="text-[var(--accent)] text-xs mt-1 font-mono">
                  ▸
                </span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Technologies Applied */}
        <div className="pt-5 border-t border-[var(--border)]">
          <span className="font-body text-[10px] tracking-widest uppercase block mb-2.5 text-[var(--muted-foreground)]">
            Stack &amp; Methodologies Applied
          </span>
          <div className="flex flex-wrap gap-1.5">
            {exp.technologies.map((tech) => (
              <span
                key={tech}
                className="px-2.5 py-1 text-[11px] font-body rounded-sm border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] transition-colors hover:border-[var(--accent)]"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function Experience() {
  const timelineRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start 75%", "end 60%"],
  })

  // Laser beam height from 0% to 100%
  const beamHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"])
  const headOpacity = useTransform(scrollYProgress, [0, 0.05, 0.95, 1], [0, 1, 1, 0.3])

  return (
    <section
      id="exp"
      className="py-28 md:py-36 relative overflow-hidden"
      style={{
        borderTop: "1px solid var(--border)",
        backgroundColor: "var(--background)",
      }}
    >
      <div className="max-w-[1440px] mx-auto px-6 sm:px-8 md:px-16">
        {/* Section HUD Meta Header */}
        <FadeUp>
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[var(--border)] mb-12 md:mb-16">
            <div className="flex items-center gap-3">
              <span className="accent-dot" />
              <p
                className="font-body text-xs tracking-widest uppercase font-medium"
                style={{ color: "var(--muted-foreground)" }}
              >
                04 // Industry Track Record &amp; Roles
              </p>
            </div>
            <span className="font-mono text-xs tracking-wider uppercase text-[var(--accent)]">
              Professional Engineering &amp; Mentorship
            </span>
          </div>
        </FadeUp>

        {/* Big Editorial Statement */}
        <FadeUp delay={0.1}>
          <div className="max-w-3xl mb-14 md:mb-18">
            <h2
              className="font-display font-normal leading-[1.08] tracking-tight mb-4"
              style={{
                fontSize: "clamp(28px, 4.4vw, 56px)",
                letterSpacing: "-0.025em",
                color: "var(--foreground)",
              }}
            >
              Delivering measurable systems engineering impact across production
              enterprise pipelines.
            </h2>
            <p className="font-body text-sm sm:text-base leading-relaxed text-[var(--muted-foreground)]">
              From building high-throughput vulnerability ingestion platforms
              and indexed search at Matrix3D Infocom to first-principles
              mathematics mentorship, my background pairs architectural
              discipline with user-centered execution.
            </p>
          </div>
        </FadeUp>

        {/* Living Timeline Container */}
        <div ref={timelineRef} className="relative">
          {/* Static Track Rail (Background vertical guideline) */}
          <div
            className="absolute left-3.5 sm:left-6 md:left-8 top-3 bottom-6 w-[2px] -translate-x-1/2 bg-[var(--border)] rounded-full pointer-events-none"
            aria-hidden="true"
          >
            {/* Hash ticks along the rail */}
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff20_1px,transparent_1px)] [background-size:2px_12px] opacity-70" />
          </div>

          {/* Dynamic Laser Beam (Follows user scroll) */}
          <motion.div
            className="absolute left-3.5 sm:left-6 md:left-8 top-3 w-[2px] -translate-x-1/2 rounded-full pointer-events-none origin-top z-10"
            style={{
              height: beamHeight,
              background:
                "linear-gradient(to bottom, rgba(0, 255, 136, 0.05) 0%, rgba(0, 255, 136, 0.6) 60%, var(--accent) 100%)",
              boxShadow:
                "0 0 10px 1px var(--accent), 0 0 20px 2px rgba(0, 255, 136, 0.35)",
            }}
            aria-hidden="true"
          >
            {/* Laser Head / Luminous Photon Tip */}
            <motion.div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3.5 h-3.5 rounded-full pointer-events-none flex items-center justify-center"
              style={{
                opacity: headOpacity,
              }}
            >
              {/* Pulsing Flare */}
              <div
                className="absolute inset-0 rounded-full animate-pulse"
                style={{
                  backgroundColor: "var(--accent)",
                  boxShadow:
                    "0 0 12px 3px var(--accent), 0 0 28px 6px rgba(0, 255, 136, 0.6)",
                }}
              />
              {/* Laser Core */}
              <div className="relative w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_#fff]" />
            </motion.div>
          </motion.div>

          {/* Cards List */}
          <div className="space-y-10 sm:space-y-12">
            {experience.map((exp, i) => (
              <ExperienceTimelineItem key={exp.role} exp={exp} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Certifications ───────────────────────────────────────────────────────────

function Certifications() {
  return (
    <section
      id="certs"
      className="py-28 md:py-36"
      style={{
        borderTop: "1px solid var(--border)",
        backgroundColor: "var(--background)",
      }}
    >
      <div className="max-w-[1440px] mx-auto px-6 sm:px-8 md:px-16">
        {/* Section HUD Meta Header */}
        <FadeUp>
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[var(--border)] mb-12 md:mb-16">
            <div className="flex items-center gap-3">
              <span className="accent-dot" />
              <p
                className="font-body text-xs tracking-widest uppercase font-medium"
                style={{ color: "var(--muted-foreground)" }}
              >
                05 // Accredited Qualifications &amp; Specializations
              </p>
            </div>
            <span className="font-mono text-xs tracking-wider uppercase text-[var(--accent)]">
              Continuous Engineering Rigor
            </span>
          </div>
        </FadeUp>

        {/* Big Editorial Statement */}
        <FadeUp delay={0.1}>
          <div className="max-w-3xl mb-14 md:mb-18">
            <h2
              className="font-display font-normal leading-[1.08] tracking-tight mb-4"
              style={{
                fontSize: "clamp(28px, 4.4vw, 56px)",
                letterSpacing: "-0.025em",
                color: "var(--foreground)",
              }}
            >
              Verified credentials across cloud infrastructure, scientific
              computing, and computer systems.
            </h2>
            <p className="font-body text-sm sm:text-base leading-relaxed text-[var(--muted-foreground)]">
              Formal academic and industry specializations validating
              foundational competence in distributed cloud, algorithm design,
              and microprocessor architecture.
            </p>
          </div>
        </FadeUp>

        {/* 3-Column Accredited Credentials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {certifications.map((cert, i) => (
            <motion.div
              key={cert.id}
              className="p-6 sm:p-7 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] transition-all duration-300 hover:border-[var(--accent)] hover:translate-y-[-2px] flex flex-col justify-between group"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.55,
                ease: [0.22, 1, 0.36, 1],
                delay: i * 0.1,
              }}
            >
              <div>
                {/* Top Badge & Number */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border)]">
                  <span className="font-mono text-xs font-semibold text-[var(--accent)]">
                    {cert.id} // CREDENTIAL
                  </span>
                  <span className="font-mono text-[9px] tracking-widest uppercase px-2 py-0.5 rounded-sm border border-[var(--border)] bg-[var(--background)] text-[var(--accent)]">
                    {cert.badge}
                  </span>
                </div>

                {/* Title */}
                <h3 className="font-display font-medium text-lg sm:text-xl text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors mb-2">
                  {cert.title}
                </h3>

                {/* Issuer */}
                <p className="font-body text-xs font-medium text-[var(--accent)] mb-4">
                  {cert.issuer}
                </p>

                {/* Competencies Chips */}
                <div className="space-y-2 mb-6">
                  <span className="font-body text-[10px] tracking-widest uppercase block text-[var(--muted-foreground)]">
                    Key Competencies
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {cert.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-0.5 text-[10px] font-mono rounded-sm border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 border-t border-[var(--border)]">
                <a
                  href={cert.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-between px-3.5 py-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs font-body font-medium text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors group/btn"
                >
                  <span>Verify Credential</span>
                  <svg
                    className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M4 12L12 4M12 4H6M12 4V10"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Contact ──────────────────────────────────────────────────────────────────

// ─── Contact ──────────────────────────────────────────────────────────────────

function Contact() {
  const [copied, setCopied] = useState(false)

  const copyEmail = () => {
    navigator.clipboard.writeText("furkanahmedfarooqui19@gmail.com")
    setCopied(true)
    setTimeout(() => setCopied(false), 2400)
  }

  const channels = [
    {
      id: "01",
      platform: "Direct Email",
      tag: "PRIMARY CHANNEL",
      handle: "furkanahmedfarooqui19@gmail.com",
      href: "mailto:furkanahmedfarooqui19@gmail.com",
      note: "Response within 24 hours guaranteed",
    },
    {
      id: "02",
      platform: "GitHub",
      tag: "SOURCE REPOSITORIES",
      handle: "github.com/FurkanFarooqui19",
      href: "https://github.com/FurkanFarooqui19",
      note: "29+ repositories & live systems code",
    },
    {
      id: "03",
      platform: "LinkedIn",
      tag: "PROFESSIONAL NETWORK",
      handle: "linkedin.com/in/furkan-farooqui",
      href: "https://linkedin.com/in/furkan-farooqui",
      note: "Verified endorsements & engineering history",
    },
    {
      id: "04",
      platform: "X / Twitter",
      tag: "TECHNICAL DISPATCHES",
      handle: "x.com/furkanfarooqui_",
      href: "https://x.com/furkanfarooqui_",
      note: "Systems insights, IR notes, LLM exploration",
    },
  ]

  return (
    <section
      id="contact"
      className="py-28 md:py-36"
      style={{
        borderTop: "1px solid var(--border)",
        backgroundColor: "var(--background)",
      }}
    >
      <div className="max-w-[1440px] mx-auto px-6 sm:px-8 md:px-16">
        {/* Section HUD Meta Header */}
        <FadeUp>
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[var(--border)] mb-12 md:mb-16">
            <div className="flex items-center gap-3">
              <span className="accent-dot" />
              <p
                className="font-body text-xs tracking-widest uppercase font-medium"
                style={{ color: "var(--muted-foreground)" }}
              >
                06 // Collaborative Engagement &amp; Dialogue
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-xs tracking-wider uppercase text-[var(--accent)] font-medium">
                Available for Full-Time Roles · Immediate
              </span>
            </div>
          </div>
        </FadeUp>

        {/* Editorial Heading */}
        <FadeUp delay={0.1}>
          <div className="max-w-4xl mb-12 md:mb-16">
            <h2
              className="font-display font-normal leading-[1.05] tracking-tight mb-5"
              style={{
                fontSize: "clamp(32px, 5.2vw, 76px)",
                letterSpacing: "-0.03em",
                color: "var(--foreground)",
              }}
            >
              Let&apos;s engineer reliable, high-throughput systems together.
            </h2>
            <p className="font-body text-sm sm:text-base md:text-lg leading-relaxed text-[var(--muted-foreground)] max-w-3xl">
              Actively seeking full-time Software Development and Applied AI
              Engineering roles. Whether discussing low-latency search
              architectures, full-stack product scaling, or evaluation pipelines
              — my inbox is directly open.
            </p>
          </div>
        </FadeUp>

        {/* Hero Email & Status Card */}
        <FadeUp delay={0.15}>
          <div className="p-7 sm:p-10 rounded-[var(--radius)] border border-[var(--accent)]/40 bg-[var(--card)] relative mb-8">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-[var(--border)]">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-semibold text-[var(--accent)]">
                  DIRECT CONTACT POINT
                </span>
                <span className="text-[var(--border)]">·</span>
                <span className="font-mono text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-medium">
                  Status: Ready to Deploy
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono text-[var(--muted-foreground)]">
                <span>Location: Mumbai, IN</span>
                <span>·</span>
                <span>Latency: &lt; 24h</span>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div>
                <span className="font-body text-xs uppercase tracking-wider text-[var(--muted-foreground)] block mb-1 font-medium">
                  Primary Inbox
                </span>
                <a
                  href="mailto:furkanahmedfarooqui19@gmail.com"
                  className="font-display font-medium text-2xl sm:text-3xl md:text-4xl text-[var(--foreground)] hover:text-[var(--accent)] transition-colors block break-all"
                >
                  furkanahmedfarooqui19@gmail.com
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={copyEmail}
                  className="px-4 py-2.5 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs font-body font-medium text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all flex items-center gap-2 cursor-pointer"
                >
                  <svg
                    className="w-4 h-4 text-[var(--accent)]"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <rect x="5" y="5" width="8" height="8" rx="1.5" />
                    <path
                      d="M3 11V3.5C3 2.67 3.67 2 4.5 2H11"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>
                    {copied ? "Copied to Clipboard!" : "Copy Address"}
                  </span>
                </button>

                <a
                  href="mailto:furkanahmedfarooqui19@gmail.com"
                  className="px-4 py-2.5 rounded-sm bg-[var(--accent)] text-[var(--accent-foreground)] text-xs font-body font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  <span>Compose Email</span>
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M3 8H13M13 8L9 4M13 8L9 12"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>

                <a
                  href="https://drive.google.com/uc?export=download&id=1GFm2sa7MQjxvG_6LFVIOzrOZxZiffKu4"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs font-body font-medium text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4 text-[var(--accent)]"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M8 2V11M8 11L4.5 7.5M8 11L11.5 7.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="M2.5 13.5H13.5" strokeLinecap="round" />
                  </svg>
                  <span>Download CV (PDF)</span>
                </a>
              </div>
            </div>
          </div>
        </FadeUp>

        {/* 4 Direct Verified Channels Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {channels.map((chan, i) => (
            <FadeUp key={chan.platform} delay={0.2 + i * 0.05}>
              <a
                href={chan.href}
                target="_blank"
                rel="noopener noreferrer"
                className="p-6 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)] hover:translate-y-[-2px] transition-all block group h-full flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-[10px] tracking-wider text-[var(--accent)] font-semibold">
                      CHANNEL // {chan.id}
                    </span>
                    <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded-sm border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)]">
                      {chan.tag}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <h4 className="font-display font-medium text-base text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                      {chan.platform}
                    </h4>
                    <svg
                      className="w-3.5 h-3.5 text-[var(--muted-foreground)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        d="M4 12L12 4M12 4H6M12 4V10"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <p className="font-mono text-[11px] text-[var(--accent)] mt-1.5 truncate">
                    {chan.handle}
                  </p>
                </div>
                <p className="font-body text-[11px] text-[var(--muted-foreground)] pt-4 mt-4 border-t border-[var(--border)]">
                  {chan.note}
                </p>
              </a>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <footer
      className="py-14 sm:py-20"
      style={{
        borderTop: "1px solid var(--border)",
        backgroundColor: "var(--card)",
      }}
    >
      <div className="max-w-[1440px] mx-auto px-6 sm:px-8 md:px-16 space-y-12">
        {/* Top Row: Brand & Back to Top */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-10 border-b border-[var(--border)]">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="font-display font-medium text-xl sm:text-2xl text-[var(--foreground)]">
                Furkan Farooqui
              </span>
              <span className="font-mono text-[9px] tracking-widest uppercase px-2 py-0.5 rounded-sm border border-[var(--border)] bg-[var(--background)] text-[var(--accent)] font-medium">
                SWE &amp; AI DEVELOPER
              </span>
            </div>
            <p className="font-body text-xs text-[var(--muted-foreground)] max-w-lg">
              Designing and building low-latency search systems, applied AI
              platforms, and high-performance web software from first
              principles.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={scrollToTop}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs font-body font-medium text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer group"
            >
              <span>Back to Top</span>
              <svg
                className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  d="M8 13.5V2.5M8 2.5L4 6.5M8 2.5L12 6.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Middle Row: Colophon / System Architecture Spec Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 text-xs font-body py-2">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)] block mb-1.5">
              Core Runtime
            </span>
            <span className="font-medium text-[var(--foreground)] block">
              React 19 + TypeScript
            </span>
            <span className="text-[11px] text-[var(--muted-foreground)]">
              Vite 8 Build Pipeline
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)] block mb-1.5">
              Animation &amp; Kinematics
            </span>
            <span className="font-medium text-[var(--foreground)] block">
              Motion (v12)
            </span>
            <span className="text-[11px] text-[var(--muted-foreground)]">
              Springs &amp; Parallax HUD
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)] block mb-1.5">
              Design Philosophy
            </span>
            <span className="font-medium text-[var(--foreground)] block">
              Swiss Editorial Design
            </span>
            <span className="text-[11px] text-[var(--muted-foreground)]">
              Fraunces &amp; Inter Typography
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)] block mb-1.5">
              Primary Accent
            </span>
            <span className="font-medium text-[var(--accent)] flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />
              #C4895A Bronze
            </span>
            <span className="text-[11px] text-[var(--muted-foreground)]">
              Light &amp; Dark Harmonized
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)] block mb-1.5">
              Edge Infrastructure
            </span>
            <span className="font-medium text-[var(--foreground)] block">
              Vercel Global Edge
            </span>
            <span className="text-[11px] text-[var(--muted-foreground)]">
              Zero Latency Distribution
            </span>
          </div>
        </div>

        {/* Bottom Row: Copyright + Navigation Links */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-8 border-t border-[var(--border)] text-xs font-body text-[var(--muted-foreground)]">
          <p>
            © 2026 Furkan Farooqui. Built with first-principles engineering
            rigor.
          </p>

          <div className="flex items-center gap-5 flex-wrap">
            {[
              { label: "Work", href: "#work" },
              { label: "About", href: "#about" },
              { label: "Skills", href: "#skills" },
              { label: "Experience", href: "#exp" },
              { label: "Certifications", href: "#certs" },
              {
                label: "GitHub",
                href: "https://github.com/FurkanFarooqui19",
                external: true,
              },
              {
                label: "LinkedIn",
                href: "https://linkedin.com/in/furkan-farooqui",
                external: true,
              },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="hover:text-[var(--accent)] transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── Custom Cursor ────────────────────────────────────────────────────────────

function CustomCursor() {
  const cursorDot = useRef<HTMLDivElement>(null)
  const cursorRing = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)
  const [clicking, setClicking] = useState(false)
  // Only enable the custom cursor on precise-pointer devices. Touch / coarse
  // devices fall back to the native pointer (see the matching CSS media query).
  const [enabled] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches,
  )
  const pos = useRef({ x: -100, y: -100 })
  const ringPos = useRef({ x: -100, y: -100 })
  const rafId = useRef<number>(0)

  useEffect(() => {
    if (!enabled) return
    const onMove = (e: MouseEvent) => {
      pos.current = { x: e.clientX, y: e.clientY }
    }

    const onEnter = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      const isInteractive =
        t.closest("a, button, input") !== null ||
        t.tagName === "A" ||
        t.tagName === "BUTTON" ||
        t.tagName === "INPUT"
      setHovered(isInteractive)
    }

    const onDown = () => setClicking(true)
    const onUp = () => setClicking(false)

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseover", onEnter)
    window.addEventListener("mousedown", onDown)
    window.addEventListener("mouseup", onUp)

    // Lerp ring toward dot each frame
    const animate = () => {
      const speed = 0.12
      ringPos.current.x += (pos.current.x - ringPos.current.x) * speed
      ringPos.current.y += (pos.current.y - ringPos.current.y) * speed

      if (cursorDot.current) {
        cursorDot.current.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px) translate(-50%, -50%)`
      }
      if (cursorRing.current) {
        cursorRing.current.style.transform = `translate(${ringPos.current.x}px, ${ringPos.current.y}px) translate(-50%, -50%)`
      }
      rafId.current = requestAnimationFrame(animate)
    }
    rafId.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseover", onEnter)
      window.removeEventListener("mousedown", onDown)
      window.removeEventListener("mouseup", onUp)
      cancelAnimationFrame(rafId.current)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <>
      {/* Dot — snaps directly to cursor */}
      <div
        ref={cursorDot}
        className="fixed top-0 left-0 z-[100000] pointer-events-none will-change-transform"
        style={{
          width: clicking ? 6 : hovered ? 8 : 5,
          height: clicking ? 6 : hovered ? 8 : 5,
          borderRadius: "50%",
          backgroundColor: hovered ? "var(--accent)" : "var(--foreground)",
          transition:
            "width 0.15s ease, height 0.15s ease, background-color 0.2s ease",
        }}
      />
      {/* Ring — lags behind for fluidity */}
      <div
        ref={cursorRing}
        className="fixed top-0 left-0 z-[99999] pointer-events-none will-change-transform flex items-center justify-center"
        style={{
          width: hovered ? 48 : clicking ? 24 : 32,
          height: hovered ? 48 : clicking ? 24 : 32,
          borderRadius: "50%",
          border: `1.5px solid ${
            hovered ? "var(--accent)" : "var(--foreground)"
          }`,
          opacity: hovered ? 0.5 : 0.2,
          backdropFilter: "none",
          transition:
            "width 0.35s cubic-bezier(0.22,1,0.36,1), height 0.35s cubic-bezier(0.22,1,0.36,1), opacity 0.2s ease, border-color 0.2s ease",
        }}
      ></div>
    </>
  )
}

// ─── Scroll Progress Bar ──────────────────────────────────────────────────────

function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 28,
    restDelta: 0.001,
  })

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-[9997] origin-left pointer-events-none"
      style={{
        height: 2,
        scaleX,
        backgroundColor: "var(--accent)",
      }}
    />
  )
}

// ─── Intro Animation ─────────────────────────────────────────────────────────

const SUBTITLE_TEXT = "Software Engineer · AI Developer"

function IntroOverlay({
  parallax,
  onSkip,
}: {
  parallax: PointerParallax
  onSkip?: () => void
}) {
  const [showSubtitle, setShowSubtitle] = useState(false)
  const [hideSubtitle, setHideSubtitle] = useState(false)
  const [scrambleActive, setScrambleActive] = useState(false)
  const [progress, setProgress] = useState(0)

  // Decode-in effect: scrambles through glyphs left-to-right until the real text is revealed.
  const scrambledSubtitle = useScramble(SUBTITLE_TEXT, scrambleActive, 750)

  const { enabled, px, py, nx, ny, coords } = parallax

  // Trailing glow position (offset so the blurred circle centres on the cursor).
  const glowX = useTransform(px, (v) => v - 260)
  const glowY = useTransform(py, (v) => v - 260)
  // Subtitle drifts a touch against the pointer for depth.
  const subX = useTransform(nx, [-1, 1], [8, -8])
  // Per-corner bracket parallax — opposite directions read as depth.
  const brTLx = useTransform(nx, [-1, 1], [-10, 10])
  const brTLy = useTransform(ny, [-1, 1], [-10, 10])
  const brTRx = useTransform(nx, [-1, 1], [10, -10])
  const brTRy = useTransform(ny, [-1, 1], [-10, 10])
  const brBLx = useTransform(nx, [-1, 1], [-10, 10])
  const brBLy = useTransform(ny, [-1, 1], [10, -10])
  const brBRx = useTransform(nx, [-1, 1], [10, -10])
  const brBRy = useTransform(ny, [-1, 1], [10, -10])

  // Allow ESC or Space to skip intro
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " ") {
        onSkip?.()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onSkip])

  useEffect(() => {
    // Subtitle rises in and scramble-decodes after the name, and holds smoothly
    const tIn = setTimeout(() => {
      setShowSubtitle(true)
      setScrambleActive(true)
    }, 900)
    const tOut = setTimeout(() => setHideSubtitle(true), 2100)
    return () => {
      clearTimeout(tIn)
      clearTimeout(tOut)
    }
  }, [])

  // Progress 0→1 over ~2.1s (leaves last 300ms as hold before exit)
  useEffect(() => {
    const start = performance.now()
    const duration = 2100
    let rafId: number
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      setProgress(p)
      if (p < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <motion.div
      onClick={onSkip}
      className="fixed inset-0 z-[9000] flex flex-col items-center justify-center overflow-hidden cursor-pointer"
      style={{ backgroundColor: "var(--background)" }}
      aria-hidden="true"
      role="presentation"
      exit={{
        y: "-100%",
        transition: { duration: 0.55, ease: [0.76, 0, 0.24, 1] },
      }}
    >
      {/* Top Skip HUD button */}
      <motion.button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onSkip?.()
        }}
        className="absolute top-7 right-8 md:top-11 md:right-14 z-30 font-mono text-[9px] tracking-widest uppercase px-2 py-0.5 rounded-sm border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all cursor-pointer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.8 }}
        transition={{ delay: 0.4 }}
      >
        [ESC / SKIP ↵]
      </motion.button>
      {/* Cursor-reactive layers — precise pointers only */}
      {enabled && (
        <>
          {/* Trailing spotlight — a soft accent light that lags behind the cursor */}
          <motion.div
            className="absolute pointer-events-none"
            style={{
              width: 520,
              height: 520,
              left: 0,
              top: 0,
              x: glowX,
              y: glowY,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, var(--accent) 0%, transparent 62%)",
              opacity: 0.14,
              filter: "blur(28px)",
            }}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.14 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          />
          {/* Crosshair hairlines — track the cursor like a design tool */}
          <motion.div
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              top: 0,
              y: py,
              height: 1,
              background: "var(--accent)",
              opacity: 0.12,
            }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          />
          <motion.div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: 0,
              x: px,
              width: 1,
              background: "var(--accent)",
              opacity: 0.12,
            }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          />
        </>
      )}

      {/* Corner accent brackets */}
      <motion.div
        className="absolute top-8 left-8 md:top-12 md:left-14"
        style={{
          width: 28,
          height: 28,
          borderTop: "1px solid var(--accent)",
          borderLeft: "1px solid var(--accent)",
          x: enabled ? brTLx : 0,
          y: enabled ? brTLy : 0,
        }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
      />
      <motion.div
        className="absolute top-8 right-8 md:top-12 md:right-14"
        style={{
          width: 28,
          height: 28,
          borderTop: "1px solid var(--accent)",
          borderRight: "1px solid var(--accent)",
          x: enabled ? brTRx : 0,
          y: enabled ? brTRy : 0,
        }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
      />
      <motion.div
        className="absolute bottom-8 left-8 md:bottom-12 md:left-14"
        style={{
          width: 28,
          height: 28,
          borderBottom: "1px solid var(--accent)",
          borderLeft: "1px solid var(--accent)",
          x: enabled ? brBLx : 0,
          y: enabled ? brBLy : 0,
        }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.11 }}
      />
      <motion.div
        className="absolute bottom-8 right-8 md:bottom-12 md:right-14"
        style={{
          width: 28,
          height: 28,
          borderBottom: "1px solid var(--accent)",
          borderRight: "1px solid var(--accent)",
          x: enabled ? brBRx : 0,
          y: enabled ? brBRy : 0,
        }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.14 }}
      />

      {/* Spacer — mirrors the height of the name */}
      <div style={{ height: "clamp(96px, 16vw, 220px)" }} />

      {/* Subtitle — rises in and scramble-decodes after the name */}
      <motion.p
        className="font-body uppercase mt-5"
        style={{
          fontSize: 9,
          letterSpacing: "0.26em",
          color: "var(--muted-foreground)",
          x: enabled ? subX : 0,
          fontVariantNumeric: "tabular-nums",
        }}
        initial={{ opacity: 0, y: 10 }}
        animate={{
          opacity: showSubtitle && !hideSubtitle ? 1 : 0,
          y: hideSubtitle ? -6 : showSubtitle ? 0 : 10,
        }}
        transition={{
          duration: hideSubtitle ? 0.35 : 0.55,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {scrambledSubtitle}
      </motion.p>

      {/* Bottom-edge gradient — gives the curtain a visible lower boundary
          against the identical-coloured hero beneath it */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: 80,
          background:
            "linear-gradient(to bottom, transparent, rgba(17,17,16,0.06))",
        }}
      />

      {/* Bottom progress bar + counter */}
      <motion.div
        className="absolute bottom-8 left-8 md:bottom-12 md:left-14 right-8 md:right-14"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-2">
          <span
            className="font-body"
            style={{
              fontSize: 9,
              letterSpacing: "0.12em",
              color: "var(--muted-foreground)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {String(Math.round(progress * 100)).padStart(3, "0")}
          </span>
          {enabled && (
            <span
              className="font-body hidden sm:block"
              style={{
                fontSize: 9,
                letterSpacing: "0.16em",
                color: "var(--muted-foreground)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {coords}
            </span>
          )}
          <span
            className="font-body uppercase"
            style={{
              fontSize: 9,
              letterSpacing: "0.2em",
              color: "var(--muted-foreground)",
            }}
          >
            Mumbai, IN
          </span>
        </div>
        {/* Track */}
        <div
          className="w-full"
          style={{ height: 1, background: "var(--border)" }}
        >
          <motion.div
            style={{
              height: "100%",
              background: "var(--accent)",
              transformOrigin: "left center",
              scaleX: progress,
            }}
          />
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Intro name — per-character reveal ─────────────────────────────────────────

// One word, split into letters that rise + unblur in a stagger. Lives inside the
// layoutId <h1>; the letters settle before the morph fires, so the shared-layout
// travel is unaffected.
function IntroWord({ text, start }: { text: string; start: number }) {
  return (
    <span style={{ display: "inline-block" }}>
      {text.split("").map((ch, i) => (
        <motion.span
          key={i}
          style={{ display: "inline-block", willChange: "transform" }}
          initial={{ y: "0.72em", opacity: 0, filter: "blur(6px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          transition={{
            duration: 0.7,
            ease: [0.22, 1, 0.36, 1],
            delay: start + i * 0.045,
          }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ff-theme")
      if (stored === "dark" || stored === "light") return stored
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
    }
    return "light"
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
    localStorage.setItem("ff-theme", theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"))
  }

  const [introActive, setIntroActive] = useState(() => {
    // prefers-reduced-motion: skip intro entirely
    if (typeof window !== "undefined") {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        return false
      // sessionStorage: only play once per session
      if (sessionStorage.getItem("ff-intro-played")) return false
    }
    return true
  })

  // True for the brief window while the name morphs from the intro centre into
  // the hero position. During this window the hero name is lifted above the
  // curtain overlay so the leftward travel is actually visible.
  const [nameSettling, setNameSettling] = useState(false)

  // Dedicated effect ensuring nameSettling always resets cleanly after 1300ms
  useEffect(() => {
    if (!nameSettling) return
    const t = setTimeout(() => setNameSettling(false), 1300)
    return () => clearTimeout(t)
  }, [nameSettling])

  // Shared cursor state — listener is active only during the intro.
  const parallax = usePointerParallax(introActive)
  // Gentle name drift — applied to a WRAPPER, never the layoutId <h1>, so the
  // morph's transform is untouched. Small magnitude; the block unmounts at the
  // morph so the "from" snapshot is effectively unaffected.
  const nameDriftX = useTransform(parallax.nx, [-1, 1], [-6, 6])
  const nameDriftY = useTransform(parallax.ny, [-1, 1], [-6, 6])

  useEffect(() => {
    if (!introActive) return

    // Lock scrolling during intro
    document.body.style.overflow = "hidden"

    // 2.2s: name reveals 0–1.0s → subtitle scrambles at 0.9s → progress fills by 2.1s →
    // 100ms hold → curtain lifts at 2.2s in sync with the 1.15s name morph.
    const t = setTimeout(() => {
      setIntroActive(false)
      setNameSettling(true)
      document.body.style.overflow = ""
      sessionStorage.setItem("ff-intro-played", "1")
    }, 2200)

    return () => {
      clearTimeout(t)
      document.body.style.overflow = ""
    }
  }, [introActive])

  const handleSkipIntro = () => {
    if (!introActive) return
    setIntroActive(false)
    setNameSettling(true)
    document.body.style.overflow = ""
    sessionStorage.setItem("ff-intro-played", "1")
  }

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Global Command Palette shortcut (⌘K / Ctrl+K)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setCommandPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  // Guarantee scroll restoration whenever Command Palette is closed
  useEffect(() => {
    if (!commandPaletteOpen && !introActive) {
      document.body.style.overflow = ""
    }
  }, [commandPaletteOpen, introActive])

  return (
    <LayoutGroup>
      <div style={{ backgroundColor: "var(--background)", minHeight: "100vh" }}>
        {/* Skip to content — first tab stop for keyboard users */}
        <a href="#main" className="skip-link">
          Skip to content
        </a>

        {/* Overlay (same-colour bg + decorations) — fades out when introActive → false */}
        <AnimatePresence>
          {introActive && (
            <IntroOverlay
              key="intro-overlay"
              parallax={parallax}
              onSkip={handleSkipIntro}
            />
          )}
        </AnimatePresence>

        {/* The name lives here while intro is active — fixed, centred, z above overlay */}
        {introActive && (
          <motion.div
            className="fixed inset-0 z-[9001] flex items-center justify-center pointer-events-none"
            style={{
              x: parallax.enabled ? nameDriftX : 0,
              y: parallax.enabled ? nameDriftY : 0,
            }}
          >
            <motion.h1
              layoutId="site-name"
              className="font-display font-bold"
              style={{
                fontSize: "clamp(40px, 7vw, 96px)",
                color: "var(--foreground)",
                letterSpacing: "-0.03em",
                lineHeight: 1,
                textAlign: "left",
                transformOrigin: "left top",
                willChange: "transform",
                backfaceVisibility: "hidden",
              }}
              initial={false}
              transition={{
                layout: { duration: 1.15, ease: [0.16, 1, 0.3, 1] },
              }}
            >
              <IntroWord text="Furkan" start={0} />
              <br />
              <IntroWord text="Farooqui" start={0.24} />
            </motion.h1>
          </motion.div>
        )}

        <ScrollProgress />
        <Nav
          introActive={introActive}
          theme={theme}
          toggleTheme={toggleTheme}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />
        <main id="main">
          <Hero introActive={introActive} nameSettling={nameSettling} />
          <Work />
          <About />
          <Skills />
          <Experience />
          <Certifications />
          <Contact />
        </main>
        <Footer />

        {/* Command Palette Modal */}
        <AnimatePresence>
          {commandPaletteOpen && (
            <CommandPalette
              isOpen={commandPaletteOpen}
              onClose={() => {
                setCommandPaletteOpen(false)
                document.body.style.overflow = ""
              }}
              theme={theme}
              toggleTheme={toggleTheme}
            />
          )}
        </AnimatePresence>

        {/* Custom Cursor — rendered at root end with z-[100000] so it stays above all modals */}
        <CustomCursor />
      </div>
    </LayoutGroup>
  )
}
