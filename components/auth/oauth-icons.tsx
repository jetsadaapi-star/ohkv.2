// Brand icons for the OAuth sign-in buttons, shared by login and register.

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
        fill="#1877F2"
      />
    </svg>
  );
}

/** LINE's green speech-bubble mark. */
export function LineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="5.5" fill="#06C755" />
      <path
        fill="#fff"
        d="M19.7 11.04c0-3.57-3.58-6.48-7.98-6.48s-7.98 2.91-7.98 6.48c0 3.2 2.84 5.88 6.67 6.39.26.06.61.17.7.39.08.2.05.51.03.71l-.11.68c-.04.2-.16.79.69.43.85-.36 4.59-2.7 6.26-4.63 1.15-1.27 1.72-2.56 1.72-3.97ZM9.1 12.95H7.52a.42.42 0 0 1-.42-.42V9.36a.42.42 0 1 1 .84 0v2.75H9.1a.42.42 0 1 1 0 .84Zm1.64-.42a.42.42 0 1 1-.84 0V9.36a.42.42 0 1 1 .84 0v3.17Zm3.82 0a.42.42 0 0 1-.76.25l-1.62-2.2v1.95a.42.42 0 1 1-.84 0V9.36a.42.42 0 0 1 .76-.25l1.62 2.2V9.36a.42.42 0 1 1 .84 0v3.17Zm2.56-2.01a.42.42 0 1 1 0 .84h-1.16v.75h1.16a.42.42 0 1 1 0 .84h-1.58a.42.42 0 0 1-.42-.42V9.36c0-.23.19-.42.42-.42h1.58a.42.42 0 1 1 0 .84h-1.16v.74h1.16Z"
      />
    </svg>
  );
}

/** X (formerly Twitter): the black X mark; follows the text colour. */
export function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

/** Apple's logo; follows the text colour, as Apple's own button does. */
export function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.73c-.02-2.27 1.86-3.36 1.94-3.41-1.06-1.55-2.7-1.76-3.28-1.78-1.4-.14-2.73.82-3.44.82-.71 0-1.8-.8-2.96-.78-1.52.02-2.93.89-3.71 2.25-1.58 2.75-.4 6.81 1.14 9.04.75 1.09 1.65 2.31 2.82 2.27 1.13-.05 1.56-.73 2.93-.73 1.36 0 1.75.73 2.95.71 1.22-.02 1.99-1.11 2.73-2.2.86-1.26 1.21-2.48 1.23-2.55-.03-.01-2.36-.9-2.38-3.58ZM14.12 6.07c.62-.76 1.04-1.81.93-2.86-.9.04-1.99.6-2.63 1.35-.58.67-1.09 1.74-.95 2.77 1 .08 2.03-.51 2.65-1.26Z" />
    </svg>
  );
}
