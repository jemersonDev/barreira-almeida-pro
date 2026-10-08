"use client";
import { useEffect, useMemo, useState } from "react";
import StaffNav from "../components/StaffNav";

type Service = { barberId: string; id: string; name: string; price: number; duration: number };
type Busy = { start: string; end: string; kind: string };

function localSlot(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`);
}
function slotLabel(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export default function Manual() {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
  const [services, setServices] = useState<Service[]>([]),
    [role, setRole] = useState(""),
    [own, setOwn] = useState(""),
    [barberId, setBarberId] = useState(""),
    [serviceId, setServiceId] = useState(""),
    [date, setDate] = useState(today),
    [time, setTime] = useState(""),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [busy, setBusy] = useState<Busy[]>([]),
    [loadingTimes, setLoadingTimes] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  useEffect(() => {
    Promise.all([
      fetch("/api/catalog", { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/staff/appointments?date=${today}`).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        return j;
      }),
    ])
      .then(([c, a]) => {
        setServices(c.services);
        setRole(a.profile.role);
        const id = a.profile.id === "profile-sinvas" ? "sinvas" : "lucas";
        setOwn(id);
        setBarberId(id);
        setServiceId(c.services.find((s: Service) => s.barberId === id)?.id || "");
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!barberId || !date) return;
    setLoadingTimes(true);
    setTime("");
    fetch(`/api/bookings?barber=${barberId}&date=${date}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j) => setBusy([...(j.occupied || []), ...(j.blocks || [])]))
      .catch(() => setError("Não foi possível carregar os horários."))
      .finally(() => setLoadingTimes(false));
  }, [barberId, date]);
  const availableServices = services.filter((s) => s.barberId === barberId);
  const service = availableServices.find((s) => s.id === serviceId);
  const available = useMemo(() => {
    if (!service || localSlot(date, "12:00").getDay() === 0) return [];
    const result: string[] = [];
    for (let m = 9 * 60; m + service.duration <= 20 * 60; m += 30) {
      const label = slotLabel(m),
        start = localSlot(date, label),
        end = new Date(start.getTime() + service.duration * 60000);
      if (start.getTime() <= Date.now()) continue;
      if (!busy.some((b) => start < new Date(b.end) && end > new Date(b.start)))
        result.push(label);
    }
    return result;
  }, [busy, date, service]);
  async function save() {
    setError("");
    if (!time) {
      setError("Escolha um horário disponível.");
      return;
    }
    const r = await fetch("/api/staff/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          barberId: own,
          serviceId,
          date,
          time,
          name,
          phone,
        }),
      }),
      j = await r.json();
    if (!r.ok) {
      setError(j.error);
      return;
    }
    setDone(true);
  }
  if (error && !role)
    return (
      <main className="min-h-screen bg-[#080909] p-5 text-white grid place-items-center">
        <section className="max-w-md text-center">
          <h1 className="text-2xl font-black">Acesso protegido</h1>
          <p className="my-4">{error}</p>
          <a href="/login" className="block bg-[#d6ae42] p-4 text-black">
            ENTRAR
          </a>
        </section>
      </main>
    );
  return (
    <main className="min-h-screen bg-[#080909] p-4 pb-32 text-white grid place-items-center">
      <section className="w-full max-w-xl rounded-xl border border-[#333] bg-[#151716] p-6">
        <a href="/operacao" className="text-xl font-black">
          <span className="text-[#d6ae42]">B.</span> ALMEIDA
        </a>
        <h1 className="my-5 text-3xl font-black">Novo agendamento</h1>
        {done ? (
          <div className="rounded border border-green-900 p-6 text-center">
            <b className="text-green-400">Agendamento confirmado!</b>
            <button
              onClick={() => {
                setDone(false);
                setName("");
                setPhone("");
                setTime("");
              }}
              className="mt-4 block w-full bg-[#d6ae42] p-3 font-black text-black"
            >
              AGENDAR OUTRO
            </button>
            <a href="/operacao" className="mt-3 block text-[#d6ae42]">
              Voltar para a agenda
            </a>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="rounded-lg border border-[#5e502a] bg-[#211d13] p-4">
              <small className="block text-[9px] font-black tracking-wider text-[#d6ae42]">AGENDA DO PROFISSIONAL</small>
              <b className="mt-1 block">{own === "lucas" ? "Lucas" : "Sinvas"}</b>
              <p className="mt-1 text-xs text-[#888]">Cada profissional agenda somente os próprios clientes.</p>
            </div>
            <label>
              Serviço
              <select
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  setTime("");
                }}
                className="mt-2 w-full rounded bg-[#090a09] p-3"
              >
                {availableServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.duration} min · R$ {s.price}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Data
              <input
                aria-label="Data"
                type="date"
                min={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-2 w-full rounded bg-[#090a09] p-3"
              />
            </label>
            <fieldset>
              <legend className="mb-2">Horários disponíveis</legend>
              {loadingTimes ? (
                <p className="rounded bg-[#090a09] p-4 text-sm text-[#888]">
                  Carregando horários...
                </p>
              ) : available.length === 0 ? (
                <p className="rounded border border-[#3b3422] bg-[#090a09] p-4 text-sm text-[#aaa]">
                  Nenhum horário livre nesta data.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {available.map((slot) => (
                    <button
                      type="button"
                      key={slot}
                      aria-pressed={time === slot}
                      onClick={() => setTime(slot)}
                      className={`rounded border p-3 text-sm font-black ${time === slot ? "border-[#d6ae42] bg-[#d6ae42] text-black" : "border-[#3b3e3b] bg-[#090a09] text-white"}`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </fieldset>
            <input
              aria-label="Nome do cliente"
              placeholder="Nome do cliente"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded bg-[#090a09] p-3"
            />
            <input
              aria-label="WhatsApp do cliente"
              placeholder="WhatsApp"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded bg-[#090a09] p-3"
            />
            {error && (
              <p className="rounded border border-red-900 p-3 text-red-400">
                {error}
              </p>
            )}
            <button
              onClick={save}
              disabled={!time || loadingTimes}
              className="rounded bg-[#d6ae42] p-4 font-black text-black disabled:opacity-40"
            >
              CONFIRMAR AGENDAMENTO
            </button>
            <a href="/operacao" className="text-center text-[#d6ae42]">
              Cancelar
            </a>
          </div>
        )}
      </section>
    <StaffNav active="novo"/></main>
  );
}
