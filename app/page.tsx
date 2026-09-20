"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [opening, setOpening] = useState(true);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setOpening(false), reduced ? 250 : 2200);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <main className="min-h-screen bg-[#080909] px-5 py-10 text-[#f4f1e8] grid place-items-center">
      {opening && <div className="brand-splash" aria-label="Abrindo Barbearia Almeida">
        <div className="brand-splash-glow" />
        <div className="brand-splash-logo"><img src="/logo-viking.png" alt="Logo da Barbearia Almeida" /></div>
        <p>BARBEARIA</p>
        <h1><span>B.</span> ALMEIDA</h1>
        <small>EM ALTO PADRÃO</small>
        <i aria-hidden="true" />
      </div>}
      <section className="w-full max-w-2xl rounded-3xl border border-[#3c3828] bg-[radial-gradient(circle_at_50%_0%,#3d3215,transparent_55%),#151716] p-7 text-center shadow-2xl sm:p-12">
        <img src="/logo-viking.png" alt="Logo da Barbearia Almeida" className="mx-auto mb-5 h-28 w-28 rounded-full border-2 border-[#e9682a] object-cover shadow-[0_0_35px_#e9682a44]" />
        <p className="text-xs font-bold tracking-[.32em] text-[#b9a76d]">BARBEARIA EM UBERABA</p>
        <h1 className="mt-4 text-4xl font-black tracking-[.14em] sm:text-5xl"><span className="text-[#d6ae42]">B.</span> ALMEIDA</h1>
        <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-[#9b9f9b]">Agende seu atendimento ou entre na área exclusiva da equipe.</p>
        <div className="mt-9 grid gap-4 sm:grid-cols-2">
          <a href="/agendar" className="rounded-xl bg-[#d6ae42] p-6 text-left text-black transition hover:bg-[#e5c25b]">
            <span className="text-2xl">✂️</span><strong className="mt-3 block text-lg">Sou cliente</strong><small className="mt-1 block text-black/70">Agendar um horário</small>
          </a>
          <a href="/login" className="rounded-xl border border-[#6d5b2c] bg-[#101210] p-6 text-left text-[#d6ae42] transition hover:bg-[#211d13]">
            <span className="text-2xl">🔐</span><strong className="mt-3 block text-lg">Lucas ou Sinvas</strong><small className="mt-1 block text-[#9b9f9b]">Entrar no painel da equipe</small>
          </a>
        </div>
        <p className="mt-7 text-xs text-[#6f736f]">Av. Ramid Mauad, 1005 — Uberaba, MG</p>
      </section>
    </main>
  );
}
