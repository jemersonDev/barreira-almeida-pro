"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { requestPushToken } from "../../lib/firebase-client";
import StaffNav from "../components/StaffNav";
type Role = "owner" | "barber";
type Status = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
type Item = {
  id: string;
  startsAt: string;
  status: Status;
  paymentMethod?: "pix" | "cash" | "card" | null;
  priceCents: number;
  ownerAmountCents: number;
  barberAmountCents: number;
  barberId: string;
  barberName: string;
  serviceName: string;
  customerName: string;
  customerPhone: string;
};
type Profile = { id: string; name: string; role: Role; photoUrl?: string | null };
type Notice = {
  id: string;
  createdAt: string;
  startsAt: string;
  status: Status;
  barberName: string;
  serviceName: string;
  customerName: string;
  customerPhone: string;
};
const labels: Record<Status, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};
const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
const payment = (v: Item["paymentMethod"]) =>
  v === "pix"
    ? "Pix"
    : v === "cash"
      ? "Dinheiro"
      : v === "card"
        ? "Cartão"
        : "não informado";
function reminder(i: Item) {
  const digits = i.customerPhone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  const when = new Date(i.startsAt).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const text = `Olá, ${i.customerName}! Passando para lembrar do seu horário na Barbearia Almeida: ${i.serviceName} com ${i.barberName}, hoje às ${new Date(i.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} (${when}). Estamos te esperando!`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export default function Operation() {
  const today = useMemo(
    () =>
      new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
    [],
  );
  const knownNoticeIds = useRef(new Set<string>());
  const [date, setDate] = useState(today),
    [profile, setProfile] = useState<Profile | null>(null),
    [items, setItems] = useState<Item[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [working, setWorking] = useState(""),
    [completing, setCompleting] = useState<Item | null>(null),
    [cancelling, setCancelling] = useState<Item | null>(null),
    [notices, setNotices] = useState<Notice[]>([]),
    [noticeOpen, setNoticeOpen] = useState(false),
    [seenAt, setSeenAt] = useState(0),
    [pushStatus, setPushStatus] = useState(""),
    [notificationPermission, setNotificationPermission] = useState<
      NotificationPermission | "unsupported"
    >("unsupported");
  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/staff/appointments?date=${date}`, {
        cache: "no-store",
      });
      const j = await r.json();
      if (!r.ok)
        throw new Error(j.error || "Não foi possível carregar a agenda.");
      setProfile(j.profile);
      setItems(j.appointments || []);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível carregar a agenda.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [date]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setSeenAt(
      Number(localStorage.getItem("barbearia-notifications-seen") || 0),
    );
    setNotificationPermission(
      "Notification" in window ? Notification.permission : "unsupported",
    );
    let first = true;
    const loadNotices = async () => {
      try {
        const r = await fetch("/api/staff/notifications", {
            cache: "no-store",
          }),
          j = await r.json();
        if (!r.ok) return;
        const next: Notice[] = j.notifications || [];
        if (
          !first &&
          "Notification" in window &&
          Notification.permission === "granted"
        )
          next
            .filter((n) => !knownNoticeIds.current.has(n.id))
            .slice(0, 3)
            .forEach(
              (n) =>
                new Notification("Novo agendamento", {
                  body: `${n.customerName} · ${new Date(n.startsAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · ${n.barberName}`,
                }),
            );
        knownNoticeIds.current = new Set(next.map((n) => n.id));
        setNotices(next);
        first = false;
      } catch {}
    };
    loadNotices();
    const timer = setInterval(loadNotices, 60000);
    return () => clearInterval(timer);
  }, []);
  const unread = notices.filter(
    (n) => new Date(n.createdAt).getTime() > seenAt,
  ).length;
  const openNotices = () => {
    const now = Date.now();
    setSeenAt(now);
    localStorage.setItem("barbearia-notifications-seen", String(now));
    setNoticeOpen((v) => !v);
  };
  const enableNotifications = async () => {
    setError("");
    try {
      const token = await requestPushToken();
      const response = await fetch("/api/push/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível ativar.");
      setNotificationPermission("granted");
      setSuccess("Notificações ativadas neste aparelho.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível ativar as notificações.");
    }
  };
  const testNotifications = async () => {
    setPushStatus("Testando...");
    try {
      const token = await requestPushToken();
      const saved = await fetch("/api/push/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!saved.ok) throw new Error((await saved.json()).error || "Não foi possível registrar este aparelho.");
      setNotificationPermission("granted");
      const response = await fetch("/api/push/test", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao enviar o teste.");
      if (!result.configured) throw new Error("O servidor não tem as chaves do Firebase configuradas (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).");
      if (result.failed?.length) throw new Error(`O Firebase recusou o envio (código ${result.failed[0].status}): ${result.failed[0].detail}`);
      setPushStatus(`Teste enviado para ${result.delivered} aparelho(s). Se a notificação não aparecer, confira as configurações de notificação do navegador e do celular.`);
    } catch (e) {
      setPushStatus(e instanceof Error ? e.message : "Não foi possível testar as notificações.");
    }
  };
  async function change(
    id: string,
    status: Status,
    paymentMethod?: "pix" | "cash" | "card",
  ) {
    setWorking(id);
    setError("");
    setSuccess("");
    try {
      const r = await fetch("/api/staff/appointments", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status, paymentMethod }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não foi possível atualizar.");
      setItems((v) => status === "cancelled" ? v.filter((i) => i.id !== id) :
        v.map((i) =>
          i.id === id
            ? {
                ...i,
                status: j.status,
                paymentMethod: paymentMethod || i.paymentMethod,
              }
            : i,
        ),
      );
      setCompleting(null);
      setCancelling(null);
      if (status === "cancelled")
        setSuccess(
          "Agendamento cancelado com sucesso. O horário já está disponível novamente.",
        );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar.");
      return false;
    } finally {
      setWorking("");
    }
  }
  async function confirmAppointment(i: Item) {
    const confirmed = await change(i.id, "confirmed");
    if (!confirmed) return;
    setSuccess("Horário confirmado. O cliente receberá a notificação se tiver ativado os avisos.");
  }
  const completed = items.filter((i) => i.status === "completed");
  const activeCount = items.filter((i) => ["pending", "confirmed"].includes(i.status)).length;
  const organizedItems = useMemo(() => [...items].sort((a, b) => {
    const barberOrder = (id: string) => id === "lucas" ? 0 : 1;
    const statusOrder = (status: Status) => ["pending", "confirmed"].includes(status) ? 0 : status === "completed" ? 1 : 2;
    return barberOrder(a.barberId) - barberOrder(b.barberId) || statusOrder(a.status) - statusOrder(b.status) || new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  }), [items]);
  const totals = useMemo(
    () => ({
      mine:
        profile?.role === "barber"
          ? completed.reduce((s, i) => s + i.barberAmountCents, 0)
          : completed.reduce((s, i) => s + i.barberAmountCents, 0),
      repasse:
        profile?.role === "barber"
          ? completed.reduce((s, i) => s + i.ownerAmountCents, 0)
          : completed
              .filter((i) => i.barberId === "sinvas")
              .reduce((s, i) => s + i.barberAmountCents, 0),
    }),
    [completed, profile],
  );
  if (error && !profile && !loading)
    return (
      <main className="min-h-screen bg-[#080909] p-5 text-[#f4f1e8] grid place-items-center">
        <section className="w-full max-w-md rounded-2xl border border-[#3f3825] bg-[#151716] p-8 text-center">
          <div className="text-4xl">🔒</div>
          <h1 className="mt-4 text-2xl font-black">Área protegida</h1>
          <p className="mt-3 text-sm text-[#8d918d]">{error}</p>
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
    <main className="min-h-screen bg-[#080909] p-4 pb-32 text-[#f4f1e8] sm:p-8 sm:pb-32">
      <div className="mx-auto max-w-5xl">
        <header className="relative mb-7 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {profile?.photoUrl ? <img src={profile.photoUrl} alt={`Foto de ${profile.name}`} className="h-12 w-12 rounded-full border-2 border-[#d6ae42] object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-full border border-[#d6ae42] font-black text-[#d6ae42]">{profile?.name?.slice(0,2).toUpperCase() || "BA"}</span>}
            <div>
            <a href="/" className="text-xl font-black tracking-[.16em]">
              <span className="text-[#d6ae42]">B.</span> ALMEIDA
            </a>
            <p className="mt-2 text-xs text-[#777]">
              Operação diária · {profile?.name || "carregando"}
            </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openNotices}
              aria-label={`${unread} notificações novas`}
              className="relative rounded-lg border border-[#5e502a] p-3 text-lg"
            >
              🔔
              {unread > 0 && (
                <span className="absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">
                  {unread}
                </span>
              )}
            </button>
            <input
              aria-label="Data da agenda"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-[#2a2d2a] bg-[#151716] p-3 text-sm text-white"
            />
            <a
              href="/signout-with-chatgpt?return_to=/"
              className="rounded-lg border border-[#5e502a] p-3 text-xs font-black text-[#d6ae42]"
            >
              SAIR
            </a>
          </div>
          {noticeOpen && (
            <section className="absolute right-0 top-16 z-40 w-full max-w-md rounded-xl border border-[#5e502a] bg-[#111311] p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-black">Notificações</h2>
                <button
                  onClick={() => setNoticeOpen(false)}
                  className="text-[#888]"
                >
                  FECHAR
                </button>
              </div>
              {notificationPermission !== "granted" &&
                notificationPermission !== "unsupported" && (
                  <button
                    onClick={enableNotifications}
                    className="mb-3 w-full rounded-lg bg-[#d6ae42] p-3 text-xs font-black text-black"
                  >
                    ATIVAR NOTIFICAÇÕES NESTE APARELHO
                  </button>
                )}
              {notificationPermission !== "unsupported" ? (
                <button
                  onClick={testNotifications}
                  className="mb-3 w-full rounded-lg border border-[#d6ae42] p-3 text-xs font-black text-[#d6ae42]"
                >
                  REGISTRAR E TESTAR NOTIFICAÇÃO
                </button>
              ) : (
                <p className="mb-3 text-xs text-[#d6ae42]">
                  Este navegador não aceita notificações. No iPhone, instale o app na tela inicial (Compartilhar, depois Adicionar à Tela de Início) e abra por lá.
                </p>
              )}
              {pushStatus && <p className="mb-3 text-xs text-[#ddd]">{pushStatus}</p>}
              <p className="mb-3 text-[10px] text-[#777]">
                Depois de ativadas, as notificações poderão aparecer mesmo com o painel fechado.
              </p>
              <div className="max-h-96 overflow-auto">
                {notices.length === 0 ? (
                  <p className="p-5 text-center text-sm text-[#777]">
                    Nenhum agendamento novo.
                  </p>
                ) : (
                  notices.map((n) => (
                    <article
                      key={n.id}
                      className="border-t border-[#292b29] py-3"
                    >
                      <b className="block text-sm">
                        {n.customerName} agendou {n.serviceName}
                      </b>
                      <span className="mt-1 block text-xs text-[#d6ae42]">
                        {new Date(n.startsAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {n.barberName}
                      </span>
                      <small className="mt-1 block text-[#666]">
                        Agendado em{" "}
                        {new Date(n.createdAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </article>
                  ))
                )}
              </div>
            </section>
          )}
        </header>
        <div className="mb-6">
          <p className="text-[10px] font-bold tracking-[.2em] text-[#d6ae42]">
            AGENDA REAL
          </p>
          <h1 className="mt-1 text-3xl font-black">Atendimentos do dia</h1>
          <p className="mt-2 text-sm text-[#777]">
            {profile?.role === "barber"
              ? "Você vê e altera somente seus atendimentos."
              : "Controle completo da agenda da equipe."}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a
              href="/novo-agendamento"
              className="rounded-lg bg-[#d6ae42] p-4 text-center text-xs font-black tracking-wider text-black"
            >
              AGENDAR
            </a>
            <a
              href="/clientes"
              className="rounded-lg border border-[#d6ae42] p-4 text-center text-xs font-black tracking-wider text-[#d6ae42]"
            >
              CLIENTES
            </a>
            <a
              href="/horarios"
              className="col-span-2 rounded-lg border border-[#6d5b2c] p-3 text-center text-[11px] font-black text-[#d6ae42]"
            >
              ALMOÇO, PAUSA OU FOLGA
            </a>
          </div>
        </div>
        {error && (
          <p className="mb-4 rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-300">
            {error}
          </p>
        )}
        {success && (
          <p
            role="status"
            className="mb-4 rounded-lg border border-green-900 bg-green-950/30 p-4 text-sm font-bold text-green-300"
          >
            ✓ {success}
          </p>
        )}
        <div className={`mb-5 grid gap-2 ${profile?.role === "barber" ? "grid-cols-3" : "grid-cols-2"}`}>
          <Card
            label="Concluídos"
            value={String(completed.length)}
            note={`${activeCount} aguardando atendimento`}
          />
          <Card
            label={
              profile?.role === "barber"
                ? "Minha parte · 60%"
                : "Receita do Lucas"
            }
            value={money(totals.mine)}
            note={
              profile?.role === "barber"
                ? "Somente concluídos"
                : "Somente atendimentos próprios"
            }
          />
          {profile?.role === "barber" && <Card
            label={
              profile?.role === "barber" ? "Repasse · 40%" : "Parte do Sinvas"
            }
            value={money(totals.repasse)}
            note={
              profile?.role === "barber"
                ? "A repassar ao Lucas"
                : "60% dos concluídos dele"
            }
          />}
        </div>
        {loading ? (
          <p className="rounded-xl border border-[#2a2d2a] bg-[#151716] p-10 text-center text-[#777]">
            Carregando agenda...
          </p>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-[#2a2d2a] bg-[#151716] p-10 text-center text-[#777]">
            Nenhum atendimento nesta data.
          </p>
        ) : (
          <section className="grid gap-3">
            {organizedItems.map((i, index) => {
              const statusGroup = ["pending", "confirmed"].includes(i.status) ? "active" : i.status === "completed" ? "completed" : "closed";
              const previous = organizedItems[index - 1];
              const previousGroup = previous ? (["pending", "confirmed"].includes(previous.status) ? "active" : previous.status === "completed" ? "completed" : "closed") : "";
              const startsGroup = !previous || previous.barberId !== i.barberId || previousGroup !== statusGroup;
              const groupLabel = statusGroup === "active" ? "PRÓXIMOS ATENDIMENTOS" : statusGroup === "completed" ? "ATENDIMENTOS CONCLUÍDOS" : "AUSENTES E CANCELADOS";
              const minutes =
                (new Date(i.startsAt).getTime() - Date.now()) / 60000;
              const near =
                minutes >= 0 &&
                minutes <= 60 &&
                !["completed", "cancelled", "no_show"].includes(i.status);
              return <div key={i.id}>
                {startsGroup && <div className={`mb-3 mt-5 rounded-xl border p-4 ${statusGroup === "active" ? "border-[#6d5b2c] bg-[#211d13]" : statusGroup === "completed" ? "border-green-900 bg-green-950/20" : "border-[#3b3b3b] bg-[#111]"}`}>
                  <p className="text-[10px] font-black tracking-[.18em] text-[#d6ae42]">{profile?.role === "owner" ? `AGENDA DO ${i.barberName.toUpperCase()}` : "MINHA AGENDA"}</p>
                  <h2 className="mt-1 text-lg font-black">{groupLabel}</h2>
                </div>}
                <article
                  className={`rounded-xl border bg-[#151716] p-5 ${near ? "border-[#d6ae42]" : "border-[#2a2d2a]"}`}
                >
                  {near && (
                    <p className="mb-3 rounded-lg bg-[#d6ae42] p-2 text-center text-[10px] font-black text-black">
                      ⏰ ATENDIMENTO EM ATÉ 1 HORA
                    </p>
                  )}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex gap-4">
                      <b className="text-xl text-[#d6ae42]">
                        {new Date(i.startsAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </b>
                      <div>
                        <strong className="block">{i.customerName}</strong>
                        <small className="mt-1 block text-[#777]">
                          {i.serviceName} · {i.barberName} ·{" "}
                          {money(i.priceCents)}
                        </small>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {i.status === "pending" ? <button
                            onClick={() => confirmAppointment(i)}
                            disabled={working === i.id}
                            className="inline-block rounded border border-green-900 px-3 py-2 text-xs font-black text-green-400 disabled:opacity-40"
                          >
                            CONFIRMAR
                          </button> : null}
                          {!["completed", "cancelled", "no_show"].includes(
                            i.status,
                          ) && (
                            <a
                              target="_blank"
                              rel="noreferrer"
                              className={`inline-block rounded px-3 py-2 text-xs font-black ${near ? "bg-green-600 text-black" : "border border-[#5e502a] text-[#d6ae42]"}`}
                              href={reminder(i)}
                            >
                              ENVIAR LEMBRETE
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="rounded-full border border-[#5d502a] px-3 py-1 text-[9px] uppercase text-[#d6ae42]">
                      {labels[i.status]}
                    </span>
                  </div>
                  {!["completed", "cancelled", "no_show"].includes(
                    i.status,
                  ) && (
                    <div className="mt-5 grid grid-cols-3 gap-2">
                      <button
                        disabled={working === i.id}
                        onClick={() => setCompleting(i)}
                        className="rounded-lg bg-[#d6ae42] p-3 text-xs font-black text-black disabled:opacity-40"
                      >
                        CONCLUIR
                      </button>
                      <button
                        disabled={working === i.id}
                        onClick={() => change(i.id, "no_show")}
                        className="rounded-lg border border-[#5b5b5b] p-3 text-xs font-black text-[#aaa]"
                      >
                        AUSENTE
                      </button>
                      <button
                        disabled={working === i.id}
                        onClick={() => setCancelling(i)}
                        className="rounded-lg border border-red-900 p-3 text-xs font-black text-red-400"
                      >
                        CANCELAR
                      </button>
                    </div>
                  )}
                  {i.status === "completed" && (
                    <div className="mt-4 rounded-lg bg-[#102018] p-3 text-xs text-[#69c98a]">
                      Pagamento: {payment(i.paymentMethod)} · comissão calculada
                      automaticamente.
                    </div>
                  )}
                </article>
              </div>;
            })}
          </section>
        )}
        {completing && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-title"
            className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
          >
            <section className="w-full max-w-md rounded-2xl border border-[#5a4c27] bg-[#151716] p-6 shadow-2xl">
              <p className="text-xs font-bold tracking-wider text-[#d6ae42]">
                FECHAR ATENDIMENTO
              </p>
              <h2 id="payment-title" className="mt-2 text-2xl font-black">
                Como {completing.customerName} pagou?
              </h2>
              <p className="mt-2 text-sm text-[#888]">
                {completing.serviceName} · {money(completing.priceCents)}
              </p>
              <div className="mt-6 grid gap-3">
                <button
                  disabled={working === completing.id}
                  onClick={() => change(completing.id, "completed", "pix")}
                  className="rounded-lg bg-[#d6ae42] p-4 font-black text-black"
                >
                  PIX
                </button>
                <button
                  disabled={working === completing.id}
                  onClick={() => change(completing.id, "completed", "cash")}
                  className="rounded-lg border border-[#6d5b2c] p-4 font-black text-[#d6ae42]"
                >
                  DINHEIRO
                </button>
                <button
                  disabled={working === completing.id}
                  onClick={() => change(completing.id, "completed", "card")}
                  className="rounded-lg border border-[#6d5b2c] p-4 font-black text-[#d6ae42]"
                >
                  CARTÃO
                </button>
                <button
                  disabled={working === completing.id}
                  onClick={() => setCompleting(null)}
                  className="p-3 text-sm text-[#888]"
                >
                  VOLTAR SEM CONCLUIR
                </button>
              </div>
            </section>
          </div>
        )}
        {cancelling && (
          <div role="dialog" aria-modal="true" aria-labelledby="cancel-title" className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4">
            <section className="w-full max-w-md rounded-2xl border border-red-900 bg-[#151716] p-6 shadow-2xl">
              <p className="text-xs font-bold tracking-wider text-red-400">CANCELAR AGENDAMENTO</p>
              <h2 id="cancel-title" className="mt-2 text-2xl font-black">Cancelar o horário de {cancelling.customerName}?</h2>
              <p className="mt-3 text-sm text-[#aaa]">{cancelling.serviceName} com {cancelling.barberName}. O horário será liberado para outro cliente.</p>
              <div className="mt-6 grid gap-3">
                <button disabled={working === cancelling.id} onClick={() => change(cancelling.id, "cancelled")} className="rounded-lg bg-red-700 p-4 font-black text-white disabled:opacity-40">
                  {working === cancelling.id ? "CANCELANDO..." : "SIM, CANCELAR AGENDAMENTO"}
                </button>
                <button disabled={working === cancelling.id} onClick={() => setCancelling(null)} className="rounded-lg border border-[#444] p-4 font-black text-[#ccc]">NÃO, MANTER HORÁRIO</button>
              </div>
            </section>
          </div>
        )}
      </div>
      <StaffNav active="inicio" />
    </main>
  );
}
function Card({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="rounded-xl border border-[#2a2d2a] bg-[#151716] p-3 text-center">
      <small className="block text-[9px] font-bold tracking-wider text-[#888]">
        {label.toUpperCase()}
      </small>
      <b className="my-1.5 block text-xl text-[#d6ae42]">{value}</b>
      <span className="block text-[10px] leading-tight text-[#777]">{note}</span>
    </article>
  );
}
