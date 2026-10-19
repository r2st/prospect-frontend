import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  BarChart3,
  Building2,
  GitBranch,
  Upload,
  Send,
  Bell,
  Settings,
  Menu,
  X,
  Sparkles,
  ListOrdered,
  FileText,
  Folder,
  Newspaper,
  Rocket,
  CreditCard,
  Users,
  Search,
  HeartPulse,
  CheckSquare,
  PieChart,
  Inbox,
  BookOpen,
  Phone,
  Landmark,
  ChevronRight,
  Brain,
  LogOut,
  UserCog,
  Activity,
  Radio,
  Radar,
  Stethoscope,
  Gauge,
  MailCheck,
  PenLine,
  Globe,
  MapPin,
  Target,
  Beaker,
  Clock,
  Ear,
  SlidersHorizontal,
  ShieldCheck,
  Bot,
  HeartHandshake,
  UserPlus,
  CalendarCheck,
  ShieldOff,
  LifeBuoy,
  Sparkle,
  ChevronUp,
  KeyRound,
  MessageSquare,
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
import FeedbackWidget, { pageNameFromPath } from './FeedbackWidget';

// Sidebar navigation, grouped to match a salesperson's daily flow:
// plan the day (Workspace) → watch the agent (Dialtone) → build the list
// (Leads) → reach out (Outreach) → manage accounts (Clients) → look things up
// (Resources).
//
// Dialtone gets its own section: it is an autonomous agent that sources, sends,
// triages and can halt itself, and its surfaces were previously scattered
// across three unrelated groups — so "what is the agent doing, and is it OK?"
// had no single place to answer it.
// Items flagged `advanced` sit behind a per-section "More" toggle so the
// everyday pages stay visible; the section that owns the current route opens
// itself.
const navSections = [
  {
    key: 'workspace',
    label: 'Workspace',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Pipeline', href: '/pipeline', icon: GitBranch },
      { name: 'Tasks', href: '/tasks', icon: CheckSquare },
      { name: 'Analytics', href: '/analytics', icon: BarChart3 },
      { advanced: true, name: 'Daily Activity', href: '/daily-activity', icon: Activity },
    ],
  },
  {
    key: 'dialtone',
    label: 'Autopilot',
    items: [
      { name: 'Console', href: '/dialtone', icon: Radio, end: true },
      { name: 'Replies', href: '/dialtone/inbox', icon: MailCheck },
      { name: 'AI Drafts', href: '/dialtone/drafts', icon: PenLine },
      { advanced: true, name: 'Templates', href: '/dialtone/templates', icon: FileText },
      { name: 'Campaigns', href: '/dialtone/campaigns', icon: BarChart3 },
      { advanced: true, name: 'A/B Tests', href: '/dialtone/ab-tests', icon: Beaker },
      { advanced: true, name: 'Send Timing', href: '/dialtone/send-timing', icon: Clock },
      { advanced: true, name: 'Policies', href: '/dialtone/policies', icon: SlidersHorizontal },
      { name: 'Prospecting', href: '/prospecting', icon: Radar },
      { advanced: true, name: 'Social Listening', href: '/agents/social-listening', icon: Ear },
      { advanced: true, name: 'ICP', href: '/dialtone/icp', icon: Target },
      { advanced: true, name: 'Places Discovery', href: '/dialtone/discovery', icon: MapPin },
      { advanced: true, name: 'Health', href: '/dialtone/health', icon: Stethoscope },
      { advanced: true, name: 'Senders', href: '/dialtone/senders', icon: Gauge },
      { advanced: true, name: 'Suppression', href: '/dialtone/suppression', icon: ShieldOff },
      { advanced: true, name: 'Domains', href: '/deliverability/domains', icon: Globe },
    ],
  },
  {
    // Autonomous agents that act on their own within guardrails.
    key: 'agents',
    label: 'Agents',
    items: [
      { name: 'Meeting Booking', href: '/agents/booking', icon: CalendarCheck },
      { name: 'Deal Progression', href: '/agents/deals', icon: Bot },
      { name: 'Client Success', href: '/agents/client-success', icon: HeartHandshake },
      { name: 'Referrals', href: '/agents/referrals', icon: UserPlus },
    ],
  },
  {
    key: 'leads',
    label: 'Leads & Prospects',
    items: [
      { name: 'Companies', href: '/companies', icon: Building2 },
      { name: 'Contacts', href: '/contacts', icon: Users },
      { name: 'Discovery', href: '/discovery', icon: Sparkles },
      { advanced: true, name: 'Groups', href: '/groups', icon: Folder },
      { advanced: true, name: 'News', href: '/news', icon: Newspaper },
      { name: 'Import', href: '/import', icon: Upload },
      { advanced: true, name: 'Business Card', href: '/scan', icon: CreditCard },
    ],
  },
  {
    key: 'outreach',
    label: 'Outreach',
    items: [
      { name: 'Inbox', href: '/inbox', icon: Inbox },
      { name: 'Campaigns', href: '/outreach', icon: Send },
      { name: 'Autopilot Campaigns', href: '/campaigns', icon: Rocket },
      { advanced: true, name: 'Calls', href: '/calls', icon: Phone },
      { name: 'Sequences', href: '/sequences', icon: ListOrdered },
      { name: 'Follow-ups', href: '/follow-ups', icon: Bell },
      { advanced: true, name: 'Demos', href: '/demos', icon: Rocket },
    ],
  },
  {
    key: 'clients',
    label: 'Clients',
    items: [
      { name: 'Clients', href: '/clients', icon: HeartPulse },
      { advanced: true, name: 'Client Dashboard', href: '/client-dashboard', icon: PieChart },
      { name: 'Reports', href: '/reports', icon: BarChart3 },
      { advanced: true, name: 'Sentiment', href: '/sentiment', icon: Brain },
    ],
  },
  {
    key: 'fundraising',
    label: 'Fundraising',
    items: [
      { name: 'Investors', href: '/investors', icon: Landmark },
    ],
  },
  {
    key: 'resources',
    label: 'Resources',
    items: [
      { name: 'Knowledge Base', href: '/knowledge', icon: BookOpen },
      { advanced: true, name: 'GDPR Requests', href: '/gdpr', icon: ShieldCheck },
      { advanced: true, name: 'Features', href: '/features', icon: Sparkle },
      { name: 'Help Center', href: '/help', icon: LifeBuoy },
    ],
  },
];

// Platform admin section — cross-org management, shown only to platform_admin
// users (SaaS Phase 2). Prepended to the nav so the "god view" sits at the top.
const platformSection = {
  key: 'platform',
  label: 'Platform',
  items: [
    { name: 'Organizations', href: '/platform', icon: ShieldCheck, end: true },
    // Rotating the Google OAuth client or a provider key without SSH — the
    // credentials belong to the deployment, so they live beside the org list
    // rather than in a tenant's own /settings.
    { name: 'API Credentials', href: '/platform/credentials', icon: KeyRound },
  ],
};

// Flatten all nav items for finding current page name
const allNavItems = [
  ...navSections.flatMap(s => s.items),
  { name: 'Organization', href: '/settings/organization', icon: Building2 },
  { name: 'Team', href: '/settings/team', icon: Users },
  { name: 'Usage', href: '/settings/usage', icon: BarChart3 },
  ...platformSection.items,
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Feedback', href: '/admin/feedback', icon: MessageSquare },
];

const NAV_PREFS_KEY = 'landline.nav.collapsedSections';

export default function Layout({ children }) {
  const location = useLocation();
  const { user, isAdmin, isPlatformAdmin, logout } = useAuth();
  // Platform admins get an extra top-level nav section for cross-org management.
  const sections = useMemo(
    () => (isPlatformAdmin ? [platformSection, ...navSections] : navSections),
    [isPlatformAdmin]
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Account/settings menu lives in a popover so the sidebar footer stays one row
  // tall. Rendered inline it ate ~290px of a 720px viewport and squeezed the nav
  // into a clipped stub.
  const [accountOpen, setAccountOpen] = useState(false);
  const accountMenuRef = useRef(null);

  // Prefix-matching keeps a parent lit on its detail routes (/companies/:id).
  // `end` opts out for a parent that has real siblings under it: without it
  // /dialtone would stay lit on /dialtone/health and two items would look
  // active at once.
  const isActivePath = (href, end = false) =>
    location.pathname === href ||
    (!end && href !== '/' && location.pathname.startsWith(href));

  // Collapsible nav sections. Persist the user's collapsed/expanded choice so
  // the sidebar feels stable across visits; default everything expanded.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(NAV_PREFS_KEY)) || {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(NAV_PREFS_KEY, JSON.stringify(collapsed));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [collapsed]);

  const [showMore, setShowMore] = useState({});
  const toggleMore = (key) => setShowMore((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleSection = (key) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  // Always reveal the section that owns the current route so the active page is
  // never hidden inside a collapsed group (e.g. after a command-palette jump).
  useEffect(() => {
    const active = sections.find((s) =>
      s.items.some((it) => isActivePath(it.href, it.end))
    );
    if (active && collapsed[active.key]) {
      setCollapsed((prev) => ({ ...prev, [active.key]: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

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

  const currentPage = allNavItems.find((item) => isActivePath(item.href, item.end));

  // Section-aware breadcrumb trail. Non-final segments with an `href` render as
  // links so related pages are one click away (e.g. back to the Companies list
  // from a company detail view).
  const breadcrumbs = useMemo(() => {
    const path = location.pathname;
    if (/^\/companies\/.+/.test(path)) {
      return [
        { label: 'Leads & Prospects' },
        { label: 'Companies', href: '/companies' },
        { label: 'Company detail' },
      ];
    }
    if (/^\/investors\/.+/.test(path)) {
      return [
        { label: 'Fundraising' },
        { label: 'Investors', href: '/investors' },
        { label: 'Investor detail' },
      ];
    }
    if (path === '/settings') {
      return [{ label: 'Workspace' }, { label: 'Settings', href: '/settings' }];
    }
    for (const section of sections) {
      const item = section.items.find((it) => isActivePath(it.href, it.end));
      if (item) {
        return [{ label: section.label }, { label: item.name, href: item.href }];
      }
    }
    return [{ label: 'Workspace' }, { label: 'Dashboard', href: '/' }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  // Dismiss on Escape or an outside click. A rendered click-away overlay does
  // not work here: the sidebar carries a transform, which makes it the
  // containing block for `position: fixed` children, so an `inset-0` catcher
  // would only cover the sidebar itself.
  useEffect(() => {
    if (!accountOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setAccountOpen(false);
    };
    const onPointerDown = (e) => {
      if (!accountMenuRef.current?.contains(e.target)) setAccountOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [accountOpen]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const NavLink = ({ item, showBadge, count = 0, onClick }) => {
    const isActive = isActivePath(item.href, item.end);
    return (
      <Link
        to={item.href}
        onClick={onClick}
        className={cn(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-indigo-50 text-indigo-700'
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
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => {
          const isCollapsed = !!collapsed[section.key];
          const hasActive = section.items.some((it) => isActivePath(it.href, it.end));
          const sectionHasBadge =
            section.key === 'outreach' && hasNewReplies;
          return (
            <div key={section.key}>
              <button
                type="button"
                onClick={() => toggleSection(section.key)}
                aria-expanded={!isCollapsed}
                className="group flex w-full items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 transition-colors hover:text-gray-600"
              >
                <ChevronRight
                  className={cn(
                    'h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200',
                    !isCollapsed && 'rotate-90'
                  )}
                />
                <span>{section.label}</span>
                {/* When collapsed, surface that the active page or a new reply
                    lives inside this section. */}
                {isCollapsed && (hasActive || sectionHasBadge) && (
                  <span
                    className={cn(
                      'ml-auto h-1.5 w-1.5 rounded-full',
                      sectionHasBadge ? 'bg-red-500' : 'bg-indigo-500'
                    )}
                  />
                )}
              </button>
              {!isCollapsed && (
                <div className="mt-0.5 space-y-0.5 pb-1">
                  {section.items
                    .filter(
                      (item) =>
                        !item.advanced ||
                        showMore[section.key] ||
                        isActivePath(item.href, item.end)
                    )
                    .map((item) => (
                      <NavLink
                        key={item.name}
                        item={item}
                        showBadge={item.name === 'Inbox' && hasNewReplies}
                        count={item.name === 'Inbox' ? inboxUnread : 0}
                      />
                    ))}
                  {section.items.some((it) => it.advanced) && (
                    <button
                      type="button"
                      onClick={() => toggleMore(section.key)}
                      aria-expanded={!!showMore[section.key]}
                      className="w-full rounded-md px-3 py-1 text-left text-xs text-gray-400 transition-colors hover:text-gray-600"
                    >
                      {showMore[section.key]
                        ? 'Show less'
                        : `More (${section.items.filter((it) => it.advanced).length})`}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* flex-shrink-0 keeps the footer at its natural height instead of being
          compressed into the nav's scroll area. */}
      <div
        ref={accountMenuRef}
        className="relative flex-shrink-0 border-t border-gray-200 px-3 py-2"
      >
        {accountOpen && (
          <>
            {/* Opens upward from the trigger; the nav underneath keeps its full
                height whenever this is closed. */}
            <div
              role="menu"
              aria-label="Account and workspace settings"
              className="absolute inset-x-3 bottom-full z-50 mb-2 max-h-[60vh] space-y-0.5 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg"
            >
              <NavLink
                item={{ name: 'Settings', href: '/settings', icon: Settings, end: true }}
                onClick={() => setAccountOpen(false)}
              />
              <NavLink
                item={{ name: 'Organization', href: '/settings/organization', icon: Building2 }}
                onClick={() => setAccountOpen(false)}
              />
              <NavLink
                item={{ name: 'Team', href: '/settings/team', icon: Users }}
                onClick={() => setAccountOpen(false)}
              />
              <NavLink
                item={{ name: 'Usage', href: '/settings/usage', icon: BarChart3 }}
                onClick={() => setAccountOpen(false)}
              />
              {isAdmin && (
                <NavLink
                  item={{ name: 'Users', href: '/admin/users', icon: UserCog }}
                  onClick={() => setAccountOpen(false)}
                />
              )}
              {isAdmin && (
                <NavLink
                  item={{ name: 'Feedback', href: '/admin/feedback', icon: MessageSquare }}
                  onClick={() => setAccountOpen(false)}
                />
              )}
              {user && (
                <>
                  <div className="my-1 border-t border-gray-100" />
                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(false);
                      logout();
                    }}
                    className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                  >
                    <LogOut className="h-[18px] w-[18px] flex-shrink-0 text-gray-400 transition-colors group-hover:text-gray-600" />
                    Sign out
                  </button>
                </>
              )}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => setAccountOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={accountOpen}
          className={cn(
            'relative z-50 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-100',
            accountOpen && 'bg-gray-100'
          )}
        >
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold uppercase text-indigo-700">
            {(user?.name || user?.email || '?').trim().charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-gray-900">
              {user?.name || 'Account'}
            </div>
            <div className="truncate text-[11px] capitalize text-gray-400">
              {user?.role || 'Settings'}
            </div>
          </div>
          <ChevronUp
            className={cn(
              'h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-200',
              accountOpen && 'rotate-180'
            )}
          />
        </button>

        <div className="px-3 pb-0.5 pt-1">
          <div className="text-[11px] font-medium text-gray-400">DoAide Prospect v1.0 &middot; B2B Lead Gen</div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
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
            <Link
              to="/inbox"
              className="relative rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label={inboxUnread > 0 ? `${inboxUnread} conversations need a reply` : 'Email inbox'}
              title={inboxUnread > 0 ? `${inboxUnread} conversations need a reply` : 'Email inbox'}
            >
              <Bell className="h-5 w-5" />
              {inboxUnread > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-indigo-600 px-1 py-0.5 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                  {inboxUnread > 99 ? '99+' : inboxUnread}
                </span>
              ) : hasNewReplies ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
              ) : null}
            </Link>
          </div>
        </header>

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
