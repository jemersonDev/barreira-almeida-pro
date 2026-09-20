"use client";
import { useEffect, useState } from "react";
type Booking = {
  id: string;
  status: string;
  startsAt: string;
  barberId: string;
  duration: number;
  barberName: string;
  serviceName: string;
  priceCents: number;
  customerName: string;
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
  "19:30",
];
const statusLabel: Record<string, string> = { pending: "Aguardando confirmação", confirmed: "Confirmado pelo barbeiro", completed: "Concluído", cancelled: "Cancelado", no_show: "Não compareceu" };
export default function ManageBooking() {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
  const [booking, setBooking] = useState<Booking | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [date, setDate] = useState(""),
    [time, setTime] = useState(""),
    [busy, setBusy] = useState<{ start: string; end: string }[]>([]),
    [loadingSlots, setLoadingSlots] = useState(false),
    [saving, setSaving] = useState(false),
    [confirmCancel, setConfirmCancel] = useState(false),
    [success, setSuccess] = useState(""),
    [lookupPhone, setLookupPhone] = useState(""),
    [lookupName, setLookupName] = useState(""),
    [lookupResults, setLookupResults] = useState<Booking[]>([]);
  const params =
      typeof window !== "undefined"
        ? new URLSearchParams(location.search)
        : new URLSearchParams(),
    id = params.get("id") || "",
    token = params.get("token") || "";
  useEffect(() => {
    if (!id || !token) {
      setLoading(false);
      return;
    }
    fetch(
      `/api/bookings/manage?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`,
    )
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setBooking(j.booking);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, token]);
  useEffect(() => {
    if (!booking || !date) return;
    setLoadingSlots(true);
    setTime("");
    fetch(
      `/api/bookings?barber=${encodeURIComponent(booking.barberId)}&date=${date}`,
    )
      .then((r) => r.json())
      .then((j) => setBusy([...(j.occupied || []), ...(j.blocks || [])]))
      .catch(() => setBusy([]))
      .finally(() => setLoadingSlots(false));
  }, [booking, date]);
  function unavailable(slot: string) {
    if (!booking || !date) return true;
    const start = new Date(`${date}T${slot}:00-03:00`),
      end = new Date(start.getTime() + booking.duration * 60000);
    const currentStart = new Date(booking.startsAt);
    if (start.getTime() === currentStart.getTime()) return false;
    const closes = new Date(`${date}T20:00:00-03:00`);
    if (end > closes) return true;
    return busy.some(
      (b) =>
        start < new Date(b.end) &&
        end > new Date(b.start) &&
        new Date(b.start).getTime() !== currentStart.getTime(),
    );
  }
  async function update(action: "cancel" | "reschedule") {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const r = await fetch("/api/bookings/manage", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, token, action, date, time }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não foi possível atualizar.");
      setBooking((b) =>
        b ? { ...b, status: j.status, startsAt: j.startsAt || b.startsAt } : b,
      );
      setConfirmCancel(false);
      setSuccess(
        action === "cancel"
          ? "Agendamento cancelado com sucesso. O horário foi liberado."
          : "Agendamento reagendado com sucesso.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="min-h-screen bg-[#080909] p-5 text-[#f4f1e8] flex items-center justify-center">
      <section className="w-full max-w-lg rounded-2xl border border-[#2a2d2a] bg-[#151716] p-7">
        <a
          href="/agendar"
          className="block text-center text-2xl font-black tracking-[.16em]"
        >
          <span className="text-[#d6ae42]">B.</span> ALMEIDA
        </a>
        <p className="mt-2 text-center text-[10px] tracking-[.25em] text-[#d6ae42]">
          MEU AGENDAMENTO
        </p>
        {loading && (
          <p className="py-14 text-center text-[#888]">Carregando...</p>
        )}
        {!loading && !booking && !id && !token && (
          <section className="mt-6 rounded-xl border border-[#3b382a] bg-[#101210] p-5">
            <h1 className="text-xl font-black">Encontrar meu agendamento</h1>
            <p className="mt-3 text-sm leading-6 text-[#9a9e9a]">
              Digite o mesmo nome e telefone usados no agendamento.
            </p>
            <input
              value={lookupName}
              onChange={(e) => setLookupName(e.target.value)}
              placeholder="Nome do cliente"
              className="mt-5 w-full rounded-lg border border-[#343734] bg-[#080909] p-4 text-sm text-white"
            />
            <input value={lookupPhone} onChange={(e)=>setLookupPhone(e.target.value)} inputMode="tel" placeholder="Telefone com DDD" className="mt-3 w-full rounded-lg border border-[#343734] bg-[#080909] p-4 text-sm text-white" />
            <button
              onClick={async()=>{setError("");setSaving(true);try{const r=await fetch("/api/bookings/manage",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:lookupName,phone:lookupPhone})});const j=await r.json();if(!r.ok)throw new Error(j.error);setLookupResults(j.bookings||[])}catch(e){setError(e instanceof Error?e.message:"Não foi possível localizar.")}finally{setSaving(false)}}}
              disabled={saving||lookupName.trim().length<2||lookupPhone.replace(/\D/g,"").length<10}
              className="mt-3 w-full rounded-lg bg-[#d6ae42] p-4 font-black text-black"
            >
              {saving?"PROCURANDO...":"BUSCAR MEU AGENDAMENTO"}
            </button>
            {lookupResults.map(item=><button key={item.id} onClick={()=>{setBooking(item);setLookupResults([])}} className="mt-3 w-full rounded-lg border border-[#5b502f] p-4 text-left"><b className="block text-[#d6ae42]">{new Date(item.startsAt).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}</b><span className="text-sm text-[#aaa]">{item.serviceName} com {item.barberName}</span></button>)}
          </section>
        )}
        {error && (
          <p className="my-5 rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-300">
            {error}
          </p>
        )}
        {success && (
          <p
            role="status"
            className="my-5 rounded-lg border border-green-900 bg-green-950/30 p-4 text-sm font-bold text-green-300"
          >
            ✓ {success}
          </p>
        )}
        {booking && (
          <>
            <div className="my-6 rounded-xl border border-[#3b382a] bg-[#101210] p-5 leading-8">
              <b className="text-xl">{booking.customerName}</b>
              <br />
              <span className="text-[#d6ae42]">
                {booking.serviceName}
              </span> com {booking.barberName}
              <br />
              {new Date(booking.startsAt).toLocaleString("pt-BR", {
                dateStyle: "long",
                timeStyle: "short",
              })}
              <br />
              R$ {(booking.priceCents / 100).toFixed(2).replace(".", ",")}
              <span className="mt-3 block w-fit rounded-full border border-[#5b502f] px-3 py-1 text-[10px] uppercase text-[#d6ae42]">
                {statusLabel[booking.status] || booking.status}
              </span>
            </div>
            {booking.status !== "cancelled" && token && (
              <>
                <label className="text-[10px] font-bold text-[#d6ae42]">
                  NOVA DATA
                  <input
                    type="date"
                    min={today}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-[#2a2d2a] bg-[#0c0e0d] p-3 text-white"
                  />
                </label>
                {date && (
                  <div className="mt-4">
                    <p className="mb-3 text-[10px] font-bold text-[#d6ae42]">
                      HORÁRIOS DISPONÍVEIS
                    </p>
                    {loadingSlots ? (
                      <p className="text-sm text-[#888]">
                        Atualizando horários...
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {slots.map((slot) => {
                          const blocked = unavailable(slot);
                          return (
                            <button
                              key={slot}
                              disabled={blocked}
                              onClick={() => setTime(slot)}
                              className={`rounded-lg border p-3 text-sm font-black ${time === slot ? "border-[#d6ae42] bg-[#d6ae42] text-black" : blocked ? "border-[#222] bg-[#101110] text-[#444]" : "border-[#353835] bg-[#0c0e0d] text-white"}`}
                            >
                              {slot}
                              <small className="mt-1 block text-[7px] font-normal">
                                {blocked ? "OCUPADO" : "LIVRE"}
                              </small>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-3 text-xs text-[#888]">
                  Segunda a sábado, das 09:00 às 20:00. Pausas e almoço aparecem
                  automaticamente como indisponíveis.
                </p>
                <button
                  onClick={() => update("reschedule")}
                  disabled={!date || !time}
                  className="mt-4 w-full rounded-lg bg-[#d6ae42] p-4 font-black text-black disabled:opacity-30"
                >
                  REAGENDAR PARA {time || "OUTRO HORÁRIO"}
                </button>
                <button
                  disabled={saving}
                  onClick={() => setConfirmCancel(true)}
                  className="mt-3 w-full rounded-lg border border-red-900 p-4 text-xs font-black text-red-400"
                >
                  CANCELAR AGENDAMENTO
                </button>
              </>
            )}
            {!token && (
              <div className="rounded-xl border border-[#5b502f] bg-[#1d1a11] p-4 text-sm leading-6 text-[#c8b978]">
                Consulta realizada. Para cancelar ou reagendar com segurança, abra o acesso privado criado no aparelho usado para marcar. Nome e telefone não autorizam alterações.
              </div>
            )}
            {confirmCancel && (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="client-cancel-title"
                className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
              >
                <section className="w-full max-w-md rounded-2xl border border-red-900 bg-[#151716] p-6">
                  <h2 id="client-cancel-title" className="text-2xl font-black">
                    Cancelar seu agendamento?
                  </h2>
                  <p className="mt-3 text-sm text-[#aaa]">
                    O horário será liberado para outra pessoa.
                  </p>
                  <button
                    disabled={saving}
                    onClick={() => update("cancel")}
                    className="mt-6 w-full rounded-lg bg-red-700 p-4 font-black text-white disabled:opacity-40"
                  >
                    {saving ? "CANCELANDO..." : "SIM, CANCELAR"}
                  </button>
                  <button
                    disabled={saving}
                    onClick={() => setConfirmCancel(false)}
                    className="mt-3 w-full rounded-lg border border-[#444] p-4 font-black text-[#ccc]"
                  >
                    NÃO, MANTER HORÁRIO
                  </button>
                </section>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
