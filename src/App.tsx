import { useState, useEffect, useRef } from 'react'
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
} from 'motion/react'

// ─── Animation helpers ────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.72, ease: [0.22, 1, 0.36, 1], delay },
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
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      variants={fadeUp}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
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
    const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·'
    const total = text.length
    const start = performance.now()
    let rafId = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const revealed = Math.floor(p * total)
      let s = ''
      for (let i = 0; i < total; i++) {
        const ch = text[i]
        if (i < revealed || ch === ' ') s += ch
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
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  // Start centred so the first frame is calm.
  const rawX = useMotionValue(typeof window !== 'undefined' ? window.innerWidth / 2 : 0)
  const rawY = useMotionValue(typeof window !== 'undefined' ? window.innerHeight / 2 : 0)
  const rawNX = useMotionValue(0)
  const rawNY = useMotionValue(0)

  const px = useSpring(rawX, { stiffness: 60, damping: 18, restDelta: 0.5 })
  const py = useSpring(rawY, { stiffness: 60, damping: 18, restDelta: 0.5 })
  const nx = useSpring(rawNX, { stiffness: 55, damping: 20, restDelta: 0.001 })
  const ny = useSpring(rawNY, { stiffness: 55, damping: 20, restDelta: 0.001 })

  const [coords, setCoords] = useState('X +0.00  Y +0.00')

  // Keep a ref to `active` so we can check it inside the handler without
  // adding it to the deps array (avoids a deps-size change between renders).
  const activeRef = useRef(active)
  useEffect(() => { activeRef.current = active }, [active])

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
          const fmt = (n: number) => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(2)
          setCoords(`X ${fmt(lastNX)}  Y ${fmt(lastNY)}`)
        })
      }
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [enabled, rawX, rawY, rawNX, rawNY])

  return { enabled, px, py, nx, ny, coords }
}

// ─── Data ────────────────────────────────────────────────────────────────────

const projects = [
  {
    id: '01',
    title: 'NutriScan',
    category: 'AI · Full-Stack Development',
    year: '2024',
    description: 'AI-powered platform that scans food and medicine labels to analyze nutrition, detect allergens, and suggest healthier alternatives.',
    metric: 'Live · Next.js on Vercel',
    image: `${import.meta.env.BASE_URL}images/Nutriscanpage1.webp`,
    alt: 'NutriScan app screenshot',
    wide: true,
    href: 'https://nutriscann.vercel.app',
  },
  {
    id: '02',
    title: 'Skin Disease Detection',
    category: 'Machine Learning · React.js',
    year: '2024',
    description: 'Frontend of an ML-powered web app for skin disease detection — responsive UI with image upload and real-time model results.',
    metric: 'Real-time inference · React UI',
    image: `${import.meta.env.BASE_URL}images/SkinDiseaseDetectionUsingML5.webp`,
    alt: 'Skin Disease Detection app screenshot',
    wide: false,
    href: 'https://github.com/aatikakhan/skin-disease-prediction',
  },
  {
    id: '03',
    title: 'Translify',
    category: 'GenAI · AWS · Full-Stack',
    year: '2024',
    description: 'GenAI-based PDF language translator deployed on AWS — extracts text, translates via AI, and regenerates the translated PDF.',
    metric: 'Deployed on AWS · PDF in → PDF out',
    image: `${import.meta.env.BASE_URL}images/Translify.webp`,
    alt: 'Translify app screenshot',
    wide: true,
    href: 'https://github.com/aatikakhan/translify',
  },
  {
    id: '04',
    title: 'Movie Recommender',
    category: 'Machine Learning · NLP',
    year: '2023',
    description: 'NLP-driven recommendation system using cosine similarity, Scikit-learn, and TMDB API with a Streamlit interface.',
    metric: 'Cosine similarity · TMDB API',
    image: `${import.meta.env.BASE_URL}images/MovieRecommendationSystem.webp`,
    alt: 'Movie Recommender app screenshot',
    wide: false,
    href: 'https://github.com/FurkanFarooqui19/movie-recommender-system',
  },
]

const skillGroups = [
  { label: 'Frontend', items: ['React', 'Next.js', 'TypeScript', 'JavaScript', 'Tailwind CSS'] },
  { label: 'Backend', items: ['Node.js', 'Express.js', 'Python', 'Django'] },
  { label: 'Databases', items: ['MySQL', 'MongoDB'] },
  { label: 'AI & Machine Learning', items: ['PyTorch', 'TensorFlow', 'Scikit-learn', 'OpenCV', 'Hugging Face'] },
  { label: 'Cloud & DevOps', items: ['AWS', 'Docker', 'Git', 'GitHub'] },
  { label: 'Tools', items: ['Postman', 'VS Code', 'Figma'] },
]

const experience = [
  {
    role: 'Software Engineering Intern',
    org: 'Matrix3D Infocom Pvt. Ltd.',
    year: 'Oct 2025 – Jan 2026',
    desc: 'Cut manual data-entry effort by enabling bulk vulnerability uploads; shipped search, pagination, and filtering that reduced average lookup time across 100+ projects. Delivered dashboards, audit logs, and timeline views for live progress tracking. Hardened auth flows, mapped backend errors to clear UI messages, and authored SRS, SAD, and full test plans.',
  },
  {
    role: 'Mathematics Teacher',
    org: 'Freelance',
    year: 'Aug 2023 – Jan 2024',
    desc: 'Helped students aged 13–17 achieve strong academic outcomes, with many scoring 90+ in Mathematics. Simplified complex concepts through individualized mentoring.',
  },
]

const certifications = [
  { title: 'Scientific Computing with Python', org: 'freeCodeCamp', href: 'https://www.freecodecamp.org/certification/furkan19/scientific-computing-with-python-v7' },
  { title: 'Microprocessors and Interfacing', org: 'NPTEL', href: 'https://drive.google.com/file/d/1nlAppiPKGoPq-CpMRyQDJUyy_2RGsYSg/view?usp=sharing' },
  { title: 'AWS Cloud Foundations', org: 'AWS Academy', href: 'https://www.credly.com/go/hkTRq8CE' },
]

// ─── Nav ─────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Work',       id: 'work'    },
  { label: 'About',      id: 'about'   },
  { label: 'Experience', id: 'exp'     },
  { label: 'Contact',    id: 'contact' },
] as const

function Nav({ introActive }: { introActive: boolean }) {
  const [scrolled, setScrolled] = useState(false)
  const [active, setActive] = useState<string>('')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Scroll spy — marks whichever nav section is in view; clears when hero is visible
  useEffect(() => {
    const navIds = NAV_ITEMS.map((n) => n.id)
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          if (entry.target.id === 'hero') {
            setActive('')
          } else {
            setActive(entry.target.id)
          }
        })
      },
      { threshold: 0.2, rootMargin: '-56px 0px -40% 0px' }
    )
    ;['hero', ...navIds].forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      style={{
        backgroundColor: scrolled ? 'rgba(244,242,237,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
      }}
      initial={{ y: -48, opacity: 0 }}
      animate={{ y: introActive ? -48 : 0, opacity: introActive ? 0 : 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: introActive ? 0 : 0.22 }}
    >
      <div className="max-w-[1440px] mx-auto px-8 md:px-16 flex items-center justify-between h-14">
        <a
          href="#hero"
          className="font-display text-sm font-medium tracking-tight"
          style={{ color: 'var(--foreground)' }}
        >
          Furkan Farooqui
        </a>
        <div className="flex items-center gap-6 md:gap-8">
          {NAV_ITEMS.map(({ label, id }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="nav-link font-body text-xs font-medium tracking-widest uppercase"
              style={{ color: active === id ? 'var(--foreground)' : 'var(--muted-foreground)' }}
            >
              {label}
              {active === id && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute bottom-[-1px] left-0 right-0"
                  style={{ height: 1, background: 'var(--foreground)' }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
            </a>
          ))}
        </div>
      </div>
    </motion.nav>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ introActive, nameSettling }: { introActive: boolean; nameSettling: boolean }) {
  // All hero content reveals are driven purely by introActive flipping to false.
  // Each group gets a small delay offset so they stagger in while the name morphs.
  const shown = !introActive
  return (
    <section
      id="hero"
      className="relative min-h-screen flex flex-col justify-between pt-14"
      style={{ backgroundColor: 'var(--background)' }}
    >
      {/* Top bar */}
      <motion.div
        className="max-w-[1440px] mx-auto w-full px-8 md:px-16 pt-16 pb-4 flex items-start justify-between"
        style={{ borderBottom: '1px solid var(--border)' }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : 6 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: shown ? 1.0 : 0 }}
      >
        <div className="flex items-center gap-2">
          <span className="accent-dot" />
          <span
            className="font-body text-xs tracking-widest uppercase"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Available for work
          </span>
        </div>
        <span
          className="font-body text-xs tracking-wide"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Based in Mumbai, IN
        </span>
      </motion.div>

      {/* Display name */}
      <div className="max-w-[1440px] mx-auto w-full px-8 md:px-16 flex-1 flex flex-col justify-center py-12">
        <div className="relative">
          {/* Name — layoutId morphs from intro centre on first visit; fades in on return visits */}
          {shown && (
            <motion.h1
              layoutId="site-name"
              className="font-display font-bold leading-none tracking-tight select-none"
              style={{
                fontSize: 'clamp(58px, 9.5vw, 148px)',
                letterSpacing: '-0.03em',
                color: 'var(--foreground)',
                transformOrigin: 'left top',
                // Lift above the curtain overlay (z 9000) only while the name is
                // travelling from the intro centre, so the morph is visible.
                position: nameSettling ? 'relative' : undefined,
                zIndex: nameSettling ? 9002 : undefined,
                willChange: nameSettling ? 'transform' : undefined,
                backfaceVisibility: 'hidden',
              }}
              // Stay fully visible so the shared-layout morph itself is what the
              // eye follows: the intro name travels from screen-centre and scales
              // up into this hero position rather than cross-fading.
              initial={false}
              transition={{
                layout: { duration: 1.15, ease: [0.16, 1, 0.3, 1] },
              }}
            >
              Furkan<br />Farooqui
            </motion.h1>
          )}

          {/* Floating tag — appears while name is still landing */}
          <motion.div
            className="absolute right-0 top-4 max-w-xs text-right hidden md:block"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: shown ? 1 : 0, x: shown ? 0 : 12 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: shown ? 1.15 : 0 }}
          >
            <p
              className="font-body text-xs tracking-widest uppercase mb-3"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Software Engineer &amp; Creative Developer
            </p>
            <p
              className="font-body text-sm leading-relaxed"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Shipping full-stack products and<br />ML systems that reach real users.
            </p>
          </motion.div>
        </div>

        {/* Mobile subtitle */}
        <motion.div
          className="md:hidden mt-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : 10 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: shown ? 1.15 : 0 }}
        >
          <p
            className="font-body text-xs tracking-widest uppercase mb-2"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Software Engineer &amp; Creative Developer
          </p>
          <p
            className="font-body text-sm leading-relaxed"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Shipping full-stack products and ML systems that reach real users.
          </p>
        </motion.div>
      </div>

      {/* Bottom CTA row */}
      <motion.div
        className="max-w-[1440px] mx-auto w-full px-8 md:px-16 pb-12 flex items-center justify-between"
        style={{ borderTop: '1px solid var(--border)' }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : 10 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: shown ? 1.3 : 0 }}
      >
        <div className="flex items-center gap-6 mt-6 flex-wrap">
          <a
            href="https://cal.com/furkan-farooqui/lets-talk"
            target="_blank"
            rel="noopener noreferrer"
            className="cta-arrow font-body text-sm font-medium"
            style={{ color: 'var(--foreground)' }}
          >
            <span>Let&apos;s talk</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
          <a
            href="https://docs.google.com/document/d/1lyLr8Vogq80FM_RAnm4zorN_KZCEr0BcboI-y-4BJP8/export?format=pdf"
            download="Furkan_Farooqui_Resume.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="cta-arrow font-body text-sm font-medium flex items-center gap-2 px-4 py-2 transition-colors duration-200"
            style={{
              color: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget
              el.style.backgroundColor = 'var(--accent)'
              el.style.color = 'var(--accent-foreground)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.backgroundColor = 'transparent'
              el.style.color = 'var(--accent)'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 2v8M8 10l-3-3M8 10l3-3M3 13h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Download Résumé</span>
          </a>
        </div>
        <span aria-hidden="true" />
      </motion.div>

      {/* Decorative vertical line — draws in when hero reveals */}
      <motion.div
        className="absolute right-16 top-1/2 -translate-y-1/2 hidden xl:block"
        style={{ width: '1px', background: 'var(--border)', originY: 0 }}
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: shown ? '30vh' : 0, opacity: shown ? 1 : 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: shown ? 1.4 : 0 }}
      />
    </section>
  )
}

// ─── Selected Work ────────────────────────────────────────────────────────────

function ProjectItem({ project, index }: { project: typeof projects[0]; index: number }) {
  const isEven = index % 2 === 0
  const lazy = index > 0

  if (project.wide) {
    // Full-width editorial block
    return (
      <motion.article
        className="group relative"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="max-w-[1440px] mx-auto px-8 md:px-16 py-6 flex items-end justify-between"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div className="flex items-baseline gap-6">
            <span
              className="font-display text-xs"
              style={{ color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}
            >
              {project.id}
            </span>
            <h3
              className="project-title font-display font-medium"
              style={{ fontSize: 'clamp(24px, 3.5vw, 52px)', letterSpacing: '-0.02em', color: 'var(--foreground)' }}
            >
              {project.title}
            </h3>
          </div>
          <div className="hidden md:flex items-center gap-8 text-right">
            <span
              className="font-body text-xs tracking-widest uppercase"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {project.category}
            </span>
            <span
              className="font-body text-xs"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {project.year}
            </span>
          </div>
        </div>
        <div className="max-w-[1440px] mx-auto px-8 md:px-16 pb-4">
          <div
            className="project-image-wrap w-full bg-[var(--card)]"
            style={{ height: 'clamp(280px, 42vw, 580px)' }}
            data-cursor="View"
          >
            <img
              src={project.image}
              alt={project.alt}
              className="w-full h-full object-cover"
              loading={lazy ? 'lazy' : undefined}
            />
          </div>
        </div>
        <div className="max-w-[1440px] mx-auto px-8 md:px-16 pt-3 pb-8 flex items-center justify-between">
          <div style={{ maxWidth: 420 }}>
            <span
              className="font-body text-xs tracking-widest uppercase block mb-2"
              style={{ color: 'var(--accent)' }}
            >
              {project.metric}
            </span>
            <p
              className="font-body text-sm"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {project.description}
            </p>
          </div>
          <a
            href={project.href}
            target="_blank"
            rel="noopener noreferrer"
            className="cta-arrow font-body text-xs font-medium hidden md:inline-flex"
            style={{ color: 'var(--foreground)' }}
          >
            <span>View project</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>
      </motion.article>
    )
  }

  // Asymmetric split — alternating left/right
  return (
    <motion.article
      className="max-w-[1440px] mx-auto px-8 md:px-16 py-10 md:py-16"
      style={{ borderTop: '1px solid var(--border)' }}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className={`flex flex-col ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'} gap-8 md:gap-16 items-end`}
      >
        {/* Image — narrower, portrait ratio */}
        <div
          className="project-image-wrap bg-[var(--card)] w-full md:w-5/12 flex-shrink-0"
          style={{ height: 'clamp(240px, 36vw, 520px)' }}
          data-cursor="View"
        >
          <img
            src={project.image}
            alt={project.alt}
            className="w-full h-full object-cover"
            loading={lazy ? 'lazy' : undefined}
          />
        </div>

        {/* Text — positioned at bottom via items-end parent */}
        <div className={`w-full md:w-7/12 flex flex-col justify-end pb-2 ${isEven ? 'md:pl-8' : 'md:pr-8'}`}>
          <div className="flex items-baseline gap-4 mb-4">
            <span
              className="font-display text-xs"
              style={{ color: 'var(--accent)' }}
            >
              {project.id}
            </span>
            <span
              className="font-body text-xs tracking-widest uppercase"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {project.category}
            </span>
          </div>
          <h3
            className="font-display font-medium mb-4"
            style={{ fontSize: 'clamp(32px, 4.5vw, 64px)', letterSpacing: '-0.025em', color: 'var(--foreground)', lineHeight: 1.05 }}
          >
            {project.title}
          </h3>
          <span
            className="font-body text-xs tracking-widest uppercase block mb-2"
            style={{ color: 'var(--accent)' }}
          >
            {project.metric}
          </span>
          <p
            className="font-body text-sm leading-relaxed mb-6"
            style={{ color: 'var(--muted-foreground)', maxWidth: 340 }}
          >
            {project.description}
          </p>
          <div className="flex items-center justify-between">
            <a
              href={project.href}
              target="_blank"
              rel="noopener noreferrer"
              className="cta-arrow font-body text-xs font-medium"
              style={{ color: 'var(--foreground)' }}
            >
              <span>View project</span>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
            <span
              className="font-body text-xs"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {project.year}
            </span>
          </div>
        </div>
      </div>
    </motion.article>
  )
}

function Work() {
  return (
    <section id="work" className="pt-24 pb-8" style={{ backgroundColor: 'var(--background)' }}>
      <FadeUp className="max-w-[1440px] mx-auto px-8 md:px-16 pb-10 flex items-end justify-between">
        <h2
          className="font-display font-medium"
          style={{ fontSize: 'clamp(11px, 1vw, 13px)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}
        >
          Selected Work
        </h2>
        <span
          className="font-body text-xs"
          style={{ color: 'var(--muted-foreground)' }}
        >
          2023 – 2024
        </span>
      </FadeUp>
      {projects.map((project, i) => (
        <ProjectItem key={project.id} project={project} index={i} />
      ))}
    </section>
  )
}

// ─── About ────────────────────────────────────────────────────────────────────

function About() {
  const disciplines = [
    { title: 'AI & ML Integration', desc: 'Applying machine learning and generative AI to real products — from NLP to computer vision.' },
    { title: 'Full-Stack Engineering', desc: 'End-to-end systems using Django, REST APIs, and cloud infrastructure on AWS.' },
    { title: 'Open Source Contributor', desc: 'Contributing to public repositories, raising issues, and shipping improvements to projects used by real developers.' },
    { title: 'Problem Solving', desc: 'Breaking down complex requirements into clean, maintainable implementations.' },
  ]

  return (
    <section id="about" className="py-24 md:py-36" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-[1440px] mx-auto px-8 md:px-16">
        {/* Section label */}
        <FadeUp>
          <p
            className="font-body text-xs tracking-widest uppercase mb-16"
            style={{ color: 'var(--muted-foreground)' }}
          >
            About
          </p>
        </FadeUp>

        {/* Statement */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-y-12 gap-x-8">
          <FadeUp className="md:col-span-9" delay={0.1}>
            <h2
              className="font-display font-light italic leading-tight"
              style={{
                fontSize: 'clamp(28px, 4.2vw, 60px)',
                letterSpacing: '-0.02em',
                color: 'var(--foreground)',
              }}
            >
              <span
                className="font-display not-italic block leading-none select-none"
                style={{
                  fontSize: 'clamp(60px, 9vw, 128px)',
                  color: 'var(--accent)',
                  opacity: 0.35,
                  marginBottom: '-0.12em',
                  lineHeight: 0.8,
                }}
                aria-hidden="true"
              >
                &ldquo;
              </span>
              I turn ambiguous problems into full-stack products and ML systems that ship and get used.
            </h2>
          </FadeUp>
          <FadeUp className="md:col-span-3 md:pt-4 flex flex-col justify-end" delay={0.2}>
            <p
              className="font-body text-sm leading-relaxed"
              style={{ color: 'var(--muted-foreground)' }}
            >
              I&apos;m a Mumbai-based software engineer pursuing a B.E. in Computer Engineering (2023–2027). I build full-stack web products and ML-driven systems — drawn to the intersection where rigorous engineering and intentional design produce things people actually want to use.
            </p>
          </FadeUp>
        </div>

        {/* Divider */}
        <div className="divider mt-20 mb-16" />

        {/* Disciplines grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-px" style={{ border: '1px solid var(--border)' }}>
          {disciplines.map((d, i) => (
            <motion.div
              key={i}
              className="p-6 md:p-8"
              style={{ backgroundColor: 'var(--background)', borderRight: i < 3 ? '1px solid var(--border)' : undefined }}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: i * 0.1 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="font-display text-xs"
                  style={{ color: 'var(--accent)' }}
                >
                  0{i + 1}
                </span>
              </div>
              <h3
                className="font-display font-medium text-base mb-3"
                style={{ color: 'var(--foreground)', letterSpacing: '-0.01em' }}
              >
                {d.title}
              </h3>
              <p
                className="font-body text-xs leading-relaxed"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {d.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Skills ───────────────────────────────────────────────────────────────────

function Skills() {
  return (
    <section
      className="py-16 md:py-24"
      style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--background)' }}
    >
      <div className="max-w-[1440px] mx-auto px-8 md:px-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <FadeUp className="md:col-span-3">
            <p
              className="font-body text-xs tracking-widest uppercase"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Technologies
            </p>
          </FadeUp>

          <div className="md:col-span-9">
            {skillGroups.map((group, gi) => (
              <motion.div
                key={group.label}
                className="py-6 md:py-7 grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-8 items-baseline"
                style={{ borderTop: '1px solid var(--border)' }}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: gi * 0.1 }}
              >
                <p
                  className="sm:col-span-3 font-body text-[11px] tracking-widest uppercase"
                  style={{ color: 'var(--accent)' }}
                >
                  {group.label}
                </p>
                <div className="sm:col-span-9 flex flex-wrap items-baseline gap-x-1">
                  {group.items.map((item, i) => (
                    <span key={item} className="inline-flex items-baseline">
                      <span
                        className="skill-item font-display font-light cursor-default"
                        style={{
                          fontSize: 'clamp(22px, 3.2vw, 44px)',
                          letterSpacing: '-0.02em',
                          color: 'var(--foreground)',
                          lineHeight: 1.15,
                        }}
                      >
                        {item}
                      </span>
                      {i < group.items.length - 1 && (
                        <span
                          className="inline-block mx-2 align-middle"
                          style={{ color: 'var(--accent)', fontSize: '0.7em', lineHeight: 1 }}
                        >
                          /
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
            <div className="divider" />
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Experience ───────────────────────────────────────────────────────────────

function Experience() {
  return (
    <section
      className="py-16 md:py-28"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <div className="max-w-[1440px] mx-auto px-8 md:px-16">
        <FadeUp>
          <p
            className="font-body text-xs tracking-widest uppercase mb-12"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Experience
          </p>
        </FadeUp>
        <div>
          {experience.map((exp, i) => (
            <motion.div
              key={i}
              className="list-row py-7 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 items-baseline"
              style={{ borderTop: '1px solid var(--border)' }}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: i * 0.1 }}
            >
              <div className="md:col-span-5 flex items-baseline gap-3 flex-wrap">
                <span
                  className="font-display font-medium"
                  style={{ fontSize: 'clamp(16px, 1.8vw, 24px)', letterSpacing: '-0.015em', color: 'var(--foreground)' }}
                >
                  {exp.role}
                </span>
                <span style={{ color: 'var(--border)', fontSize: 13 }}>—</span>
                <span
                  className="font-body text-sm"
                  style={{ color: 'var(--accent)' }}
                >
                  {exp.org}
                </span>
              </div>
              <div className="md:col-span-2 md:text-right">
                <span
                  className="font-body text-xs tracking-wide"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {exp.year}
                </span>
              </div>
              <div className="md:col-span-5">
                <p
                  className="font-body text-sm leading-relaxed"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {exp.desc}
                </p>
              </div>
            </motion.div>
          ))}
          <div className="divider" />
        </div>
      </div>
    </section>
  )
}

// ─── Certifications ───────────────────────────────────────────────────────────

function Certifications() {
  return (
    <section
      className="py-16 md:py-24"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <div className="max-w-[1440px] mx-auto px-8 md:px-16">
        <FadeUp>
          <p
            className="font-body text-xs tracking-widest uppercase mb-12"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Certifications
          </p>
        </FadeUp>
        <div>
          {certifications.map((cert, i) => (
            <motion.div
              key={i}
              className="list-row py-6 flex items-center justify-between"
              style={{ borderTop: '1px solid var(--border)' }}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: i * 0.1 }}
            >
              <div className="flex items-baseline gap-6">
                <span
                  className="font-display text-xs"
                  style={{ color: 'var(--accent)' }}
                >
                  0{i + 1}
                </span>
                <div>
                  <span
                    className="font-display font-medium block"
                    style={{ fontSize: 'clamp(15px, 1.6vw, 22px)', letterSpacing: '-0.01em', color: 'var(--foreground)' }}
                  >
                    {cert.title}
                  </span>
                  <span
                    className="font-body text-xs mt-1 block"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {cert.org}
                  </span>
                </div>
              </div>
              <a
                href={cert.href}
                target="_blank"
                rel="noopener noreferrer"
                className="cta-arrow font-body text-xs font-medium"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <span>Certificate</span>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            </motion.div>
          ))}
          <div className="divider" />
        </div>
      </div>
    </section>
  )
}

// ─── Contact ──────────────────────────────────────────────────────────────────

function Contact() {
  const links = [
    { label: 'Email', value: 'furkanahmedfarooqui19@gmail.com', href: 'mailto:furkanahmedfarooqui19@gmail.com' },
    { label: 'GitHub', value: 'github.com/FurkanFarooqui19', href: 'https://github.com/FurkanFarooqui19' },
    { label: 'LinkedIn', value: 'linkedin.com/in/furkan-farooqui', href: 'https://linkedin.com/in/furkan-farooqui' },
    { label: 'X / Twitter', value: 'x.com/furkanfarooqui_', href: 'https://x.com/furkanfarooqui_' },
  ]

  return (
    <section
      id="contact"
      className="py-24 md:py-40"
      style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--background)' }}
    >
      <div className="max-w-[1440px] mx-auto px-8 md:px-16">
        <FadeUp>
          <p
            className="font-body text-xs tracking-widest uppercase mb-10"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Contact
          </p>
        </FadeUp>

        {/* Big heading */}
        <FadeUp delay={0.1}>
          <h2
            className="font-display font-medium leading-tight mb-16 md:mb-24"
            style={{
              fontSize: 'clamp(36px, 6.5vw, 96px)',
              letterSpacing: '-0.03em',
              color: 'var(--foreground)',
              maxWidth: '14ch',
            }}
          >
            Let&apos;s create something together.
          </h2>
        </FadeUp>

        {/* Contact links + CTA */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-end">
          <FadeUp className="md:col-span-5 space-y-5" delay={0.2}>
            {links.map((link) => (
              <div key={link.label}>
                <span
                  className="font-body text-xs tracking-widest uppercase block mb-1"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {link.label}
                </span>
                <a
                  href={link.href}
                  className="contact-link font-body text-sm font-medium"
                  style={{ color: 'var(--foreground)' }}
                >
                  {link.value}
                </a>
              </div>
            ))}
          </FadeUp>

          <FadeUp className="md:col-span-7 flex items-end justify-end" delay={0.3}>
            <a
              href="mailto:furkanahmedfarooqui19@gmail.com"
              className="cta-arrow group font-display font-medium"
              style={{
                fontSize: 'clamp(22px, 3vw, 42px)',
                letterSpacing: '-0.02em',
                color: 'var(--foreground)',
                borderBottom: '1px solid var(--foreground)',
                paddingBottom: 4,
              }}
            >
              <span>Get in touch</span>
              <svg
                width="28"
                height="28"
                viewBox="0 0 16 16"
                fill="none"
                className="group-hover:translate-x-1 transition-transform"
                style={{ display: 'inline-block' }}
              >
                <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      className="py-8"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <div className="max-w-[1440px] mx-auto px-8 md:px-16 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <span
            className="font-display text-sm font-medium"
            style={{ color: 'var(--foreground)' }}
          >
            Furkan Farooqui
          </span>
          <span
            className="font-body text-xs"
            style={{ color: 'var(--muted-foreground)' }}
          >
            © 2026
          </span>
        </div>

        <p
          className="font-body text-xs"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Designed in the browser. Powered by caffeine &amp; curiosity.
        </p>

        <div className="flex items-center gap-6">
          {[
            { label: 'GitHub', href: 'https://github.com/FurkanFarooqui19' },
            { label: 'LinkedIn', href: 'https://linkedin.com/in/furkan-farooqui' },
            { label: 'X', href: 'https://x.com/furkanfarooqui_' },
            { label: 'Email', href: 'mailto:furkanahmedfarooqui19@gmail.com' },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="nav-link font-body text-xs"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {link.label}
            </a>
          ))}
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
  const [onImage, setOnImage] = useState(false)
  const [clicking, setClicking] = useState(false)
  const [label, setLabel] = useState('')
  // Only enable the custom cursor on precise-pointer devices. Touch / coarse
  // devices fall back to the native pointer (see the matching CSS media query).
  const [enabled] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches
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
      const imageEl = t.closest('[data-cursor]') as HTMLElement | null
      const isInteractive =
        t.closest('a, button, [data-cursor]') !== null ||
        t.tagName === 'A' ||
        t.tagName === 'BUTTON'
      setHovered(isInteractive)
      setOnImage(!!imageEl)
      setLabel(imageEl?.dataset?.cursor || '')
    }

    const onDown = () => setClicking(true)
    const onUp = () => setClicking(false)

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseover', onEnter)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)

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
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseover', onEnter)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      cancelAnimationFrame(rafId.current)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <>
      {/* Dot — snaps directly to cursor */}
      <div
        ref={cursorDot}
        className="fixed top-0 left-0 z-[9999] pointer-events-none will-change-transform"
        style={{
          width: clicking ? 6 : hovered ? 8 : 5,
          height: clicking ? 6 : hovered ? 8 : 5,
          borderRadius: '50%',
          backgroundColor: onImage ? '#ffffff' : hovered ? 'var(--accent)' : 'var(--foreground)',
          transition: 'width 0.15s ease, height 0.15s ease, background-color 0.2s ease',
        }}
      />
      {/* Ring — lags behind for fluidity */}
      <div
        ref={cursorRing}
        className="fixed top-0 left-0 z-[9998] pointer-events-none will-change-transform flex items-center justify-center"
        style={{
          width: onImage ? 64 : hovered ? 48 : clicking ? 24 : 32,
          height: onImage ? 64 : hovered ? 48 : clicking ? 24 : 32,
          borderRadius: '50%',
          border: `1.5px solid ${onImage ? 'rgba(255,255,255,0.9)' : hovered ? 'var(--accent)' : 'var(--foreground)'}`,
          opacity: onImage ? 0.85 : hovered ? 0.5 : 0.2,
          backdropFilter: onImage ? 'invert(1) brightness(1.2)' : 'none',
          transition: 'width 0.35s cubic-bezier(0.22,1,0.36,1), height 0.35s cubic-bezier(0.22,1,0.36,1), opacity 0.2s ease, border-color 0.2s ease',
        }}
      >
        {label && (
          <span
            className="font-body text-[9px] tracking-widest uppercase"
            style={{ color: onImage ? '#ffffff' : 'var(--accent)', opacity: 1, letterSpacing: '0.1em' }}
          >
            {label}
          </span>
        )}
      </div>
    </>
  )
}

// ─── Scroll Progress Bar ──────────────────────────────────────────────────────

function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 28, restDelta: 0.001 })

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-[9997] origin-left pointer-events-none"
      style={{
        height: 2,
        scaleX,
        backgroundColor: 'var(--accent)',
      }}
    />
  )
}

// ─── Intro Animation ─────────────────────────────────────────────────────────

const SUBTITLE_TEXT = 'Software Engineer · AI Developer'

function IntroOverlay({ parallax }: { parallax: PointerParallax }) {
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

  useEffect(() => {
    // Subtitle rises in and scramble-decodes after the name, then clears
    // before the curtain lifts so the eye is on the name alone as it morphs.
    const tIn = setTimeout(() => {
      setShowSubtitle(true)
      setScrambleActive(true)
    }, 900)
    const tOut = setTimeout(() => setHideSubtitle(true), 1700)
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
      className="fixed inset-0 z-[9000] flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: 'var(--background)', pointerEvents: 'none' }}
      aria-hidden="true"
      role="presentation"
      // Curtain-rise: lifts immediately once the progress bar fills, in sync
      // with the name morph (1.15s). Shortened from 0.82s so the curtain
      // clears just as the name is landing in the hero.
      exit={{ y: '-100%', transition: { duration: 0.55, ease: [0.76, 0, 0.24, 1] } }}
    >
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
              borderRadius: '50%',
              background: 'radial-gradient(circle, var(--accent) 0%, transparent 62%)',
              opacity: 0.14,
              filter: 'blur(28px)',
            }}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.14 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          />
          {/* Crosshair hairlines — track the cursor like a design tool */}
          <motion.div
            className="absolute left-0 right-0 pointer-events-none"
            style={{ top: 0, y: py, height: 1, background: 'var(--accent)', opacity: 0.12 }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          />
          <motion.div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{ left: 0, x: px, width: 1, background: 'var(--accent)', opacity: 0.12 }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          />
        </>
      )}

      {/* Corner accent brackets */}
      <motion.div
        className="absolute top-8 left-8 md:top-12 md:left-14"
        style={{ width: 28, height: 28, borderTop: '1px solid var(--accent)', borderLeft: '1px solid var(--accent)', x: enabled ? brTLx : 0, y: enabled ? brTLy : 0 }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
      />
      <motion.div
        className="absolute top-8 right-8 md:top-12 md:right-14"
        style={{ width: 28, height: 28, borderTop: '1px solid var(--accent)', borderRight: '1px solid var(--accent)', x: enabled ? brTRx : 0, y: enabled ? brTRy : 0 }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
      />
      <motion.div
        className="absolute bottom-8 left-8 md:bottom-12 md:left-14"
        style={{ width: 28, height: 28, borderBottom: '1px solid var(--accent)', borderLeft: '1px solid var(--accent)', x: enabled ? brBLx : 0, y: enabled ? brBLy : 0 }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.11 }}
      />
      <motion.div
        className="absolute bottom-8 right-8 md:bottom-12 md:right-14"
        style={{ width: 28, height: 28, borderBottom: '1px solid var(--accent)', borderRight: '1px solid var(--accent)', x: enabled ? brBRx : 0, y: enabled ? brBRy : 0 }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.14 }}
      />

      {/* Spacer — mirrors the height of the name */}
      <div style={{ height: 'clamp(96px, 16vw, 220px)' }} />

      {/* Subtitle — rises in and scramble-decodes after the name */}
      <motion.p
        className="font-body uppercase mt-5"
        style={{ fontSize: 9, letterSpacing: '0.26em', color: 'var(--muted-foreground)', x: enabled ? subX : 0, fontVariantNumeric: 'tabular-nums' }}
        initial={{ opacity: 0, y: 10 }}
        animate={{
          opacity: showSubtitle && !hideSubtitle ? 1 : 0,
          y: hideSubtitle ? -6 : showSubtitle ? 0 : 10,
        }}
        transition={{ duration: hideSubtitle ? 0.35 : 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        {scrambledSubtitle}
      </motion.p>

      {/* Bottom-edge gradient — gives the curtain a visible lower boundary
          against the identical-coloured hero beneath it */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: 80,
          background: 'linear-gradient(to bottom, transparent, rgba(17,17,16,0.06))',
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
            style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}
          >
            {String(Math.round(progress * 100)).padStart(3, '0')}
          </span>
          {enabled && (
            <span
              className="font-body hidden sm:block"
              style={{ fontSize: 9, letterSpacing: '0.16em', color: 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}
            >
              {coords}
            </span>
          )}
          <span
            className="font-body uppercase"
            style={{ fontSize: 9, letterSpacing: '0.2em', color: 'var(--muted-foreground)' }}
          >
            Mumbai, IN
          </span>
        </div>
        {/* Track */}
        <div className="w-full" style={{ height: 1, background: 'var(--border)' }}>
          <motion.div
            style={{
              height: '100%',
              background: 'var(--accent)',
              transformOrigin: 'left center',
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
    <span style={{ display: 'inline-block' }}>
      {text.split('').map((ch, i) => (
        <motion.span
          key={i}
          style={{ display: 'inline-block', willChange: 'transform' }}
          initial={{ y: '0.72em', opacity: 0, filter: 'blur(6px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: start + i * 0.045 }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [introActive, setIntroActive] = useState(() => {
    // prefers-reduced-motion: skip intro entirely
    if (typeof window !== 'undefined') {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
      // sessionStorage: only play once per session
      if (sessionStorage.getItem('ff-intro-played')) return false
    }
    return true
  })

  // True for the brief window while the name morphs from the intro centre into
  // the hero position. During this window the hero name is lifted above the
  // curtain overlay so the leftward travel is actually visible.
  const [nameSettling, setNameSettling] = useState(false)

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
    document.body.style.overflow = 'hidden'

    // 2.2s: name reveals 0–1.0s → subtitle scrambles at 0.9s → progress fills by 2.1s →
    // 100ms hold → curtain lifts at 2.2s in sync with the 1.15s name morph.
    const t1 = setTimeout(() => {
      setIntroActive(false)
      setNameSettling(true)
      document.body.style.overflow = ''
      sessionStorage.setItem('ff-intro-played', '1')
    }, 2200)

    // Release the name back to normal flow once the 1.15s morph has finished.
    const t2 = setTimeout(() => setNameSettling(false), 2200 + 1300)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      document.body.style.overflow = ''
    }
  }, [introActive])

  return (
    <LayoutGroup>
      <div style={{ backgroundColor: 'var(--background)', minHeight: '100vh' }}>

        {/* Skip to content — first tab stop for keyboard users */}
        <a href="#main" className="skip-link">Skip to content</a>

        {/* Overlay (same-colour bg + decorations) — fades out when introActive → false */}
        <AnimatePresence>
          {introActive && <IntroOverlay key="intro-overlay" parallax={parallax} />}
        </AnimatePresence>

        {/* The name lives here while intro is active — fixed, centred, z above overlay */}
        {introActive && (
          <motion.div
            className="fixed inset-0 z-[9001] flex items-center justify-center pointer-events-none"
            style={{ x: parallax.enabled ? nameDriftX : 0, y: parallax.enabled ? nameDriftY : 0 }}
          >
            <motion.h1
              layoutId="site-name"
              className="font-display font-bold"
              style={{
                fontSize: 'clamp(40px, 7vw, 96px)',
                color: 'var(--foreground)',
                letterSpacing: '-0.03em',
                lineHeight: 1,
                textAlign: 'left',
                transformOrigin: 'left top',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
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

        <CustomCursor />
        <ScrollProgress />
        <Nav introActive={introActive} />
        <main id="main">
          <Hero introActive={introActive} nameSettling={nameSettling} />
          <Work />
          <About />
          <section id="skills"><Skills /></section>
          <section id="exp"><Experience /></section>
          <section id="certs"><Certifications /></section>
          <Contact />
        </main>
        <Footer />
      </div>
    </LayoutGroup>
  )
}
