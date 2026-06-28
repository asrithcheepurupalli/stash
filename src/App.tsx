/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight, Search, Zap, Shield, Lock, Database, RotateCcw,
  Cpu, Download, HelpCircle, FileText, MessagesSquare, Sparkles, Tag,
} from "lucide-react";
import { useState, useCallback } from "react";
import JSZip from "jszip";

// The made. mark: italic Fraunces with an upright brand-red period. Every
// sub-brand reuses the exact pattern. The dot is the logo.
function Wordmark({ name }: { name: string }) {
  return (
    <span className="wordmark">{name}<span className="dot">.</span></span>
  );
}

// Set this to your Gumroad checkout link once the $39 Pro product exists, e.g.
// 'https://made-by-ac.gumroad.com/l/stash'. Until then the Pro CTA reads
// "Launching soon" so nothing dead-ends.
const GUMROAD_URL = '';

export default function App() {
  const [showGuide, setShowGuide] = useState(false);
  const [isBundling, setIsBundling] = useState(false);

  const handleInstall = useCallback(async () => {
    setIsBundling(true);
    try {
      const zip = new JSZip();
      // The file list is generated at build time (see scripts/sync-extension)
      // so the bundled model + runtime under vendor/ and models/ are included.
      const listRes = await fetch(`${window.location.origin}/extension/files.json`);
      if (!listRes.ok) throw new Error("Could not load the extension file list");
      const files: string[] = await listRes.json();
      await Promise.all(
        files.map(async (file) => {
          const response = await fetch(`${window.location.origin}/extension/${file}`);
          if (!response.ok) throw new Error(`Failed to fetch ${file}: ${response.statusText}`);
          const blob = await response.blob();
          zip.file(file, blob);
        })
      );
      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = "stash-extension.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setShowGuide(true);
    } catch (error) {
      console.error("Failed to bundle extension:", error);
      alert("Download failed. Please try again.");
    } finally {
      setIsBundling(false);
    }
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const FEATURES = [
    { icon: <MessagesSquare size={20} />, title: "Catch every conversation", desc: "Save a whole thread from ChatGPT, Claude or Gemini to your archive with one click. The answer you found at midnight is still there next week." },
    { icon: <FileText size={20} />, title: "Keep the pages too", desc: "Clip the articles, docs and references you actually read, alongside your chats, in one place built from your own attention." },
    { icon: <Search size={20} />, title: "One searchable memory", desc: "A single timeline of everything you have asked and read. Stop re-asking the same question; find the answer you already have." },
    { icon: <RotateCcw size={20} />, title: "Resume any thread", desc: "Do not just read an old chat, relaunch it into a fresh session with its context already in place. Pick up exactly where you left off." },
    { icon: <Database size={20} />, title: "No account, no friction", desc: "No sign up, no inbox, no onboarding. Install it and start remembering. Your archive is yours from the first click." },
    { icon: <Cpu size={20} />, title: "Yours to take", desc: "Export your whole memory as a clean file whenever you want. It is your record of your own thinking, not ours." },
  ];

  const AUDIENCE = [
    { t: "Researchers and students", d: "Turn scattered AI explanations into a revision library you can search instead of re-deriving." },
    { t: "Builders and founders", d: "Keep the strategy threads and idea sessions so days of planning do not start from scratch each morning." },
    { t: "Developers", d: "Cold-store the debugging breakthroughs and the snippets, so the fix you found once is never lost again." },
    { t: "Anyone who lives in AI", d: "If your best thinking now happens in a chat window, this is where it stops disappearing." },
  ];

  const PRO_FEATURES = [
    { icon: <Sparkles size={20} />, title: "Ask your stash", desc: "Search by meaning, not keywords. Ask a real question and Stash surfaces the chat or page that answers it, even when you never used those exact words." },
    { icon: <FileText size={20} />, title: "Instant summaries", desc: "Turn a long thread into the few sentences that actually matter, generated on your machine the moment you ask." },
    { icon: <Tag size={20} />, title: "Tags that write themselves", desc: "Stash reads each item and proposes the tags, so your archive sorts itself instead of waiting on you." },
  ];

  const FAQ = [
    { q: "Where is my data stored?", a: "Only on your device, in your browser's local storage. Stash has no servers and no account, so there is nowhere else for it to go." },
    { q: "What is Stash Pro?", a: "Pro adds an on-device AI layer: ask your stash by meaning, summarise any thread, and auto-tag your archive. The model is bundled into the extension, so even the AI runs offline and nothing is uploaded. Capture, keyword search and export stay free forever." },
    { q: "Does it work with Claude and Gemini?", a: "Yes. Stash captures conversations from ChatGPT, Claude and Gemini, plus any web page you want to keep." },
    { q: "Can I export everything?", a: "Yes. Export your entire memory as a file from the dashboard at any time. Your archive belongs to you." },
    { q: "What happens if I uninstall?", a: "Because the data lives in your browser, removing the extension removes the archive. Export a backup any time, then import it back into a fresh install to restore everything. Your memory is yours to move." },
  ];

  return (
    <div className="min-h-screen bg-paper text-ink overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full px-6 md:px-10 py-5 flex justify-between items-center z-50 bg-paper/80 backdrop-blur-md border-b border-line">
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="text-2xl">
          <Wordmark name="stash" />
        </button>
        <div className="hidden md:flex items-center gap-9 text-sm text-muted">
          <button onClick={() => scrollTo("features")} className="hover:text-ink transition-colors">Features</button>
          <button onClick={() => scrollTo("pro")} className="hover:text-ink transition-colors">Pro</button>
          <button onClick={() => scrollTo("privacy")} className="hover:text-ink transition-colors">Privacy</button>
          <button onClick={() => scrollTo("how")} className="hover:text-ink transition-colors">How it works</button>
          <button onClick={handleInstall} className="px-5 py-2 bg-ink text-paper rounded-full font-medium hover:opacity-90 transition-opacity">
            Get Stash
          </button>
        </div>
      </nav>

      {/* Hero */}
      <header className="px-6 pt-40 md:pt-48 pb-24 max-w-5xl mx-auto text-center">
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="text-sm text-muted mb-6">
          A <Wordmark name="made" /> product · local-first
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.05 }}
          className="font-serif font-medium text-5xl md:text-7xl leading-[1.04] tracking-tight">
          Your AI memory.<br />On your machine, <span className="text-red">not theirs.</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.12 }}
          className="text-lg md:text-xl text-ink-2 leading-relaxed max-w-2xl mx-auto mt-7">
          Stash keeps every AI conversation and the pages you read in one searchable
          memory that lives only on your device. Stash it once, find it anytime. No servers,
          no account, no one else can reach it.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button onClick={handleInstall} disabled={isBundling}
            className="group px-8 py-4 bg-ink text-paper rounded-full font-semibold text-base flex items-center gap-3 hover:opacity-90 transition-all disabled:opacity-50">
            {isBundling ? (
              <><span className="w-4 h-4 border-2 border-paper border-t-transparent rounded-full animate-spin" /> Preparing...</>
            ) : (
              <><Download size={18} /> Download Stash <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></>
            )}
          </button>
          <span className="inline-flex items-center gap-2 text-sm text-muted">
            <Shield size={14} /> Lives in your browser. Nothing leaves your machine.
          </span>
        </motion.div>

        {/* archive mockup */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-20 max-w-2xl mx-auto text-left">
          <div className="rounded-3xl border border-line bg-card shadow-[0_30px_70px_rgba(11,11,12,0.10)] p-6 md:p-8">
            <div className="flex items-center justify-between mb-7">
              <span className="inline-flex gap-1.5">
                <i className="w-2.5 h-2.5 rounded-full bg-line inline-block" />
                <i className="w-2.5 h-2.5 rounded-full bg-line inline-block" />
                <i className="w-2.5 h-2.5 rounded-full bg-line inline-block" />
              </span>
              <span className="text-xs text-muted">your stash archive</span>
            </div>
            <div className="space-y-3">
              {[
                { icon: <MessagesSquare size={15} />, t: "Pricing strategy for the launch", s: "ChatGPT · today" },
                { icon: <FileText size={15} />, t: "Local-first software, a field guide", s: "Web page · yesterday" },
                { icon: <MessagesSquare size={15} />, t: "Debugging the auth redirect loop", s: "ChatGPT · 2 days ago" },
                { icon: <FileText size={15} />, t: "Notes on on-device models", s: "Web page · last week" },
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3">
                  <span className="w-9 h-9 rounded-lg bg-card border border-line grid place-items-center text-muted">{row.icon}</span>
                  <span className="flex-1">
                    <span className="block text-[15px] font-medium leading-tight">{row.t}</span>
                    <span className="block text-xs text-muted mt-0.5">{row.s}</span>
                  </span>
                  <RotateCcw size={15} className="text-muted" />
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </header>

      {/* made. line: the Airlock sibling */}
      <section className="px-6 py-5">
        <div className="max-w-3xl mx-auto rounded-2xl border border-line bg-paper-2 px-6 py-5 text-center">
          <p className="text-sm md:text-[15px] text-ink-2 leading-relaxed">
            Part of <Wordmark name="made" />'s local-first tools.{" "}
            <a href="https://airlock.made-by-ac.com" className="font-semibold text-ink underline decoration-red/40 underline-offset-2">Airlock</a>{" "}
            guards what you <em>send</em> to AI. Stash keeps what you <em>get back</em>. Neither one ever phones home.
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-24 max-w-6xl mx-auto">
        <div className="max-w-2xl mb-14">
          <p className="text-sm text-muted mb-3">What it does</p>
          <h2 className="font-serif font-medium text-4xl md:text-5xl tracking-tight leading-tight">
            A memory built from your own attention.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <div key={i} className="rounded-2xl border border-line bg-card p-7">
              <span className="inline-flex w-11 h-11 rounded-xl bg-paper-2 border border-line items-center justify-center text-ink mb-5">{f.icon}</span>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-[15px] text-ink-2 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy manifesto (dark band, made. contrast) */}
      <section id="privacy" className="px-6 py-28 bg-ink text-paper mt-4">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/15 text-xs text-paper/70 mb-8">
            <Lock size={13} /> The whole point
          </span>
          <h2 className="font-serif font-medium text-4xl md:text-6xl tracking-tight leading-[1.05]">
            A memory cannot leak<br />if it never <span className="text-red">leaves.</span>
          </h2>
          <p className="text-lg md:text-xl text-paper/70 leading-relaxed max-w-2xl mx-auto mt-7">
            Everyone else's "AI memory" is a copy of your thinking on someone else's
            servers. Stash is local-first by design. There is no cloud, no account, no
            tracking, and nothing for us to sell, because we never receive it.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-14 text-left">
            {[
              { icon: <Database size={18} />, t: "Stored on your device", d: "Every chat and page is saved with chrome.storage.local. No request ever leaves to save your data." },
              { icon: <Zap size={18} />, t: "Nothing to phone home with", d: "The extension makes no network calls of its own. Open your network tab and watch it stay quiet." },
              { icon: <Cpu size={18} />, t: "Yours to inspect and export", d: "The logic is entirely client-side and your whole archive exports to a file you keep." },
            ].map((c, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
                <span className="inline-flex w-11 h-11 rounded-xl bg-white/[0.06] border border-white/10 items-center justify-center text-red mb-5">{c.icon}</span>
                <h4 className="text-lg font-semibold mb-2">{c.t}</h4>
                <p className="text-[15px] text-paper/60 leading-relaxed">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stash Pro: on-device intelligence */}
      <section id="pro" className="px-6 py-24 max-w-6xl mx-auto">
        <div className="rounded-[36px] border border-line bg-paper-2 px-6 md:px-12 py-14 md:py-16">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red text-paper text-xs font-semibold tracking-wide mb-5">
              <Sparkles size={13} /> Stash Pro
            </span>
            <h2 className="font-serif font-medium text-4xl md:text-5xl tracking-tight leading-tight">
              Ask your stash.<br />The answer never <span className="text-red">leaves it.</span>
            </h2>
            <p className="text-lg text-ink-2 leading-relaxed mt-6">
              Pro adds a small AI model bundled right into the extension. Search your whole
              memory by meaning, summarise any thread, and let your archive tag itself. Like
              the rest of Stash, it runs entirely on your machine and sends nothing anywhere.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
            {PRO_FEATURES.map((f, i) => (
              <div key={i} className="rounded-2xl border border-line bg-card p-7">
                <span className="inline-flex w-11 h-11 rounded-xl bg-paper-2 border border-line items-center justify-center text-red mb-5">{f.icon}</span>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-[15px] text-ink-2 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-2xl border border-line bg-card px-7 py-6">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-2">
              <span className="inline-flex items-center gap-2"><Cpu size={15} className="text-red" /> Model bundled in, runs offline</span>
              <span className="inline-flex items-center gap-2"><Lock size={15} className="text-red" /> Nothing uploaded, ever</span>
              <span className="inline-flex items-center gap-2"><Database size={15} className="text-red" /> One-time, no subscription</span>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <span className="text-sm text-ink-2">
                <span className="font-serif text-3xl text-ink font-medium align-middle">$39</span> <span className="align-middle">one-time</span>
              </span>
              {GUMROAD_URL ? (
                <a href={GUMROAD_URL} target="_blank" rel="noopener noreferrer" className="px-6 py-3 bg-ink text-paper rounded-full font-semibold text-sm inline-flex items-center gap-2 hover:opacity-90 transition-opacity">
                  <Sparkles size={16} /> Get Stash Pro
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-line text-xs text-muted">
                  <span className="w-1.5 h-1.5 rounded-full bg-red inline-block" /> Launching soon
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-muted mt-4">Install the free extension, then activate Pro inside it with the license key from your purchase. One-time price, no account, nothing to cancel.</p>
        </div>
      </section>

      {/* Who it is for */}
      <section className="px-6 py-24 max-w-6xl mx-auto text-center">
        <p className="text-sm text-muted mb-3">Who it is for</p>
        <h2 className="font-serif font-medium text-4xl md:text-5xl tracking-tight leading-tight max-w-2xl mx-auto">
          For anyone whose best ideas now live in a chat window.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-12 text-left">
          {AUDIENCE.map((a, i) => (
            <div key={i} className="rounded-2xl border border-line bg-card p-7">
              <h3 className="text-lg font-semibold mb-2">{a.t}</h3>
              <p className="text-[15px] text-ink-2 leading-relaxed">{a.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works + FAQ */}
      <section id="how" className="px-6 py-24 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16">
        <div>
          <p className="text-sm text-muted mb-3">How it works</p>
          <h2 className="font-serif font-medium text-3xl md:text-4xl tracking-tight mb-8">Three steps, then it just remembers.</h2>
          <ol className="space-y-7">
            {[
              ["Capture", "On a chat or a page you want to keep, click Save to Stash. It reads the content locally and writes it to your archive."],
              ["Search", "Everything lands in one timeline in the dashboard. Search across every chat and page you have ever saved."],
              ["Resume", "Reopen any thread, or relaunch it into a fresh session with its context already pasted in. Pick up the thought."],
            ].map(([t, d], i) => (
              <li key={i} className="flex gap-4">
                <span className="flex-shrink-0 w-9 h-9 rounded-full bg-paper-2 border border-line grid place-items-center font-serif font-semibold">{i + 1}</span>
                <span>
                  <span className="block font-semibold mb-1">{t}</span>
                  <span className="block text-[15px] text-ink-2 leading-relaxed">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-3xl border border-line bg-card p-8 md:p-10">
          <h3 className="text-xl font-semibold mb-7">Questions</h3>
          <div className="space-y-6">
            {FAQ.map((f, i) => (
              <div key={i} className="pb-6 border-b border-line last:border-0 last:pb-0">
                <p className="font-semibold flex items-center gap-2 mb-2"><HelpCircle size={15} className="text-muted" /> {f.q}</p>
                <p className="text-[15px] text-ink-2 leading-relaxed pl-6">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24">
        <div className="max-w-4xl mx-auto rounded-[40px] bg-ink text-paper text-center px-8 py-20">
          <h2 className="font-serif font-medium text-4xl md:text-6xl tracking-tight leading-none">Ready to remember?</h2>
          <p className="text-lg text-paper/70 max-w-xl mx-auto mt-6">
            Stop losing your best thinking to forgotten tabs and buried chat threads. Keep it, on your own machine.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button onClick={handleInstall} disabled={isBundling}
              className="px-8 py-4 bg-paper text-ink rounded-full font-semibold flex items-center gap-3 hover:opacity-90 transition-opacity disabled:opacity-50">
              <Download size={18} /> Download Stash
            </button>
            <span className="text-sm text-paper/50">Free · Local · No account</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-10 py-14 border-t border-line max-w-6xl mx-auto w-full">
        <div className="flex flex-col md:flex-row justify-between gap-8">
          <div className="max-w-sm">
            <div className="text-2xl mb-3"><Wordmark name="stash" /></div>
            <p className="text-sm text-muted leading-relaxed">
              Your AI chats and the pages you read, kept in one searchable memory that
              lives only on your device. A <Wordmark name="made" /> local-first tool.
            </p>
          </div>
          <div className="flex gap-16">
            <div>
              <h5 className="text-xs uppercase tracking-widest text-muted mb-4">Product</h5>
              <ul className="space-y-3 text-sm text-ink-2">
                <li><button onClick={() => scrollTo("features")} className="hover:text-ink">Features</button></li>
                <li><button onClick={() => scrollTo("pro")} className="hover:text-ink">Pro</button></li>
                <li><button onClick={() => scrollTo("privacy")} className="hover:text-ink">Privacy</button></li>
                <li><button onClick={() => scrollTo("how")} className="hover:text-ink">How it works</button></li>
              </ul>
            </div>
            <div>
              <h5 className="text-xs uppercase tracking-widest text-muted mb-4">made.</h5>
              <ul className="space-y-3 text-sm text-ink-2">
                <li><a href="https://airlock.made-by-ac.com" className="hover:text-ink">Airlock</a></li>
                <li><a href="https://made-by-ac.com" className="hover:text-ink">The studio</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-line flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-muted">
          <span>Stash is a made. product. Built local-first.</span>
          <span>No servers. No tracking. Your memory stays yours.</span>
        </div>
      </footer>

      {/* Install guide overlay */}
      <AnimatePresence>
        {showGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-ink/70 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="w-full max-w-xl bg-paper border border-line rounded-3xl overflow-hidden shadow-2xl">
              <div className="px-8 py-7 border-b border-line flex justify-between items-start">
                <div>
                  <h2 className="font-serif font-medium text-2xl tracking-tight">Add Stash to Chrome</h2>
                  <p className="text-sm text-muted mt-1">Three quick steps and it is yours.</p>
                </div>
                <button onClick={() => setShowGuide(false)} className="w-10 h-10 rounded-full bg-paper-2 hover:bg-line grid place-items-center text-muted">✕</button>
              </div>
              <div className="px-8 py-7 space-y-6">
                {[
                  ["Unzip it", <>Find <span className="font-mono text-ink">stash-extension.zip</span> in your downloads and expand it into a folder.</>],
                  ["Open extensions", <>Go to <span className="font-mono text-ink cursor-pointer underline" onClick={() => window.open("chrome://extensions", "_blank")}>chrome://extensions</span> and switch on <b>Developer mode</b>.</>],
                  ["Load unpacked", <>Click <b>Load unpacked</b> and choose the folder you just expanded. Stash is live.</>],
                ].map(([t, d], i) => (
                  <div key={i} className="flex gap-4">
                    <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-ink text-paper grid place-items-center font-serif font-semibold">{i + 1}</span>
                    <div className="pt-1">
                      <p className="font-semibold">{t as string}</p>
                      <p className="text-sm text-ink-2 leading-relaxed mt-0.5">{d}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-8 py-6 bg-paper-2 flex justify-end">
                <button onClick={() => setShowGuide(false)} className="px-7 py-3 bg-ink text-paper rounded-full font-semibold flex items-center gap-2 hover:opacity-90">
                  Got it <ArrowRight size={15} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
