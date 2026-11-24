"use client";

import { Ellipsis, Scissors, Store } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { navigation } from "./navigation-items";

type NavigationItem = (typeof navigation)[keyof typeof navigation];

const mainItems = [navigation.dashboard, navigation.schedule, navigation.customers];
const desktopItems = [...mainItems, navigation.services, navigation.finances];
const mobileItems = [...mainItems, navigation.finances];
const moreItems = [navigation.services, navigation.settings];

function isCurrent(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function NavigationLink({
  item: { href, label, icon: Icon },
  pathname,
  onClick,
}: {
  item: NavigationItem;
  pathname: string;
  onClick?: () => void;
}) {
  return (
    <Link href={href} className="nav-link" aria-current={isCurrent(pathname, href) ? "page" : undefined} onClick={onClick}>
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

export function DashboardNavigation({ organizationName, roleLabel, canManage }: {
  organizationName: string;
  roleLabel: string;
  canManage: boolean;
}) {
  const pathname = usePathname();
  const moreMenu = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const home = canManage ? navigation.dashboard.href : navigation.schedule.href;
  const scheduleOnly = [navigation.schedule];

  return (
    <>
      <aside className="sidebar">
        <Link href={home} className="brand" aria-label="BarberFlow, área de trabalho">
          <span className="brand-mark"><Scissors size={21} aria-hidden="true" /></span>
          <span>Barber<span className="brand-accent">Flow</span></span>
        </Link>

        <div className="workspace">
          <span className="icon-tile"><Store size={17} aria-hidden="true" /></span>
          <div>
            <span className="workspace-name">{organizationName}</span>
            <span className="workspace-label">{roleLabel}</span>
          </div>
        </div>

        <nav className="desktop-navigation" aria-label="Navegação principal">
          <span className="nav-heading">Área de trabalho</span>
          {(canManage ? desktopItems : scheduleOnly).map((item) => <NavigationLink key={item.href} item={item} pathname={pathname} />)}
          {canManage && (
            <div className="sidebar-footer">
              <NavigationLink item={navigation.settings} pathname={pathname} />
            </div>
          )}
        </nav>
      </aside>

      <nav className="mobile-navigation" data-schedule-only={!canManage || undefined} aria-label="Navegação principal">
        {(canManage ? mobileItems : scheduleOnly).map((item) => <NavigationLink key={item.href} item={item} pathname={pathname} />)}
        {canManage && (
          <>
            <button
              type="button"
              className="nav-link"
              data-active={moreItems.some((item) => isCurrent(pathname, item.href)) ? "true" : undefined}
              popoverTarget="dashboard-more"
              aria-controls="dashboard-more"
              aria-expanded={moreOpen}
            >
              <Ellipsis size={19} aria-hidden="true" />
              <span>Mais</span>
            </button>
            <div
              id="dashboard-more"
              popover="auto"
              className="mobile-popover"
              ref={moreMenu}
              onToggle={(event) => setMoreOpen(event.currentTarget.matches(":popover-open"))}
            >
              {moreItems.map((item) => (
                <NavigationLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onClick={() => moreMenu.current?.hidePopover()}
                />
              ))}
            </div>
          </>
        )}
      </nav>
    </>
  );
}
