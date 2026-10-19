import React, { Suspense, lazy } from 'react';
import { Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Pipeline = lazy(() => import('./pages/Pipeline'));
const Companies = lazy(() => import('./pages/Companies'));
const CompanyDetail = lazy(() => import('./pages/CompanyDetail'));
const Import = lazy(() => import('./pages/Import'));
const Discovery = lazy(() => import('./pages/Discovery'));
const Prospecting = lazy(() => import('./pages/Prospecting'));
const Sequences = lazy(() => import('./pages/Sequences'));
const Outreach = lazy(() => import('./pages/Outreach'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const CampaignNew = lazy(() => import('./pages/CampaignNew'));
const CampaignDashboard = lazy(() => import('./pages/CampaignDashboard'));
const FollowUps = lazy(() => import('./pages/FollowUps'));
const Groups = lazy(() => import('./pages/Groups'));
const NewsFeed = lazy(() => import('./pages/NewsFeed'));
const Settings = lazy(() => import('./pages/Settings'));
const Demos = lazy(() => import('./pages/Demos'));
const CardScanner = lazy(() => import('./pages/CardScanner'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Clients = lazy(() => import('./pages/Clients'));
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Reports = lazy(() => import('./pages/Reports'));
const DailyActivity = lazy(() => import('./pages/DailyActivity'));
const DialtoneConsole = lazy(() => import('./pages/DialtoneConsole'));
const DialtoneHealth = lazy(() => import('./pages/DialtoneHealth'));
const Icp = lazy(() => import('./pages/Icp'));
const DialtoneInbox = lazy(() => import('./pages/DialtoneInbox'));
const DialtoneAbTests = lazy(() => import('./pages/DialtoneAbTests'));
const DialtoneCampaigns = lazy(() => import('./pages/DialtoneCampaigns'));
const EmailTemplates = lazy(() => import('./pages/EmailTemplates'));
const DialtoneSendTiming = lazy(() => import('./pages/DialtoneSendTiming'));
const DialtonePolicies = lazy(() => import('./pages/DialtonePolicies'));
const AiDrafts = lazy(() => import('./pages/AiDrafts'));
const ReferralAgent = lazy(() => import('./pages/ReferralAgent'));
const DomainHealth = lazy(() => import('./pages/DomainHealth'));
const SenderHealth = lazy(() => import('./pages/SenderHealth'));
const SocialListening = lazy(() => import('./pages/SocialListening'));
const DialtoneSuppression = lazy(() => import('./pages/DialtoneSuppression'));
const PlacesDiscovery = lazy(() => import('./pages/PlacesDiscovery'));
const Inbox = lazy(() => import('./pages/Inbox'));
const Knowledge = lazy(() => import('./pages/Knowledge'));
const Calls = lazy(() => import('./pages/Calls'));
const Investors = lazy(() => import('./pages/Investors'));
const InvestorDetail = lazy(() => import('./pages/InvestorDetail'));
const SentimentDashboard = lazy(() => import('./pages/SentimentDashboard'));
const DealAgent = lazy(() => import('./pages/DealAgent'));
const Login = lazy(() => import('./pages/Login'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminFeedback = lazy(() => import('./pages/AdminFeedback'));
const GdprControls = lazy(() => import('./pages/GdprControls'));
const OrganizationSettings = lazy(() => import('./pages/OrganizationSettings'));
const TeamManagement = lazy(() => import('./pages/TeamManagement'));
const UsageDashboard = lazy(() => import('./pages/UsageDashboard'));
const ClientSuccessAgent = lazy(() => import('./pages/ClientSuccessAgent'));
const BookingAgent = lazy(() => import('./pages/BookingAgent'));
const Platform = lazy(() => import('./pages/Platform'));
const PlatformOrganizationDetail = lazy(() => import('./pages/PlatformOrganizationDetail'));
const PlatformCredentials = lazy(() => import('./pages/PlatformCredentials'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const FeaturesPage = lazy(() => import('./pages/FeaturesPage'));

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
      <p className="text-gray-600 mb-4">Page Not Found</p>
      <a href="/" className="text-brand-600 hover:text-brand-800 underline">
        Go back to home
      </a>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
    </div>
  );
}

// Authenticated app shell: gate on auth, then render the sidebar layout with the
// matched page inside a Suspense boundary (for the lazy route chunks).
function ProtectedShell() {
  const location = useLocation();
  return (
    <ProtectedRoute>
      <Layout>
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<LoadingSpinner />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Public / auth routes — rendered without the app layout. */}
        <Route path="/login" element={<Login />} />
        {/* Sign-up is the "Create account" tab of the sign-in landing page. */}
        <Route path="/register" element={<Login key="signup" initialMode="signup" />} />
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />

        {/* Everything below requires authentication. */}
        <Route element={<ProtectedShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/companies/:id" element={<CompanyDetail />} />
          <Route path="/import" element={<Import />} />
          <Route path="/discovery" element={<Discovery />} />
          <Route path="/prospecting" element={<Prospecting />} />
          <Route path="/sequences" element={<Sequences />} />
          <Route path="/outreach" element={<Outreach />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/new" element={<CampaignNew />} />
          <Route path="/campaigns/:id" element={<CampaignDashboard />} />
          <Route path="/follow-ups" element={<FollowUps />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/news" element={<NewsFeed />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/organization" element={<OrganizationSettings />} />
          <Route path="/settings/team" element={<TeamManagement />} />
          <Route path="/settings/usage" element={<UsageDashboard />} />
          <Route path="/demos" element={<Demos />} />
          <Route path="/scan" element={<CardScanner />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/client-dashboard" element={<ClientDashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/daily-activity" element={<DailyActivity />} />
          <Route path="/dialtone" element={<DialtoneConsole />} />
          <Route path="/dialtone/health" element={<DialtoneHealth />} />
          <Route path="/dialtone/senders" element={<SenderHealth />} />
          <Route path="/dialtone/suppression" element={<DialtoneSuppression />} />
          <Route path="/dialtone/icp" element={<Icp />} />
          <Route path="/dialtone/inbox" element={<DialtoneInbox />} />
          <Route path="/dialtone/ab-tests" element={<DialtoneAbTests />} />
          <Route path="/dialtone/campaigns" element={<DialtoneCampaigns />} />
          <Route path="/dialtone/templates" element={<EmailTemplates />} />
          <Route path="/dialtone/send-timing" element={<DialtoneSendTiming />} />
          <Route path="/dialtone/policies" element={<DialtonePolicies />} />
          <Route path="/dialtone/drafts" element={<AiDrafts />} />
          <Route path="/dialtone/discovery" element={<PlacesDiscovery />} />
          <Route path="/agents/booking" element={<BookingAgent />} />
          <Route path="/agents/client-success" element={<ClientSuccessAgent />} />
          <Route path="/agents/referrals" element={<ReferralAgent />} />
          <Route path="/agents/social-listening" element={<SocialListening />} />
          <Route path="/deliverability/domains" element={<DomainHealth />} />
          <Route path="/inbox" element={<Inbox />} />
          {/* Unified Inbox folded into /inbox (one queue: Gmail + SMTP +
              replies, with archive/read/priority/bulk/date). Redirect the old
              path so bookmarks and deep links keep working. */}
          <Route path="/unified-inbox" element={<Navigate to="/inbox" replace />} />
          <Route path="/knowledge" element={<Knowledge />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/help/:articleId" element={<HelpPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/gdpr" element={<GdprControls />} />
          <Route path="/calls" element={<Calls />} />
          <Route path="/investors" element={<Investors />} />
          <Route path="/investors/:id" element={<InvestorDetail />} />
          <Route path="/sentiment" element={<SentimentDashboard />} />
          <Route path="/agents/deals" element={<DealAgent />} />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requireRole="org_admin">
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/feedback"
            element={
              <ProtectedRoute requireRole="org_admin">
                <AdminFeedback />
              </ProtectedRoute>
            }
          />
          {/* Platform Admin (SaaS Phase 2) — platform_admin role only. */}
          <Route
            path="/platform"
            element={
              <ProtectedRoute requireRole="platform_admin">
                <Platform />
              </ProtectedRoute>
            }
          />
          <Route
            path="/platform/credentials"
            element={
              <ProtectedRoute requireRole="platform_admin">
                <PlatformCredentials />
              </ProtectedRoute>
            }
          />
          <Route
            path="/platform/organizations/:id"
            element={
              <ProtectedRoute requireRole="platform_admin">
                <PlatformOrganizationDetail />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
