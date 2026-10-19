import { cn } from '../lib/utils';

// Prospect's accent. Every DoAide product draws the same robot mark in its own
// colour (Pulse teal, Jobs gold); the shape and the wordmark are what's shared.
export const BRAND_ACCENT = '#4F46E5';
// Eyes and smile are drawn light so they read against the indigo face; black
// eyes on indigo vanished at sidebar size. The pupils carry the deep ink.
const EYE = '#FFFFFF';
const PUPIL = '#1E1B4B';

/**
 * The DoAide robot mark, in Prospect indigo. Rendered inline so it stays crisp
 * at any size.
 */
export function LogoMark({ className, size = 32, color = BRAND_ACCENT, title = 'DoAide Prospect' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
    >
      <line x1="16" y1="6" x2="16" y2="2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="1.5" r="1.5" fill={color} />
      <rect x="5" y="6" width="22" height="17" rx="5" fill={color} />
      <ellipse cx="11" cy="13" rx="2.5" ry="3" fill={EYE} data-part="eye" />
      <ellipse cx="21" cy="13" rx="2.5" ry="3" fill={EYE} data-part="eye" />
      <circle cx="11.5" cy="13.5" r="1.2" fill={PUPIL} />
      <circle cx="21.5" cy="13.5" r="1.2" fill={PUPIL} />
      <path d="M12 19Q16 22 20 19" stroke={EYE} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <rect x="1" y="10" width="4" height="5" rx="2" fill={color} opacity="0.8" />
      <rect x="27" y="10" width="4" height="5" rx="2" fill={color} opacity="0.8" />
    </svg>
  );
}

/**
 * Full lockup: mark + "DoAide | Prospect", the wordmark every DoAide product
 * uses with its own name in italics.
 */
// `inverted` is for surfaces that are dark in both themes (the sign-in hero).
export default function Logo({ className, markSize = 30, showWord = true, wordClassName, inverted = false }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark size={markSize} />
      {showWord && (
        <span
          className={cn(
            'text-[19px] font-bold tracking-tight',
            inverted ? 'text-white' : 'text-gray-900',
            wordClassName
          )}
        >
          DoAide{' '}
          <span className={cn('font-normal', inverted ? 'text-white/30' : 'text-gray-300')} aria-hidden="true">
            |
          </span>{' '}
          <em className={inverted ? 'text-indigo-300' : 'text-indigo-600 dark:text-indigo-400'}>Prospect</em>
        </span>
      )}
    </div>
  );
}
