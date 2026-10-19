import {
  LayoutDashboard,
  BarChart3,
  Building2,
  GitBranch,
  Upload,
  Send,
  Bell,
  Settings,
  Sparkles,
  ListOrdered,
  FileText,
  Folder,
  Newspaper,
  Rocket,
  CreditCard,
  Users,
  HeartPulse,
  CheckSquare,
  PieChart,
  Inbox,
  BookOpen,
  Phone,
  Landmark,
  Brain,
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
  KeyRound,
  MessageSquare,
  Video,
} from 'lucide-react';

// The sidebar is deliberately short: one hero item and a handful of areas.
// Every area owns a set of `tabs` — pages that used to be sidebar items of
// their own — which Layout renders as a strip above the page, so a page is
// still one click from its siblings without 40 rows of nav. Anything that is
// configuration rather than daily work lives in the Settings directory below.
//
// Matching is by prefix unless `end` is set (see `isActivePath`).

// Autopilot Campaigns is the product's main feature: hand it a document and it
// finds, writes to and follows up with prospects. It sits above everything
// else in the nav.
export const heroNav = {
  key: 'autopilot',
  name: 'Autopilot Campaigns',
  href: '/campaigns',
  icon: Rocket,
  tabs: [
    { name: 'Campaigns', href: '/campaigns', icon: Rocket },
    { name: 'Live Console', href: '/dialtone', icon: Radio, end: true },
    { name: 'AI Drafts', href: '/dialtone/drafts', icon: PenLine },
    { name: 'Performance', href: '/dialtone/campaigns', icon: BarChart3 },
    { name: 'Sequences', href: '/sequences', icon: ListOrdered },
    { name: 'Manual Outreach', href: '/outreach', icon: Send },
  ],
};

export const primaryNav = [
  {
    key: 'dashboard',
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    tabs: [
      { name: 'Overview', href: '/', icon: LayoutDashboard },
      { name: 'Tasks', href: '/tasks', icon: CheckSquare },
      { name: 'Daily Activity', href: '/daily-activity', icon: Activity },
    ],
  },
  {
    key: 'pipeline',
    name: 'Pipeline',
    href: '/pipeline',
    icon: GitBranch,
    tabs: [
      { name: 'Board', href: '/pipeline', icon: GitBranch },
      { name: 'Deal Agent', href: '/agents/deals', icon: Bot },
      { name: 'Meeting Booking', href: '/agents/booking', icon: CalendarCheck },
      { name: 'Demos', href: '/demos', icon: Video },
      { name: 'Calls', href: '/calls', icon: Phone },
    ],
  },
  {
    // One place for replies: the mailbox-wide inbox, the Autopilot triage
    // view of cold-email replies, and what is waiting on a follow-up.
    key: 'inbox',
    name: 'Inbox',
    href: '/inbox',
    icon: Inbox,
    tabs: [
      { name: 'All Mail', href: '/inbox', icon: Inbox },
      { name: 'Autopilot Replies', href: '/dialtone/inbox', icon: MailCheck },
      { name: 'Follow-ups', href: '/follow-ups', icon: Bell },
    ],
  },
  {
    key: 'prospects',
    name: 'Prospects',
    href: '/companies',
    icon: Building2,
    tabs: [
      { name: 'Companies', href: '/companies', icon: Building2 },
      { name: 'Contacts', href: '/contacts', icon: Users },
      { name: 'Review Queue', href: '/prospecting', icon: Radar },
      { name: 'Discover', href: '/discovery', icon: Sparkles },
      { name: 'Import', href: '/import', icon: Upload },
      { name: 'Groups', href: '/groups', icon: Folder },
      { name: 'Card Scan', href: '/scan', icon: CreditCard },
      { name: 'News', href: '/news', icon: Newspaper },
      { name: 'Investors', href: '/investors', icon: Landmark },
    ],
  },
  {
    key: 'clients',
    name: 'Clients',
    href: '/clients',
    icon: HeartPulse,
    tabs: [
      { name: 'Clients', href: '/clients', icon: HeartPulse },
      { name: 'Health', href: '/client-dashboard', icon: PieChart },
      { name: 'Success Agent', href: '/agents/client-success', icon: HeartHandshake },
      { name: 'Referrals', href: '/agents/referrals', icon: UserPlus },
    ],
  },
  {
    key: 'analytics',
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    tabs: [
      { name: 'Analytics', href: '/analytics', icon: BarChart3 },
      { name: 'Reports', href: '/reports', icon: FileText },
      { name: 'Sentiment', href: '/sentiment', icon: Brain },
    ],
  },
];

// Everything that is set up once and then left alone. The Settings page lists
// these as a directory; the sidebar's Settings item stays lit on all of them.
export const settingsDirectory = [
  {
    key: 'autopilot-setup',
    label: 'Autopilot setup',
    description: 'Who Autopilot targets, what it sends, and when.',
    items: [
      { name: 'Ideal Customer Profile', href: '/dialtone/icp', icon: Target },
      { name: 'Email Templates', href: '/dialtone/templates', icon: FileText },
      { name: 'Guardrails & Policies', href: '/dialtone/policies', icon: SlidersHorizontal },
      { name: 'Send Timing', href: '/dialtone/send-timing', icon: Clock },
      { name: 'A/B Tests', href: '/dialtone/ab-tests', icon: Beaker },
      { name: 'Places Discovery', href: '/dialtone/discovery', icon: MapPin },
      { name: 'Social Listening', href: '/agents/social-listening', icon: Ear },
    ],
  },
  {
    key: 'deliverability',
    label: 'Deliverability',
    description: 'Keep mail out of spam. Autopilot pauses itself when these go red.',
    items: [
      { name: 'Health & Auto-pause', href: '/dialtone/health', icon: Stethoscope },
      { name: 'Senders', href: '/dialtone/senders', icon: Gauge },
      { name: 'Domains', href: '/deliverability/domains', icon: Globe },
      { name: 'Suppression List', href: '/dialtone/suppression', icon: ShieldOff },
    ],
  },
  {
    key: 'workspace',
    label: 'Workspace',
    description: 'Your organization, team, data and help.',
    items: [
      { name: 'Organization', href: '/settings/organization', icon: Building2 },
      { name: 'Team', href: '/settings/team', icon: Users },
      { name: 'Usage', href: '/settings/usage', icon: BarChart3 },
      { name: 'Knowledge Base', href: '/knowledge', icon: BookOpen },
      { name: 'GDPR Requests', href: '/gdpr', icon: ShieldCheck },
      { name: 'Users', href: '/admin/users', icon: UserCog, adminOnly: true },
      { name: 'Feedback', href: '/admin/feedback', icon: MessageSquare, adminOnly: true },
      { name: 'Features', href: '/features', icon: Sparkle },
      { name: 'Help Center', href: '/help', icon: LifeBuoy },
    ],
  },
];

export const settingsNav = {
  key: 'settings',
  name: 'Settings',
  href: '/settings',
  icon: Settings,
  // No tab strip: these pages are unrelated to each other. Layout shows a
  // "Back to Settings" link instead.
  tabs: [
    { name: 'Settings', href: '/settings', icon: Settings, end: true },
    ...settingsDirectory.flatMap((g) => g.items),
  ],
};

// Cross-org management, shown only to platform_admin users.
export const platformNav = {
  key: 'platform',
  name: 'Platform',
  href: '/platform',
  icon: ShieldCheck,
  tabs: [
    { name: 'Organizations', href: '/platform', icon: ShieldCheck, end: true },
    // Rotating the Google OAuth client or a provider key without SSH — the
    // credentials belong to the deployment, so they live beside the org list
    // rather than in a tenant's own /settings.
    { name: 'API Credentials', href: '/platform/credentials', icon: KeyRound },
  ],
  // /platform/organizations/:id belongs here too, but to neither tab.
  also: ['/platform'],
};

// Prefix-matching keeps a parent lit on its detail routes (/companies/:id).
// `end` opts out for a parent that has real siblings under it: without it
// /dialtone would stay lit on /dialtone/health.
export function isActivePath(pathname, href, end = false) {
  return pathname === href || (!end && href !== '/' && pathname.startsWith(`${href}/`));
}

export function activeTab(pathname, group) {
  return group.tabs.find((t) => isActivePath(pathname, t.href, t.end)) || null;
}

export function isGroupActive(pathname, group) {
  return (
    Boolean(activeTab(pathname, group)) ||
    (group.also || []).some((href) => isActivePath(pathname, href))
  );
}
