import { Link, useInRouterContext } from 'react-router-dom';

const ctaClass =
  'mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2';

// `action` is { label, onClick } or { label, href } (an in-app route).
export default function EmptyState({ title, description, action, icon: Icon }) {
  const inRouter = useInRouterContext();
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {Icon && (
        <div className="mb-4">
          <Icon className="h-12 w-12 text-gray-300" />
        </div>
      )}
      <h3 className="text-lg font-medium text-gray-900">{title || 'No data yet'}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>
      )}
      {action &&
        (action.href ? (
          inRouter ? (
            <Link to={action.href} className={ctaClass}>
              {action.label}
            </Link>
          ) : (
            <a href={action.href} className={ctaClass}>
              {action.label}
            </a>
          )
        ) : (
          <button type="button" onClick={action.onClick} className={ctaClass}>
            {action.label}
          </button>
        ))}
    </div>
  );
}
