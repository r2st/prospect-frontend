import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { settingsDirectory } from '../lib/navigation';

// Every set-up-once page that used to be its own sidebar row (ICP, templates,
// senders, domains…). The sidebar's Settings item leads here, so moving them
// out of the nav did not make them harder to find.
export default function SettingsDirectory({ isAdmin = false }) {
  return (
    <section aria-labelledby="settings-directory-heading" className="space-y-4">
      <h2 id="settings-directory-heading" className="sr-only">
        Setup and tools
      </h2>
      {settingsDirectory.map((group) => (
        <div key={group.key} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">{group.label}</h3>
          <p className="mt-0.5 text-xs text-gray-500">{group.description}</p>
          <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {group.items
              .filter((item) => !item.adminOnly || isAdmin)
              .map((item) => (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-indigo-600" />
                    <span className="flex-1">{item.name}</span>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-400" />
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
