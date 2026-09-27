import { asset, Head } from "$fresh/runtime.ts";
import { ComponentChildren } from "preact";
import AllNotification from "@/islands/AllNotification.tsx";
import IconChartBar from "https://deno.land/x/tabler_icons_tsx@0.0.3/tsx/chart-bar.tsx";
import IconChartLine from "https://deno.land/x/tabler_icons_tsx@0.0.3/tsx/chart-line.tsx";
import IconClock from "https://deno.land/x/tabler_icons_tsx@0.0.3/tsx/clock.tsx";
import IconLogout from "https://deno.land/x/tabler_icons_tsx@0.0.3/tsx/logout.tsx";
import IconMessageCircle from "https://deno.land/x/tabler_icons_tsx@0.0.3/tsx/message-circle.tsx";
import IconPlayerPlay from "https://deno.land/x/tabler_icons_tsx@0.0.3/tsx/player-play.tsx";
import IconRefresh from "https://deno.land/x/tabler_icons_tsx@0.0.3/tsx/refresh.tsx";
import IconSettings from "https://deno.land/x/tabler_icons_tsx@0.0.3/tsx/settings.tsx";
import IconSwords from "https://deno.land/x/tabler_icons_tsx@0.0.3/tsx/swords.tsx";
import IconUser from "https://deno.land/x/tabler_icons_tsx@0.0.3/tsx/user.tsx";

export function ReidleHead(
  { title, fullPage }: { title: string; fullPage?: boolean },
) {
  return (
    <Head>
      <title>{title ? `${title} · Reidle` : "Reidle"}</title>
      {fullPage
        ? (
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
          />
        )
        : null}
    </Head>
  );
}

interface TemplateProps {
  children: ComponentChildren;
  title: string;
  route: string;
  fullPage?: boolean;
  playedToday: boolean;
}

export default function ReidleTemplate({
  children,
  title,
  route,
  fullPage = false,
  playedToday,
}: TemplateProps) {
  const isStatsActive = route.startsWith("/stats");
  const isBattlesActive = route.startsWith("/battles");
  const isChallengesActive = route.startsWith("/challenges");
  const isMessagesActive = route.startsWith("/messages");
  const isRankingsActive = route.startsWith("/rankings");
  const isAccountActive = route.startsWith("/account");

  return (
    <div class="min-h-screen w-full flex flex-col md:flex-row bg-white text-gray-900 font-sans">
      <ReidleHead title={title} fullPage={fullPage} />

      {/* Desktop Navigation Sidebar */}
      <aside class={[
        fullPage ? "hidden" : "hidden md:flex",
        "flex-col w-60 lg:w-64 border-r border-gray-200/80 bg-white fixed top-0 bottom-0 left-0 z-40 select-none",
      ].join(" ")}>
        {/* Brand Header */}
        <div class="px-5 py-5 border-b border-gray-100 flex items-center justify-between">
          <a href="/" class="flex items-center gap-3 group">
            <img
              src={asset("/android-chrome-96x96.webp")}
              alt="Reidle"
              class="w-9 h-9 rounded-xl shadow-sm transition-transform group-hover:scale-105"
            />
            <div>
              <span class="text-xl font-black tracking-tight text-gray-900 leading-none block">
                REIDLE
              </span>
            </div>
          </a>
        </div>

        {/* Daily Status Banner */}
        <div class="px-4 py-3">
          {playedToday ? (
            <div class="flex items-center justify-between px-3 py-2 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-800 text-xs font-semibold">
              <span class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Played Today
              </span>
              <a
                href="/stats/today"
                class="text-emerald-700 hover:text-emerald-900 hover:underline text-[11px] font-bold"
              >
                Rankings →
              </a>
            </div>
          ) : (
            <a
              href="/play"
              class="flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all hover:shadow active:scale-98"
            >
              <IconPlayerPlay size={17} class="h-4 w-4" />
              <span>Play Today's Reidle</span>
            </a>
          )}
        </div>

        {/* Navigation Links */}
        <nav class="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {!playedToday && (
            <NavItem
              href="/play"
              active={route === "/play"}
              label="Play Daily"
              icon={<IconPlayerPlay size={20} color="#10b981" class="w-5 h-5" />}
              badge="Daily"
              badgeColor="bg-emerald-100 text-emerald-800"
            />
          )}

          <NavItem
            href="/stats/today"
            active={isStatsActive}
            label="Leaderboard"
            icon={<IconChartBar size={20} color="#2563eb" class="w-5 h-5" />}
          />

          <NavItem
            href="/battles"
            active={isBattlesActive}
            label="Battles"
            icon={<IconSwords size={20} color="#e11d48" class="w-5 h-5" />}
            badge="Live"
            badgeColor="bg-purple-100 text-purple-800"
          />

          <NavItem
            href="/challenges"
            active={isChallengesActive}
            label="Challenges"
            icon={<IconClock size={20} color="#d97706" class="w-5 h-5" />}
          />

          <NavItem
            href="/practice"
            active={route === "/practice"}
            label="Practice"
            icon={<IconRefresh size={20} color="#0284c7" class="w-5 h-5" />}
          />

          <NavItem
            href="/rankings"
            active={isRankingsActive}
            label="Rankings"
            icon={<IconChartLine size={20} color="#4f46e5" class="w-5 h-5" />}
          />

          <NavItem
            href="/messages"
            active={isMessagesActive}
            label="Messages"
            icon={<IconMessageCircle size={20} color="#0891b2" class="w-5 h-5" />}
            extra={<AllNotification />}
          />

          <NavItem
            href="/account"
            active={isAccountActive}
            label="Account"
            icon={<IconUser size={20} color="#64748b" class="w-5 h-5" />}
          />
        </nav>

        {/* Sidebar Footer */}
        <div class="p-3 border-t border-gray-100 flex items-center justify-between">
          <a
            href="/account"
            class="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1.5"
          >
            <span class="inline-flex items-center gap-1.5">
              <IconSettings size={16} class="h-4 w-4" />
              Settings
            </span>
          </a>
          <a
            href="/sign-out"
            class="text-xs font-semibold text-gray-400 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50"
            title="Log Out"
          >
            <span class="inline-flex items-center gap-1.5">
              <IconLogout size={15} class="h-4 w-4" />
              Log Out
            </span>
          </a>
        </div>
      </aside>

      {/* Mobile Top App Bar */}
      <header
        class={[
          fullPage ? "hidden" : "md:hidden fixed top-0 left-0 right-0 z-40",
          "bg-white border-b border-gray-200/80 px-4 h-14 flex items-center justify-between select-none",
        ].join(" ")}
        style={{ backgroundColor: "#ffffff", opacity: 1 }}
      >
        <a href="/" class="flex items-center gap-2.5">
          <img
            src={asset("/android-chrome-96x96.webp")}
            alt="Reidle"
            class="w-7 h-7 rounded-lg shadow-xs"
          />
          <span class="text-lg font-black tracking-tight text-gray-900 leading-none">
            REIDLE
          </span>
        </a>

        <div class="flex items-center gap-2">
          {!playedToday && (
            <a
              href="/play"
              class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
              style={{ backgroundColor: "#059669", color: "#ffffff" }}
            >
              <IconPlayerPlay size={15} color="#ffffff" class="h-4 w-4" />
              <span>Play</span>
            </a>
          )}

          <a
            href="/account"
            class="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
            title="Account"
          >
            <IconUser size={20} class="w-5 h-5" />
          </a>
        </div>
      </header>

      {/* Main Content Area */}
      <main
        class={[
          "flex-1 flex flex-col min-w-0",
          fullPage
            ? "fixed inset-0 h-[100dvh] min-h-0 overflow-hidden"
            : "md:pl-64 lg:pl-72 pt-16 pb-24 md:pt-6 md:pb-12 px-4 sm:px-6 max-w-5xl mx-auto w-full",
        ].join(" ")}
        style={fullPage
          ? {
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }
          : undefined}
      >
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar (Thumb Friendly) */}
      <nav
        class={[
          fullPage ? "hidden" : "md:hidden fixed bottom-0 left-0 right-0 z-40",
          "min-h-16 bg-white border-t border-gray-200/80 px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] flex items-stretch justify-around select-none shadow-lg",
        ].join(" ")}
        style={{ backgroundColor: "#ffffff", opacity: 1 }}
      >
        <MobileNavItem
          href="/play"
          active={route === "/play"}
          disabled={playedToday}
          label="Play"
          icon={
            <IconPlayerPlay size={20} color="#10b981" class="w-5 h-5" />
          }
        />

        <MobileNavItem
          href="/practice"
          active={route === "/practice"}
          label="Practice"
          icon={<IconRefresh size={20} color="#0284c7" class="w-5 h-5" />}
        />

        <MobileNavItem
          href="/stats/today"
          active={isStatsActive}
          label="Stats"
          icon={
            <IconChartBar size={20} color="#2563eb" class="w-5 h-5" />
          }
        />

        <MobileNavItem
          href="/battles"
          active={isBattlesActive}
          label="Battles"
          icon={
            <IconSwords size={20} color="#e11d48" class="w-5 h-5" />
          }
        />

        <MobileNavItem
          href="/challenges"
          active={isChallengesActive}
          label="Challenge"
          icon={
            <IconClock size={20} color="#d97706" class="w-5 h-5" />
          }
        />

        <MobileNavItem
          href="/messages"
          active={isMessagesActive}
          label="Messages"
          icon={
            <div class="relative">
              <IconMessageCircle size={20} color="#0891b2" class="w-5 h-5" />
              <div class="absolute -top-1 -right-2">
                <AllNotification />
              </div>
            </div>
          }
        />
      </nav>
    </div>
  );
}

function NavItem({
  href,
  active,
  label,
  icon,
  badge,
  badgeColor,
  extra,
}: {
  href: string;
  active: boolean;
  label: string;
  icon: ComponentChildren;
  badge?: string;
  badgeColor?: string;
  extra?: ComponentChildren;
}) {
  return (
    <a
      href={href}
      class={[
        "flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all group",
        active
          ? "bg-gray-900 text-white shadow-xs font-semibold"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/80",
      ].join(" ")}
    >
      <div class="flex items-center gap-3">
        <span class={active ? "text-white" : "text-gray-400 group-hover:text-gray-700 transition-colors"}>
          {icon}
        </span>
        <span>{label}</span>
      </div>
      <div class="flex items-center gap-1.5">
        {badge && (
          <span
            class={[
              "text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md",
              active ? "bg-white/20 text-white" : badgeColor ?? "bg-gray-100 text-gray-600",
            ].join(" ")}
          >
            {badge}
          </span>
        )}
        {extra}
      </div>
    </a>
  );
}

function MobileNavItem({
  href,
  active,
  disabled = false,
  label,
  icon,
}: {
  href: string;
  active: boolean;
  disabled?: boolean;
  label: string;
  icon: ComponentChildren;
}) {
  const content = (
    <>
      <span class="flex h-5 items-center justify-center">{icon}</span>
      <span class="text-[11px] leading-none whitespace-nowrap">{label}</span>
    </>
  );

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        class="flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg text-xs text-gray-300 cursor-not-allowed"
      >
        {content}
      </span>
    );
  }

  return (
    <a
      href={href}
      class={[
        "flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg text-xs transition-colors",
        active
          ? "text-emerald-700 font-bold"
          : "text-gray-500 hover:text-gray-900 font-medium",
      ].join(" ")}
    >
      {content}
    </a>
  );
}
