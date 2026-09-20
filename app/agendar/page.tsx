"use client";

import { useEffect, useMemo, useState } from "react";
import { requestPushToken } from "../../lib/firebase-client";

type Barber = {
  id: string;
  name: string;
  role: string;
  initials: string;
  instagram?: string | null;
  photoUrl?: string | null;
};
type Service = {
  barberId: string;
  id: string;
  name: string;
  duration: number;
  price: number;
  priceCents: number;
  imageUrl: string;
};
const slots = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
];

export default function BookingPage() {
  const today = useMemo(
    () =>
      new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
    [],
  );
  const [step, setStep] = useState(1);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [barber, setBarber] = useState("");
  const [service, setService] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [manageUrl, setManageUrl] = useState("");
  const [savedBooking, setSavedBooking] = useState<{ id: string; token: string } | null>(null);
  const [pushStatus, setPushStatus] = useState("");
  const [savedManageUrl, setSavedManageUrl] = useState("");
  const [busy, setBusy] = useState<
    { start: string; end: string; kind: string }[]
  >([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const availableServices = useMemo(
    () => services.filter((s) => s.barberId === barber),
    [services, barber],
  );
  const chosenService = useMemo(
    () => availableServices.find((s) => s.id === service),
    [availableServices, service],
  );
  const chosenBarber = barbers.find((b) => b.id === barber);
  useEffect(() => {
    setSavedManageUrl(localStorage.getItem("barbearia-almeida-manage-url") || "");
    fetch("/api/catalog", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setBarbers(j.barbers || []);
        setServices(j.services || []);
      })
      .catch((e) =>
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível carregar os serviços.",
        ),
      )
      .finally(() => setLoadingCatalog(false));
  }, []);
  useEffect(() => {
    if (step !== 3 || !barber || !date) return;
    setLoadingSlots(true);
    fetch(`/api/bookings?barber=${encodeURIComponent(barber)}&date=${date}`)
      .then((r) => r.json())
      .then((j) => setBusy([...(j.occupied || []), ...(j.blocks || [])]))
      .catch(() => setBusy([]))
      .finally(() => setLoadingSlots(false));
  }, [step, barber, date]);
  function unavailable(slot: string) {
    if (!chosenService) return false;
    const start = new Date(`${date}T${slot}:00-03:00`),
      end = new Date(start.getTime() + chosenService.duration * 60000);
    return busy.some((b) => start < new Date(b.end) && end > new Date(b.start));
  }
  const canNext =
    step === 1
      ? !!barber
      : step === 2
        ? !!service
        : step === 3
          ? !!date && !!time
          : !!name.trim() && phone.replace(/\D/g, "").length >= 10 && consent;
  async function next() {
    if (!canNext) return;
    if (step < 4) {
      setStep(step + 1);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          barberId: barber,
          serviceId: service,
          date,
          time,
          name,
          phone,
          consent,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Não foi possível agendar.");
      const url = `/meu-agendamento?id=${encodeURIComponent(result.booking.id)}&token=${encodeURIComponent(result.booking.token)}`;
      setManageUrl(url);
      setSavedBooking({ id: result.booking.id, token: result.booking.token });
      setSavedManageUrl(url);
      localStorage.setItem("barbearia-almeida-manage-url", url);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível agendar.");
    } finally {
      setSaving(false);
    }
  }
  if (done)
    return (
      <main className="min-h-screen bg-[#080909] text-[#f4f1e8] p-5 flex items-center justify-center">
        <section className="w-full max-w-lg border border-[#3c3828] bg-[#151716] rounded-2xl p-8 text-center">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-[#d6ae42] text-3xl text-black">
            ✓
          </div>
          <p className="text-xs tracking-[.28em] text-[#d6ae42]">
            SOLICITAÇÃO ENVIADA
          </p>
          <h1 className="mt-3 text-3xl font-black">Recebemos seu horário, {name}!</h1>
          <div className="my-6 rounded-xl border border-[#2a2d2a] bg-[#0d0f0e] p-5 text-left leading-8">
            <b>{chosenBarber?.name}</b>
            <br />
            {chosenService?.name} · R$ {chosenService?.price}
            <br />
            {new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR")} às {time}
          </div>
          <p className="text-sm leading-6 text-[#8d918d]">
            Aguarde o barbeiro confirmar. Ative as notificações para receber a confirmação, alterações e lembretes neste aparelho.
          </p>
          <button
            onClick={async () => {
              if (!savedBooking) return;
              setPushStatus("Ativando...");
              try {
                const token = await requestPushToken();
                const response = await fetch("/api/push/customer", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ appointmentId: savedBooking.id, bookingToken: savedBooking.token, token }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || "Não foi possível ativar.");
                setPushStatus("✓ Notificações ativadas neste aparelho.");
              } catch (e) {
                setPushStatus(e instanceof Error ? e.message : "Não foi possível ativar.");
              }
            }}
            className="mt-5 block w-full rounded-lg bg-[#d6ae42] p-4 font-black text-black"
          >
            ATIVAR NOTIFICAÇÕES DO MEU HORÁRIO
          </button>
          {pushStatus && <p role="status" className="mt-3 text-sm text-[#d6ae42]">{pushStatus}</p>}
          <a
            href={manageUrl}
            className="mt-3 block w-full rounded-lg border border-[#6c5b2b] p-4 font-black text-[#d6ae42]"
          >
            GERENCIAR AGENDAMENTO
          </a>
          <button
            onClick={() => {
              setDone(false);
              setStep(1);
              setBarber("");
              setService(null);
              setTime("");
            }}
            className="mt-3 w-full rounded-lg bg-[#d6ae42] p-4 font-black text-black"
          >
            FAZER OUTRO AGENDAMENTO
          </button>
        </section>
      </main>
    );
  return (
    <main className="min-h-screen bg-[#080909] text-[#f4f1e8]">
      <header className="border-b border-[#2a2d2a] bg-[radial-gradient(circle_at_50%_-50%,#493b17,transparent_65%)] px-5 py-8 text-center">
        <a href="/" className="text-3xl font-black tracking-[.18em]">
          <span className="text-[#d6ae42]">B.</span> ALMEIDA
        </a>
        <p className="mt-2 text-[10px] tracking-[.35em] text-[#b9a76d]">
          EM ALTO PADRÃO
        </p>
        <p className="mt-4 text-xs text-[#8d918d]">
          Av. Ramid Mauad, 1005 — Uberaba, MG
        </p>
      </header>
      <section className="mx-auto max-w-3xl px-4 py-7">
        <a href={savedManageUrl || "/meu-agendamento"} className="mb-5 block rounded-lg border border-[#6c5b2b] bg-[#151716] p-4 text-center text-xs font-black text-[#d6ae42]">MEU AGENDAMENTO · VER, CANCELAR OU REAGENDAR</a>
        <div className="mb-8 flex items-center">
          {[1, 2, 3, 4].map((n, i) => (
            <div key={n} className="flex flex-1 items-center last:flex-none">
              <button
                onClick={() => n < step && setStep(n)}
                className={`grid h-9 w-9 place-items-center rounded-full border text-xs font-black ${n === step ? "border-[#d6ae42] bg-[#d6ae42] text-black" : n < step ? "border-[#45b979] bg-[#45b979] text-black" : "border-[#353835] bg-[#1a1c1b] text-[#777]"}`}
              >
                {n < step ? "✓" : n}
              </button>
              {i < 3 && (
                <span
                  className={`h-px flex-1 ${n < step ? "bg-[#45b979]" : "bg-[#333]"}`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mb-6">
          <p className="text-xs font-bold tracking-[.22em] text-[#d6ae42]">
            ETAPA {step} DE 4
          </p>
          <h1 className="mt-2 text-3xl font-black">
            {step === 1
              ? "Escolha o barbeiro"
              : step === 2
                ? "Escolha o serviço"
                : step === 3
                  ? "Escolha o horário"
                  : "Confirme seus dados"}
          </h1>
          <p className="mt-2 text-sm text-[#8d918d]">
            {step === 1
              ? "Com quem você quer agendar?"
              : step === 2
                ? "Selecione o que deseja fazer."
                : step === 3
                  ? "Mostramos apenas horários realmente disponíveis."
                  : "Usaremos seu WhatsApp somente sobre este atendimento."}
          </p>
        </div>
        {error && step < 4 && (
          <p className="mb-4 rounded-lg border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">
            {error}
          </p>
        )}
        {step === 1 && (
          <>
            {loadingCatalog ? (
              <p className="rounded-xl border border-[#2a2d2a] bg-[#151716] p-8 text-center text-[#8d918d]">
                Carregando profissionais e serviços...
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {barbers.map((b) => (
                  <article
                    key={b.id}
                    className={`rounded-xl border p-5 ${barber === b.id ? "border-[#d6ae42] bg-[#282316]" : "border-[#2a2d2a] bg-[#151716]"}`}
                  >
                    <button
                      onClick={() => {
                        setBarber(b.id);
                        setService(null);
                      }}
                      className="block w-full text-left"
                    >
                      {b.photoUrl ? <img src={b.photoUrl} alt={`Foto de ${b.name}`} className="mb-4 h-20 w-20 rounded-full border-2 border-[#d6ae42] object-cover" /> : <span className="mb-4 grid h-20 w-20 place-items-center rounded-full border border-[#d6ae42] text-xl font-black text-[#d6ae42]">{b.initials}</span>}
                      <b className="block text-xl">{b.name}</b>
                      <small className="text-[#8d918d]">{b.role}</small>
                    </button>
                    {b.instagram && (
                      <a
                        href={`https://www.instagram.com/${b.instagram.replace(/^@/, "")}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 block w-fit rounded-full border border-[#5e502a] px-3 py-2 text-xs font-bold text-[#d6ae42] hover:bg-[#d6ae42] hover:text-black"
                      >
                        Abrir Instagram · @{b.instagram.replace(/^@/, "")} ↗
                      </a>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        )}
        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {availableServices.map((s) => (
              <button
                key={s.id}
                onClick={() => setService(s.id)}
                className={`group overflow-hidden rounded-xl border text-left transition ${service === s.id ? "border-[#d6ae42] bg-[#282316] shadow-[0_0_0_1px_rgba(214,174,66,.2)]" : "border-[#2a2d2a] bg-[#151716]"}`}
              >
                <img src={s.imageUrl} alt={`Imagem do serviço ${s.name}`} className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                <span className="flex items-end justify-between gap-3 p-4">
                  <span>
                    <b className="block">{s.name}</b>
                    <small className="text-[#8d918d]">{s.duration} minutos</small>
                  </span>
                  <strong className="whitespace-nowrap text-xl text-[#d6ae42]">R$ {s.price.toFixed(2).replace(".", ",")}</strong>
                </span>
              </button>
            ))}
          </div>
        )}
        {step === 3 && (
          <>
            <label className="mb-5 block text-xs font-bold tracking-wider text-[#d6ae42]">
              DATA
              <input
                type="date"
                min={today}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setTime("");
                }}
                className="mt-2 block w-full rounded-lg border border-[#2a2d2a] bg-[#151716] p-4 text-white"
              />
            </label>
            {loadingSlots && (
              <p className="mb-3 text-xs text-[#d6ae42]">
                Atualizando disponibilidade...
              </p>
            )}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {slots.map((s) => {
                const occupied = unavailable(s);
                return (
                  <button
                    disabled={occupied || loadingSlots}
                    key={s}
                    onClick={() => setTime(s)}
                    className={`rounded-lg border p-4 font-black ${time === s ? "border-[#d6ae42] bg-[#d6ae42] text-black" : occupied ? "cursor-not-allowed border-[#1d1f1e] bg-[#101110] text-[#444]" : "border-[#2a2d2a] bg-[#171918] text-white"}`}
                  >
                    {s}
                    <small className="mt-1 block text-[8px] font-normal">
                      {occupied ? "INDISPONÍVEL" : "DISPONÍVEL"}
                    </small>
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-[#8d918d]">
              O sistema considera a duração do serviço, almoço, bloqueios e
              reservas já confirmadas.
            </p>
          </>
        )}
        {step === 4 && (
          <div className="grid gap-4">
            <div className="rounded-xl border border-[#4b4124] bg-[#211d13] p-5 text-sm leading-7">
              <b className="text-[#d6ae42]">Resumo</b>
              <br />
              {chosenBarber?.name} · {chosenService?.name}
              <br />
              {new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR")} às{" "}
              {time} · R$ {chosenService?.price}
            </div>
            <label className="text-xs font-bold text-[#d6ae42]">
              SEU NOME *
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 block w-full rounded-lg border border-[#2a2d2a] bg-[#151716] p-4 text-white"
                placeholder="Nome completo"
              />
            </label>
            <label className="text-xs font-bold text-[#d6ae42]">
              WHATSAPP *
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-2 block w-full rounded-lg border border-[#2a2d2a] bg-[#151716] p-4 text-white"
                placeholder="(34) 99999-9999"
                inputMode="tel"
              />
            </label>
            <label className="flex gap-3 text-xs text-[#aaa]">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />{" "}
              Concordo com o uso dos dados para administrar este agendamento.
            </label>
            {error && (
              <p className="rounded-lg border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">
                {error}
              </p>
            )}
          </div>
        )}
        <div className="mt-7 flex gap-3">
          {step > 1 && (
            <button
              disabled={saving}
              onClick={() => setStep(step - 1)}
              className="flex-1 rounded-lg border border-[#6d5b2c] p-4 font-black text-[#d6ae42]"
            >
              VOLTAR
            </button>
          )}
          <button
            disabled={!canNext || saving}
            onClick={next}
            className="flex-[2] rounded-lg bg-[#d6ae42] p-4 font-black text-black disabled:cursor-not-allowed disabled:opacity-30"
          >
            {saving
              ? "CONFIRMANDO..."
              : step === 4
                ? "CONFIRMAR AGENDAMENTO"
                : "PRÓXIMO →"}
          </button>
        </div>
      </section>
    </main>
  );
}
