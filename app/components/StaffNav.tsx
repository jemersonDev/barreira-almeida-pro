type Tab = "inicio" | "agenda" | "novo" | "relatorio" | "config";

const tabs: { id: Tab; href: string; icon: string; label: string }[] = [
  { id: "inicio", href: "/operacao", icon: "🏠", label: "Início" },
  { id: "agenda", href: "/agendamentos", icon: "📅", label: "Agenda" },
  { id: "novo", href: "/novo-agendamento", icon: "+", label: "Novo" },
  { id: "relatorio", href: "/relatorios", icon: "📊", label: "Relatório" },
  { id: "config", href: "/configuracoes", icon: "⚙️", label: "Config" },
];

export default function StaffNav({ active }: { active?: Tab }) {
  return (
    <nav
      aria-label="Navegação da equipe"
      className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-[#d6ae42] bg-[#0b0c0b]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur print:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 items-end px-2">
        {tabs.map((t) => {
          const isActive = t.id === active;
          if (t.id === "novo")
            return (
              <li key={t.id} className="flex justify-center">
                <a
                  href={t.href}
                  aria-label="Novo agendamento"
                  className="-mt-6 flex flex-col items-center gap-1 pb-2 text-[10px] font-black tracking-wider text-[#d6ae42]"
                >
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-[#d6ae42] text-3xl font-black text-black shadow-[0_0_18px_rgba(214,174,66,.45)]">
                    +
                  </span>
                  NOVO
                </a>
              </li>
            );
          return (
            <li key={t.id}>
              <a
                href={t.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-3 text-[10px] font-black tracking-wider ${isActive ? "border-t-2 border-[#d6ae42] text-[#d6ae42]" : "border-t-2 border-transparent text-[#8d918d]"}`}
              >
                <span className="text-xl leading-none">{t.icon}</span>
                {t.label.toUpperCase()}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
