/* Noxta v3 — Home app */

const { useState, useEffect, useMemo } = React;

/* ============ TWEAK DEFAULTS ============ */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "gradient",
  "backdropIntensity": 65
}/*EDITMODE-END*/;

/* accent → CSS variables */
const ACCENTS = {
  cyan: {
    grad: "linear-gradient(100deg, #7ce0ff 0%, #5dc9ff 50%, #3bb1ff 100%)",
    solid: "#7ce0ff",
    glow: "rgba(124, 224, 255, 0.5)",
  },
  violet: {
    grad: "linear-gradient(100deg, #c5a8ff 0%, #b08cff 50%, #8a64ff 100%)",
    solid: "#b08cff",
    glow: "rgba(176, 140, 255, 0.5)",
  },
  pink: {
    grad: "linear-gradient(100deg, #ffb3d6 0%, #ff8cc5 50%, #ff5fa8 100%)",
    solid: "#ff8cc5",
    glow: "rgba(255, 140, 197, 0.5)",
  },
  gradient: {
    grad: "linear-gradient(100deg, #7ce0ff 0%, #b08cff 50%, #ff8cc5 100%)",
    solid: "#b08cff",
    glow: "rgba(176, 140, 255, 0.5)",
  },
};

/* ============ DATA ============ */

const NAV = [
  { label: "Work", href: "#work" },
  { label: "Pricing", href: "#pricing" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

const SERVICES = [
  {
    n: "/01",
    title: "Websites",
    tags: ["WordPress", "Hand-coded", "Mobile-first"],
    desc: "Multi-page sites built to last. SEO + analytics included, never bolted on.",
  },
  {
    n: "/02",
    title: "E-commerce",
    tags: ["WooCommerce", "Shopify", "IDEAL / Bancontact"],
    desc: "Real inventory, real payments. From 50 SKUs to 4,200+ — like VOEP.",
  },
  {
    n: "/03",
    title: "Brand",
    tags: ["Wordmark", "Palette", "Type system"],
    desc: "Wordmark refresh through to full identity. Enough to make the site cohere.",
  },
  {
    n: "/04",
    title: "Maintenance",
    tags: ["Retainer", "On call", "Same-week edits"],
    desc: "I stay. Hosting, updates, backups, small edits handled within the week.",
  },
];

const BELIEVE = [
  {
    n: "/01",
    h: "I stay until it works.",
    p: "Most freelancers ship and vanish. I stay on call — retainer or ad-hoc. Launch day is the middle of the project, not the end.",
  },
  {
    n: "/02",
    h: "Details are the work.",
    p: "Generic looks generic because nobody sweated the details. If a button feels wrong by 2 pixels I notice — and so will your visitors.",
  },
  {
    n: "/03",
    h: "Built to hand back.",
    p: "When the project ends you own everything: code, domain, logins, content. No lock-in, no dependency on me to flip a switch.",
  },
];

const PRICING_ONETIME = [
  {
    flag: null,
    tier: "Tier · I",
    amount: "€300 – 800",
    name: "Small",
    desc: "One thing, done sharply.",
    feats: [
      "Single landing page or minor redesign",
      "Simple brand mark or wordmark refresh",
      "Up to 600 words of copy I write with you",
      "Basic SEO setup (title, meta, sitemap)",
      "Mobile-first, hand-coded HTML / CSS",
      "One round of revisions",
    ],
    ideal:
      "A focused launch page, a one-off redesign, a small piece of work for a side project. 1–2 week turnaround.",
  },
  {
    flag: "Most common",
    tier: "Tier · II",
    amount: "€1,200 – 2,000",
    name: "Mid",
    desc: "A full site, a real identity.",
    feats: [
      "Full multi-page website (4–8 pages)",
      "Brand identity — wordmark, palette, type",
      "Copywriting across the site (~2,000 words)",
      "On-page SEO, schema, sitemap",
      "Contact form, analytics, social meta",
      "Two rounds of revisions · 2–4 week turnaround",
    ],
    ideal:
      "Small businesses without an online presence yet, or whose current site is hurting them. The sweet spot of my work.",
  },
  {
    flag: null,
    tier: "Tier · III",
    amount: "€3,000 – 8,000",
    name: "Large",
    desc: "Stores, custom builds, full stack.",
    feats: [
      "WooCommerce or Shopify e-commerce builds",
      "Custom WordPress child theme",
      "Product database setup & import",
      "Payments (IDEAL, Bancontact, card) + shipping",
      "Search, filters, custom mobile UX",
      "Three revision rounds · 6–8 week turnaround",
    ],
    ideal:
      "Shops with real inventory, custom flows, or anything off-the-shelf can't handle. VOEP was a Large.",
  },
];

const PRICING_MONTHLY = [
  {
    flag: null,
    tier: "Plan · I",
    amount: "€50 / month",
    name: "Light",
    desc: "Kept up, kept safe.",
    feats: [
      "Hosting check & uptime monitoring",
      "Weekly automated backups",
      "Security patches & plugin updates",
      "1 hour of edits per month, rolled forward",
      "Email support, 48h reply",
    ],
    ideal: "For finished sites that just need to stay alive and current.",
  },
  {
    flag: "Most common",
    tier: "Plan · II",
    amount: "€150 / month",
    name: "Standard",
    desc: "Everything in Light, plus active care.",
    feats: [
      "Everything in Light",
      "3 hours of edits per month",
      "Copy tweaks & small layout changes",
      "Monthly performance report",
      "Same-week edits (Mon–Fri)",
    ],
    ideal: "For sites that change a few times a month — pricing, menu, content.",
  },
  {
    flag: null,
    tier: "Plan · III",
    amount: "€300 / month",
    name: "Active",
    desc: "I'm basically on your team.",
    feats: [
      "Everything in Standard",
      "8 hours of edits per month",
      "Priority response (next business day)",
      "Phone / WhatsApp support",
      "Quarterly strategy call",
    ],
    ideal: "For growing shops and active marketing — new pages, campaigns, ongoing work.",
  },
];

/* ============ COMPONENTS ============ */

function Nav() {
  return (
    <header className="nav">
      <div className="container nav-inner">
        <a href="#top" className="nav-logo" aria-label="Noxta">
          No<span className="x">x</span>ta
        </a>
        <nav className="nav-links">
          {NAV.map((n) => (
            <a key={n.label} href={n.href}>
              {n.label}
            </a>
          ))}
          <a className="nav-cta" href="#contact">
            Book a call →
          </a>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-top">
        <span className="hero-status-pill">
          <span className="pulse"></span>
          <span>Available · Q3 2026 · 2 slots</span>
        </span>
        <span className="hero-top-meta">§ Hero · 01 — Noxta Studio · 2026</span>
      </div>

      <div className="hero-body">
        <div className="hero-text">
          <h1 className="hero-name">
            Adrian
            <br />
            <span className="grad">Tajti<span className="dot">.</span></span>
          </h1>
          <div className="hero-role-line">
            <span className="dash"></span>
            <span>Freelance Web Designer, Tilburg</span>
          </div>
          <hr className="hero-rule" />
          <p className="hero-bio">
            One person, one studio. I design and build websites for small
            companies that want something <strong>considered</strong> — and
            someone who <strong>stays after launch</strong>. No account
            managers, no outsourced subcontractors, no Slack channels you'll
            never get added to. You email me. I write back.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#contact">
              Start a project →
            </a>
            <a className="btn btn-ghost" href="#work">
              See the work
            </a>
          </div>
        </div>

        <div className="hero-portrait">
          <img
            src="assets/portrait-hero.webp"
            alt="Adrian Tajti, founder of Noxta Studio"
            width="1448"
            height="1086"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </div>
      </div>

      <div className="hero-tagbar">
        <span className="dash">—</span>
        Freelance web designer & developer, building considered websites that hold.
        <span className="dash">—</span>
      </div>
    </section>
  );
}

function Intro() {
  return (
    <section className="section" id="about" style={{ paddingTop: 100, paddingBottom: 60 }}>
      <div className="container">
        <div className="section-label">
          <span className="bar"></span>
          <span>§ 00 · Who I am</span>
        </div>
        <h2 className="section-h" style={{ maxWidth: "22ch" }}>
          One person.<br />
          <span className="grad">One studio.</span> Your project.
        </h2>
        <p className="section-sub" style={{ maxWidth: "60ch", fontSize: 19 }}>
          I'm Adrian — a freelance web designer in Tilburg. Noxta is the name on
          the door, but it's just me behind it. No account managers, no
          outsourced subcontractors, no Slack channels you'll never get added
          to. <strong style={{ color: "var(--ink)", fontWeight: 600 }}>You email me. I write back.</strong>
        </p>
      </div>
    </section>
  );
}

function Services() {
  return (
    <section className="section" id="services">
      <div className="container">
        <div className="section-label">
          <span className="bar"></span>
          <span>§ 01 · What I do</span>
        </div>
        <h2 className="section-h">
          Four things,
          <br />
          done in-house.
        </h2>
        <p className="section-sub">
          One person, full stack. Design, copy, code, payments, hosting —
          handled in the same head. No handoffs between contractors who blame
          each other.
        </p>
        <div className="services">
          {SERVICES.map((s) => (
            <div key={s.title} className="service">
              <span className="num">{s.n}</span>
              <h3 className="title">{s.title}</h3>
              <p className="desc">{s.desc}</p>
              <div className="tags">
                {s.tags.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
              <span className="arr">→</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function VOEPMock() {
  return (
    <div className="browser">
      <div className="browser-bar">
        <span className="dot"></span>
        <span className="dot"></span>
        <span className="dot"></span>
        <span className="url">vintageoutboardparts.com</span>
      </div>
      <div className="browser-body">
        <div className="voep-mast">
          <div className="voep-logo">
            <span className="ring"></span>
            VOEP
          </div>
          <div className="voep-nav">
            <span>SHOP</span>
            <span>YEARS</span>
            <span>BRANDS</span>
            <span>CART</span>
          </div>
        </div>
        <div>
          <div className="voep-h">
            Sixty years
            <br />
            on the <em>water.</em>
          </div>
        </div>
        <div className="voep-yrs">
          {[
            { y: "1964", t: "First fuel-injection outboard" },
            { y: "1968", t: "Industry shift to two-stroke" },
            { y: "1974", t: "EPA standards introduced" },
            { y: "1978", t: "Electronic ignition era" },
            { y: "TODAY", t: "VOEP carries it all" },
          ].map((row) => (
            <div className="voep-yr" key={row.y}>
              <div className="y">{row.y}</div>
              <div>{row.t}</div>
            </div>
          ))}
        </div>
        <div className="voep-line"></div>
        <div className="voep-quote">
          "Since 1968, I grew up surrounded by outboard motors — mostly
          two-stroke. The smell of mixed fuel is the smell of my childhood."
        </div>
      </div>
    </div>
  );
}

function Work() {
  return (
    <section className="section" id="work">
      <div className="container">
        <div className="section-label">
          <span className="bar"></span>
          <span>§ 02 · Selected work</span>
        </div>
        <h2 className="section-h">
          One case, <br />
          told properly.
        </h2>
        <div className="work-card">
          <div className="work-info">
            <div className="work-tag">§ Case · 001 — Vintage Outboard Parts</div>
            <h3 className="work-title">VOEP</h3>
            <p className="work-sub">
              A 4,200-part shop, built from zero. Alex runs a vintage outboard
              engine parts shop in Belgium. He had the inventory, the
              knowledge, and zero internet. Sixty hours later he had a store
              taking IDEAL, with SKU search tuned by hand.
            </p>
            <div className="work-meta">
              <div className="cell">
                <div className="k">// Built in</div>
                <div className="v">~60 hours</div>
              </div>
              <div className="cell">
                <div className="k">// First sale</div>
                <div className="v">&lt; 7 days</div>
              </div>
              <div className="cell">
                <div className="k">// Products</div>
                <div className="v">4,200+ SKUs</div>
              </div>
              <div className="cell">
                <div className="k">// Stack</div>
                <div className="v">WP · Woo · Flat</div>
              </div>
            </div>
            <div className="work-actions">
              <a className="btn btn-ghost" href="#case-voep">Read the case →</a>
            </div>
          </div>
          <div className="work-vis">
            <VOEPMock />
          </div>
        </div>
      </div>
    </section>
  );
}

function Believe() {
  return (
    <section className="section" id="believe">
      <div className="container">
        <div className="section-label">
          <span className="bar"></span>
          <span>§ 03 · How I work</span>
        </div>
        <h2 className="section-h">
          Three things <br />
          I actually believe.
        </h2>
        <div className="believe">
          {BELIEVE.map((b) => (
            <div className="believe-cell" key={b.h}>
              <div className="n">{b.n}</div>
              <h3>{b.h}</h3>
              <p>{b.p}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const [mode, setMode] = useState("onetime"); // onetime | monthly
  const tiers = mode === "onetime" ? PRICING_ONETIME : PRICING_MONTHLY;
  return (
    <section className="section" id="pricing">
      <div className="container">
        <div className="pricing-head">
          <div>
            <div className="section-label">
              <span className="bar"></span>
              <span>§ 04 · Pricing</span>
            </div>
            <h2 className="section-h">
              Three ways <br />
              to begin.
            </h2>
            <p className="section-sub">
              Honest ranges. No "starting from" tricks. I quote a fixed number
              after a 30-minute call — and I don't move it unless you change
              the scope.
            </p>
          </div>
          <div className="pricing-toggle" role="tablist">
            <button
              className={mode === "onetime" ? "active" : ""}
              onClick={() => setMode("onetime")}
            >
              One-time project
            </button>
            <button
              className={mode === "monthly" ? "active" : ""}
              onClick={() => setMode("monthly")}
            >
              Monthly retainer
            </button>
          </div>
        </div>

        <div className="pricing-grid" key={mode}>
          {tiers.map((t, i) => (
            <article className={"price" + (t.flag ? " featured" : "")} key={t.name}>
              {t.flag && <div className="price-flag">{t.flag}</div>}
              <div className="price-head">
                <span>{t.tier}</span>
                <span className="amt">{t.amount}</span>
              </div>
              <h3 className="price-name">{t.name}</h3>
              <p className="price-desc">{t.desc}</p>
              <div className="price-feat-label">// What's included</div>
              <ul className="price-list">
                {t.feats.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <div className="price-foot">
                <span className="ideal">// Ideal for</span>
                {t.ideal}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section id="contact">
      <div className="container">
        <div className="cta">
          <div className="cta-inner">
            <div className="cta-top">
              <div className="mark">
                § 05 · Engage<br />
                <span className="sub">Two slots open · Q3 2026</span>
              </div>
              <div></div>
              <div className="mark tr">
                Reply window<br />
                <span className="sub">Within 24 hours</span>
              </div>
            </div>

            <div className="cta-stage">
              <h2 className="cta-h">
                Let's build something<br />
                <span className="grad">that holds.</span>
              </h2>
              <div className="cta-wordmark" aria-hidden="true">
                <span className="glyph">NOXTA</span>
              </div>
              <div className="cta-photo-wrap">
                <img className="cta-photo" src="assets/portrait-cta.webp" alt="" width="1593" height="987" loading="lazy" decoding="async" />
              </div>
            </div>

            <div className="cta-bottom">
              <p className="lede">
                Tell me what's broken. I'll come back within 24 hours with a
                yes, a no, or a referral. No funnel, no nurture sequence, no
                spam.
              </p>
              <div className="ctas">
                <a className="btn btn-primary" href="mailto:adrian@noxta.studio">
                  adrian@noxta.studio →
                </a>
                <a className="btn btn-ghost" href="#book">
                  Book a 30-min call
                </a>
              </div>
              <div className="note">
                Or WhatsApp <strong>+31 617 657 327</strong> · I read every message
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Wordmark() {
  return (
    <section className="wordmark" aria-hidden="true">
      <div className="container">
        <div className="glyph">NOXTA</div>
      </div>
    </section>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        fill="currentColor"
        d="M17.5 14.4c-.3-.1-1.8-.9-2.1-1-.3-.1-.5-.1-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-1.7-.8-2.7-1.5-3.8-3.4-.3-.5.3-.5.8-1.5.1-.2.1-.3 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1.1 1-1.1 2.5s1.1 3 1.3 3.2c.2.2 2.2 3.4 5.4 4.8.7.3 1.3.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.2-.6-.4Z"
      />
      <path
        fill="currentColor"
        d="M20.5 3.5A11 11 0 0 0 2.7 16.8L1 22l5.3-1.7a11 11 0 0 0 5.3 1.3h.1a11 11 0 0 0 7.8-18.6Zm-7.8 16.7a9 9 0 0 1-4.7-1.3l-.3-.2-3.2 1 1-3.1-.2-.3a9.2 9.2 0 1 1 7.4 4Z"
      />
    </svg>
  );
}
function LinkedInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.8 2.6 4.8 6V21h-4v-5.5c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21H10V9Z" />
    </svg>
  );
}

function Footer() {
  return (
    <footer className="footer" id="end">
      <div className="container">
        <div className="foot-grid">
          <div className="foot-col foot-brand">
            <div className="lg">No<span className="x">x</span>ta</div>
            <div className="label" style={{ marginBottom: 14 }}>Studio · Tilburg, NL · Est. 2026</div>
            <p>
              A one-person studio building considered websites for small
              companies that want a partner — not a vendor.
            </p>
          </div>
          <div className="foot-col">
            <h5>// Site</h5>
            <a href="#work">Work</a>
            <a href="#pricing">Pricing</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
          </div>
          <div className="foot-col">
            <h5>// Contact</h5>
            <a href="mailto:adrian@noxta.studio">adrian@noxta.studio</a>
            <a href="#book">Book a call</a>
            <p>Tilburg, NL · UTC+1</p>
          </div>
          <div className="foot-col">
            <h5>// Elsewhere</h5>
            <a href="https://wa.me/31617657327" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <WhatsAppIcon /> WhatsApp
            </a>
            <a href="#linkedin" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <LinkedInIcon /> LinkedIn
            </a>
          </div>
        </div>
        <div className="foot-base">
          <span>© 2026 Adrian Tajti · Noxta Studio</span>
          <div className="dots">
            <span>Built by hand</span>
            <span>No CMS</span>
            <span>No cookies</span>
            <span>No tracking</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ============ TWEAKS PANEL ============ */

function NoxtaTweaks({ tweaks, setTweak }) {
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Accent">
        <TweakColor
          label="Accent color"
          value={tweaks.accent}
          onChange={(v) => setTweak("accent", v)}
          options={[
            { label: "Gradient", value: "gradient" },
            { label: "Cyan", value: "cyan" },
            { label: "Violet", value: "violet" },
            { label: "Pink", value: "pink" },
          ].map((o) => ({ value: o.value, label: o.label, color: ACCENTS[o.value].grad }))}
        />
      </TweakSection>
      <TweakSection label="Backdrop">
        <TweakSlider
          label="Glow intensity"
          value={tweaks.backdropIntensity}
          onChange={(v) => setTweak("backdropIntensity", v)}
          min={0}
          max={100}
          step={5}
        />
      </TweakSection>
    </TweaksPanel>
  );
}

/* Custom TweakColor that accepts {value,label,color} with color being any CSS background */
function TweakColor({ label, value, onChange, options }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontFamily: "var(--f-mono)", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--mute)" }}>
        {label}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              padding: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: 0,
              background: value === o.value ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
              boxShadow: value === o.value ? "inset 0 0 0 1px rgba(255,255,255,.25)" : "inset 0 0 0 1px rgba(255,255,255,.06)",
              cursor: "pointer",
              color: "var(--ink)",
              fontFamily: "var(--f-mono)",
              fontSize: 11,
              letterSpacing: ".05em",
              textAlign: "left",
              clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
            }}
          >
            <span style={{ width: 22, height: 22, background: o.color, flexShrink: 0, clipPath: "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)" }} />
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============ ROOT ============ */

function App() {
  const [tweaks, _setTweaks] = useTweaks(TWEAK_DEFAULTS);
  const setTweak = (k, v) => _setTweaks({ [k]: v });

  // apply accent to CSS vars
  useEffect(() => {
    const a = ACCENTS[tweaks.accent] || ACCENTS.gradient;
    const root = document.documentElement;
    root.style.setProperty("--accent", a.grad);
    root.style.setProperty("--accent-solid", a.solid);
    root.style.setProperty("--accent-glow", a.glow);
  }, [tweaks.accent]);

  useEffect(() => {
    const root = document.documentElement;
    const v = (tweaks.backdropIntensity ?? 65) / 100;
    root.style.setProperty("--bg-glow-strength", String(v));
    // tweak the hero glow strength by overriding opacity on the ::before pseudo via custom var
    document
      .querySelectorAll(".portrait-glow")
      .forEach((el) => (el.style.opacity = String(0.15 + v * 0.5)));
  }, [tweaks.backdropIntensity]);

  return (
    <React.Fragment>
      <Nav />
      <main id="main">
        <Hero />
        <Intro />
        <Services />
        <Work />
        <Believe />
        <Pricing />
        <CTA />
      </main>
      <Footer />
      <NoxtaTweaks tweaks={tweaks} setTweak={setTweak} />
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
