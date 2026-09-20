"use client";
import { useEffect, useState } from "react";
type Service = {
  id: string;
  name: string;
  durationMinutes: number | null;
  priceCents: number;
  active: boolean;
  sortOrder: number;
  imageUrl: string;
  customImage: boolean;
};
type Barber = {
  id: string;
  name: string;
  ownerShareBps: number;
  barberShareBps: number;
  active: boolean;
};
type Profile = { name: string; role: "owner" | "barber"; photoUrl?: string | null };
export default function Settings() {
  const [services, setServices] = useState<Service[]>([]),
    [team, setTeam] = useState<Barber[]>([]),
    [profile, setProfile] = useState<Profile | null>(null),
    [role, setRole] = useState<"owner" | "barber">("barber"),
    [tab, setTab] = useState<"servicos" | "equipe">("servicos"),
    [loading, setLoading] = useState(true),
    [savingServices, setSavingServices] = useState(false),
    [uploadingService, setUploadingService] = useState(""),
    [error, setError] = useState(""),
    [saved, setSaved] = useState("");
  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/staff/settings", { cache: "no-store" }),
        j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setServices(j.services);
      setTeam(j.team);
      setRole(j.profile.role);
      setProfile(j.profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function save(body: object) {
    setError("");
    setSaved("");
    const r = await fetch("/api/staff/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      j = await r.json();
    if (!r.ok) {
      setError(j.error);
      return;
    }
    setSaved("Alteração salva com segurança.");
    await load();
  }
  async function saveAllServices() {
    setSavingServices(true);
    try {
      await save({ type: "services", services });
    } finally {
      setSavingServices(false);
    }
  }
  async function uploadPhoto(file?: File) {
    if (!file) return;
    setError(""); setSaved(""); setLoading(true);
    try {
      const form = new FormData(); form.append("photo", file);
      const r = await fetch("/api/staff/photo", { method: "POST", body: form });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não foi possível salvar a foto.");
      setSaved("Foto atualizada. Ela já aparece no painel e no agendamento dos clientes.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar a foto."); setLoading(false); }
  }
  async function uploadServicePhoto(serviceId: string, file?: File) {
    if (!file) return;
    setError(""); setSaved(""); setUploadingService(serviceId);
    try {
      const form = new FormData();
      form.append("serviceId", serviceId);
      form.append("photo", file);
      const r = await fetch("/api/staff/service-photo", { method: "POST", body: form });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não foi possível salvar a imagem.");
      setSaved("Imagem do serviço atualizada. Ela já aparece para os clientes.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar a imagem.");
    } finally { setUploadingService(""); }
  }
  async function resetServicePhoto(serviceId: string) {
    setError(""); setSaved(""); setUploadingService(serviceId);
    try {
      const r = await fetch(`/api/staff/service-photo?service=${encodeURIComponent(serviceId)}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não foi possível restaurar a imagem.");
      setSaved("Imagem profissional padrão restaurada.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível restaurar a imagem.");
    } finally { setUploadingService(""); }
  }
  if (error && !services.length && !loading)
    return (
      <main className="min-h-screen bg-[#080909] p-5 text-[#f4f1e8] flex items-center justify-center">
        <section className="w-full max-w-md rounded-2xl border border-[#3f3825] bg-[#151716] p-8 text-center">
          <div className="text-4xl">🔒</div>
          <h1 className="mt-4 text-2xl font-black">Meus serviços e preços</h1>
          <p className="mt-3 text-sm text-[#888]">{error}</p>
          <a
            href="/login"
            className="mt-6 block rounded-lg bg-[#d6ae42] p-4 font-black text-black"
          >
            ENTRAR COM CONTA AUTORIZADA
          </a>
        </section>
      </main>
    );
  return (
    <main className="min-h-screen bg-[#080909] p-4 text-[#f4f1e8] sm:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex items-center justify-between">
          <div>
            <a href="/gestao" className="text-xl font-black tracking-[.16em]">
              <span className="text-[#d6ae42]">B.</span> ALMEIDA
            </a>
            <p className="mt-2 text-xs text-[#777]">
              Cada profissional administra os próprios preços
            </p>
          </div>
          <a
            href="/operacao"
            className="rounded-lg border border-[#5e502a] p-3 text-xs font-black text-[#d6ae42]"
          >
            VOLTAR
          </a>
        </header>
        <h1 className="mb-2 text-3xl font-black">Meus serviços e preços</h1>
        <p className="mb-5 text-sm text-[#888]">
          Os clientes verão estes valores depois de escolher você.
        </p>
        <section className="mb-5 flex flex-col items-center gap-4 rounded-xl border border-[#5e502a] bg-[#151716] p-5 sm:flex-row">
          {profile?.photoUrl ? <img src={profile.photoUrl} alt={`Foto de ${profile.name}`} className="h-24 w-24 rounded-full border-2 border-[#d6ae42] object-cover" /> : <span className="grid h-24 w-24 place-items-center rounded-full border-2 border-[#d6ae42] text-2xl font-black text-[#d6ae42]">{profile?.name?.slice(0,2).toUpperCase() || "BA"}</span>}
          <div className="flex-1 text-center sm:text-left"><h2 className="text-xl font-black">Minha foto de perfil</h2><p className="mt-2 text-sm text-[#888]">A foto aparece ao lado do seu nome e para o cliente escolher o barbeiro.</p><label className="mt-4 inline-block rounded-lg bg-[#d6ae42] px-5 py-3 text-xs font-black text-black">{loading ? "ENVIANDO..." : profile?.photoUrl ? "TROCAR FOTO" : "ADICIONAR FOTO"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={loading} onChange={(e) => { const file=e.target.files?.[0]; uploadPhoto(file); e.currentTarget.value=""; }} className="sr-only" /></label><small className="mt-2 block text-[#666]">JPG, PNG ou WebP · máximo 5 MB</small></div>
        </section>
        <nav
          className={`mb-5 grid ${role === "owner" ? "grid-cols-2" : "grid-cols-1"} rounded-xl border border-[#2a2d2a] bg-[#121413] p-1`}
        >
          <button
              onClick={() => setTab("servicos")}
              className={`rounded-lg p-3 text-xs font-black ${tab === "servicos" ? "bg-[#d6ae42] text-black" : "text-[#888]"}`}
            >
              SERVIÇOS
            </button>
          {role === "owner" && <button
            onClick={() => setTab("equipe")}
            className={`rounded-lg p-3 text-xs font-black ${tab === "equipe" ? "bg-[#d6ae42] text-black" : "text-[#888]"}`}
          >
            EQUIPE E COMISSÃO
          </button>}
        </nav>
        {error && (
          <p className="mb-4 rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-300">
            {error}
          </p>
        )}
        {saved && (
          <p className="mb-4 rounded-lg border border-green-900 bg-green-950/30 p-4 text-sm text-green-300">
            ✓ {saved}
          </p>
        )}
        {loading ? (
          <p className="p-10 text-center text-[#777]">Carregando...</p>
        ) : tab === "servicos" ? (
          <section className="grid gap-3">
            {services.map((s, i) => (
              <article
                key={s.id}
                className="rounded-xl border border-[#2a2d2a] bg-[#151716] p-4"
              >
                <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <img src={s.imageUrl} alt={`Imagem de ${s.name}`} className="aspect-[4/3] w-full rounded-lg border border-[#3b3524] object-cover sm:w-48" />
                  <div>
                    <p className="text-xs font-bold text-[#d6ae42]">IMAGEM DO SERVIÇO</p>
                    <p className="mt-1 text-xs text-[#777]">{s.customImage ? "Sua imagem personalizada está ativa." : "Imagem profissional padrão ativa."}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <label className="cursor-pointer rounded-lg bg-[#d6ae42] px-4 py-3 text-xs font-black text-black">
                        {uploadingService === s.id ? "ENVIANDO..." : "TROCAR IMAGEM"}
                        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploadingService)} onChange={(e) => { const file=e.target.files?.[0]; uploadServicePhoto(s.id, file); e.currentTarget.value=""; }} className="sr-only" />
                      </label>
                      {s.customImage && <button type="button" disabled={Boolean(uploadingService)} onClick={() => resetServicePhoto(s.id)} className="rounded-lg border border-[#5e502a] px-4 py-3 text-xs font-black text-[#d6ae42]">USAR IMAGEM PADRÃO</button>}
                    </div>
                    <small className="mt-2 block text-[#666]">JPG, PNG ou WebP · máximo 5 MB</small>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_130px_130px_90px]">
                  <label className="text-[9px] text-[#d6ae42]">
                    SERVIÇO
                    <input
                      value={s.name}
                      onChange={(e) => setServices((v) => v.map((x, n) => n === i ? { ...x, name: e.target.value } : x))}
                      className="mt-2 w-full rounded border border-[#333] bg-[#0d0f0e] p-3"
                    />
                  </label>
                  <label className="text-[9px] text-[#d6ae42]">
                    PREÇO (R$)
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={s.priceCents < 0 ? "" : s.priceCents / 100}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) =>
                        setServices((v) =>
                          v.map((x, n) =>
                            n === i
                              ? {
                                  ...x,
                                  priceCents:
                                    e.target.value === ""
                                      ? -1
                                      : Math.round(
                                          Number(e.target.value) * 100,
                                        ),
                                }
                              : x,
                          ),
                        )
                      }
                      className="mt-2 w-full rounded border border-[#333] bg-[#0d0f0e] p-3"
                    />
                  </label>
                  <label className="text-[9px] text-[#d6ae42]">
                    DURAÇÃO
                    <input
                      type="number"
                      min="5"
                      max="240"
                      step="5"
                      value={s.durationMinutes ?? ""}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) =>
                        setServices((v) =>
                          v.map((x, n) =>
                            n === i
                              ? { ...x, durationMinutes: e.target.value === "" ? null : Number(e.target.value) }
                              : x,
                          ),
                        )
                      }
                      className="mt-2 w-full rounded border border-[#333] bg-[#0d0f0e] p-3"
                    />
                  </label>
                  <button
                    onClick={() =>
                      setServices((v) =>
                        v.map((x, n) =>
                          n === i ? { ...x, active: !x.active } : x,
                        ),
                      )
                    }
                    className={`mt-5 rounded p-3 text-xs font-black ${s.active ? "bg-green-900 text-green-300" : "bg-[#333] text-[#aaa]"}`}
                  >
                    {s.active ? "ATIVO" : "INATIVO"}
                  </button>
                </div>
              </article>
            ))}
            <button
              onClick={saveAllServices}
              disabled={savingServices}
              className="sticky bottom-4 w-full rounded-xl bg-[#d6ae42] p-4 text-sm font-black text-black shadow-[0_8px_30px_rgba(214,174,66,.22)] disabled:cursor-wait disabled:opacity-60"
            >
              {savingServices ? "SALVANDO TODOS..." : "SALVAR TODOS OS SERVIÇOS"}
            </button>
          </section>
        ) : (
          <section className="grid gap-4">
            {team.map((b, i) => (
              <article
                key={b.id}
                className="rounded-xl border border-[#2a2d2a] bg-[#151716] p-5"
              >
                <h2 className="text-xl font-black">{b.name}</h2>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="text-[9px] text-[#d6ae42]">
                    PARTE DO LUCAS (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      disabled={b.id === "lucas"}
                      value={b.ownerShareBps < 0 ? "" : b.ownerShareBps / 100}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => {
                        const empty = e.target.value === "";
                        const owner = empty
                          ? -1
                          : Math.round(Number(e.target.value) * 100);
                        setTeam((v) =>
                          v.map((x, n) =>
                            n === i
                              ? {
                                  ...x,
                                  ownerShareBps: owner,
                                  barberShareBps: empty ? -1 : 10000 - owner,
                                }
                              : x,
                          ),
                        );
                      }}
                      className="mt-2 w-full rounded border border-[#333] bg-[#0d0f0e] p-3 disabled:opacity-40"
                    />
                  </label>
                  <label className="text-[9px] text-[#d6ae42]">
                    PARTE DO PROFISSIONAL (%)
                    <input
                      type="number"
                      disabled
                      value={b.barberShareBps < 0 ? "" : b.barberShareBps / 100}
                      className="mt-2 w-full rounded border border-[#333] bg-[#0d0f0e] p-3 disabled:opacity-40"
                    />
                  </label>
                </div>
                <p className="mt-3 text-xs text-[#777]">
                  Alterações valem apenas para novos agendamentos.
                </p>
                <button
                  onClick={() => save({ type: "barber", ...b })}
                  className="mt-4 w-full rounded-lg bg-[#d6ae42] p-3 text-xs font-black text-black"
                >
                  SALVAR COMISSÃO
                </button>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
