import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Menu,
  X,
  Search,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Settings,
  LifeBuoy,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { emailApi } from '../api/client';
import { useInboxUnread } from '../hooks/useEmailHistory';
import { useAuth } from '../context/AuthContext';
import CommandPalette from './CommandPalette';
import ViewAsSwitcher from './ViewAsSwitcher';
import OrgSwitcher from './OrgSwitcher';
import ImpersonationBanner from './ImpersonationBanner';
import Logo, { LogoMark } from './Logo';
import { DoAideFooter } from './DoAideBrand';
import ThemeToggle from './ThemeToggle';
import FeedbackWidget, { pageNameFromPath } from './FeedbackWidget';
import {
  heroNav,
  primaryNav,
  settingsNav,
  platformNav,
  isActivePath as matchPath,
  activeTab,
  isGroupActive,
} from '../lib/navigation';

// The nav config (hero item, areas and their tabs, the Settings directory)
// lives in lib/navigation so the Settings page can list the same pages.
const allGroups = [heroNav, ...primaryNav, settingsNav, platformNav];

export default function Layout({ children }) {
  const location = useLocation();
  const { user, isPlatformAdmin, logout } = useAuth();
  // Platform admins get an extra top-level item for cross-org management.
  const navItems = useMemo(
    () => (isPlatformAdmin ? [...primaryNav, platformNav] : primaryNav),
    [isPlatformAdmin]
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const isActivePath = (href, end = false) => matchPath(location.pathname, href, end);

  // The area that owns the current route, and the page within it. Drives the
  // lit sidebar item, the tab strip above the page and the breadcrumb.
  const currentGroup = allGroups.find((g) => isGroupActive(location.pathname, g)) || null;
  const currentTab = currentGroup ? activeTab(location.pathname, currentGroup) : null;

  // ⌘K / Ctrl+K opens the command palette from anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Check for recent replies (last 24 hours) to show notification dot
  const { data: recentSends } = useQuery({
    queryKey: ['layout-reply-check'],
    queryFn: async () => {
      try {
        const data = await emailApi.getSends({ limit: 50 });
        const items = data?.items || data;
        return Array.isArray(items) ? items : [];
      } catch {
        return [];
      }
    },
    staleTime: 60000, // check every 60 seconds
    refetchInterval: 60000,
    retry: false,
  });

  const hasNewReplies = useMemo(() => {
    if (!recentSends?.length) return false;
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return recentSends.some((s) => {
      if (s.status !== 'replied') return false;
      const d = new Date(s.replied_at || s.updated_at || s.sent_at);
      return !isNaN(d) && d > cutoff;
    });
  }, [recentSends]);

  // Numeric "needs reply" count for the Inbox nav item and the bell badge.
  const inboxUnread = useInboxUnread();

  const currentPage = currentTab || currentGroup;

  // Area → page breadcrumb. Detail routes (/companies/:id) add a final crumb
  // and link the list page above them.
  const breadcrumbs = useMemo(() => {
    if (!currentGroup) return [{ label: 'Dashboard', href: '/' }];
    const trail = [{ label: currentGroup.name, href: currentGroup.href }];
    if (currentTab && currentTab.href !== currentGroup.href) {
      trail.push({ label: currentTab.name, href: currentTab.href });
    }
    if (currentTab && location.pathname !== currentTab.href) {
      trail.push({ label: location.pathname.endsWith('/new') ? 'New' : 'Detail' });
    }
    return trail;
  }, [currentGroup, currentTab, location.pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const NavLink = ({ item, active, showBadge, count = 0, onClick }) => {
    const isActive = active ?? isActivePath(item.href, item.end);
    return (
      <Link
        to={item.href}
        onClick={onClick}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-indigo-50 font-medium text-indigo-600'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        )}
      >
        {isActive && (
          <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-indigo-600" />
        )}
        <item.icon
          className={cn(
            'h-[18px] w-[18px] flex-shrink-0 transition-colors',
            isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'
          )}
        />
        {item.name}
        {count > 0 ? (
          <span
            className="ml-auto inline-flex min-w-[1.25rem] flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
            aria-label={`${count} conversations need a reply`}
          >
            {count > 99 ? '99+' : count}
          </span>
        ) : showBadge ? (
          <span className="ml-auto h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />
        ) : null}
      </Link>
    );
  };

  const SidebarContent = (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-5 py-4">
        <Link to="/" className="flex items-center" aria-label="DoAide Prospect home">
          <Logo markSize={30} />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="-mr-1 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* min-h-0 lets this actually shrink and scroll: a flex child defaults to
          min-height:auto, which pins it to its content height. */}
      <nav aria-label="Main" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <NavLink item={heroNav} active={currentGroup === heroNav} />

        {navItems.map((item) => (
          <NavLink
            key={item.key}
            item={item}
            active={currentGroup === item}
            showBadge={item.key === 'inbox' && hasNewReplies}
            count={item.key === 'inbox' ? inboxUnread : 0}
          />
        ))}

        <div className="my-2 border-t border-gray-100" />
        <NavLink item={settingsNav} active={currentGroup === settingsNav} />
      </nav>

      {/* flex-shrink-0 keeps the footer at its natural height instead of being
          compressed into the nav's scroll area. Account actions are plain,
          always-visible icons rather than a menu hidden behind the user's
          name — nobody guessed the name was clickable. */}
      <div className="flex-shrink-0 border-t border-gray-200 px-3 py-2">
        <div className="flex items-center gap-2.5 px-3 py-2">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold uppercase text-indigo-700">
            {(user?.name || user?.email || '?').trim().charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-gray-900">
              {user?.name || 'Account'}
            </div>
            {user?.role && (
              <div className="truncate text-[11px] capitalize text-gray-400">{user.role}</div>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center">
            <Link
              to="/settings"
              title="Settings"
              aria-label="Settings"
              className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <Link
              to="/help"
              title="Help Center"
              aria-label="Help Center"
              className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <LifeBuoy className="h-4 w-4" />
            </Link>
            {user && (
              <button
                type="button"
                onClick={logout}
                title="Sign out"
                aria-label="Sign out"
                className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-3 pb-0.5 pt-1">
          <div className="min-w-0 truncate text-[11px] font-medium text-gray-400">DoAide Prospect v1.0</div>
          <ThemeToggle />
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-canvas">
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/90 px-4 text-gray-900 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="-ml-1 rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <LogoMark size={24} />
          <span className="truncate font-semibold tracking-tight">
            {currentPage ? currentPage.name : 'DoAide Prospect'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="-mr-1 ml-auto rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-gray-200 bg-white text-gray-700 transition-transform duration-200 ease-in-out lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {SidebarContent}
      </aside>

      {/* Main content */}
      <main className="pt-14 lg:pt-0 lg:pl-60">
        {/* Platform-admin impersonation banner (only while "viewing as" an org). */}
        <ImpersonationBanner />
        {/* Desktop top utility bar */}
        <header className="sticky top-0 z-20 hidden h-14 items-center gap-4 border-b border-gray-200 bg-white/80 px-8 backdrop-blur lg:flex">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            <Link to="/" className="flex-shrink-0 text-gray-400 transition-colors hover:text-gray-700">
              Prospect
            </Link>
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <React.Fragment key={`${crumb.label}-${i}`}>
                  <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
                  {crumb.href && !isLast ? (
                    <Link
                      to={crumb.href}
                      className="truncate text-gray-500 transition-colors hover:text-gray-900"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      className={cn(
                        'truncate',
                        isLast ? 'font-medium text-gray-900' : 'text-gray-400'
                      )}
                    >
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <OrgSwitcher />
            <ViewAsSwitcher />
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-3 pr-2 text-sm text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-100"
            >
              <Search className="h-4 w-4" />
              <span>Search…</span>
              <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-gray-400">⌘K</kbd>
            </button>
          </div>
        </header>

        {/* Sibling pages of the current area — the rows that used to fill the
            sidebar. Settings pages are unrelated to each other, so they get a
            way back to the directory instead of a strip. */}
        {currentGroup && currentGroup !== settingsNav && currentGroup.tabs.length > 1 && (
          <div className="border-b border-gray-200 bg-white">
            <nav
              aria-label={`${currentGroup.name} pages`}
              className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8"
            >
              {currentGroup.tabs.map((tab) => {
                const on = tab === currentTab;
                return (
                  <Link
                    key={tab.href}
                    to={tab.href}
                    aria-current={on ? 'page' : undefined}
                    className={cn(
                      '-mb-px inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                      on
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800'
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
        {currentGroup === settingsNav && currentTab && currentTab.href !== '/settings' && (
          <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <Link
              to="/settings"
              className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900"
            >
              <ChevronLeft className="h-4 w-4" />
              All settings
            </Link>
          </div>
        )}

        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          {children}
        </div>
        <DoAideFooter compact className="mx-auto max-w-7xl border-t border-gray-200 px-4 py-6 sm:px-6 lg:px-8" />
      </main>

      <FeedbackWidget pageName={currentPage ? currentPage.name : pageNameFromPath(location.pathname)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
