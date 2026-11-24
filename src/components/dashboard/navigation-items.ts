import {
  CalendarDays,
  LayoutDashboard,
  Scissors,
  Settings,
  UserRound,
  UsersRound,
  Wallet,
} from "lucide-react";

export const navigation = {
  dashboard: { href: "/painel", label: "Painel", icon: LayoutDashboard },
  schedule: { href: "/agenda", label: "Agenda", icon: CalendarDays },
  customers: { href: "/clientes", label: "Clientes", icon: UserRound },
  services: { href: "/servicos", label: "Serviços", icon: Scissors },
  team: { href: "/equipe", label: "Equipe", icon: UsersRound },
  finances: { href: "/financeiro", label: "Financeiro", icon: Wallet },
  settings: { href: "/configuracoes", label: "Configurações", icon: Settings },
} as const;
