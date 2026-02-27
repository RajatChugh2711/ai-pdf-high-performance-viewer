import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { removeNotification } from '../../features/ui/uiSlice';

const ICON_MAP = {
  info: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  success: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.07 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const COLOR_MAP = {
  info: 'bg-blue-900/80 border-blue-700/50 text-blue-200',
  success: 'bg-green-900/80 border-green-700/50 text-green-200',
  warning: 'bg-yellow-900/80 border-yellow-700/50 text-yellow-200',
  error: 'bg-red-900/80 border-red-700/50 text-red-200',
};

function NotificationItem({ id, type, message, duration = 4000 }: {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  duration?: number;
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch(removeNotification(id));
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, dispatch]);

  return (
    <div
      className={`flex items-start gap-2 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg
        text-sm max-w-sm ${COLOR_MAP[type]}`}
    >
      <span className="flex-shrink-0 mt-0.5">{ICON_MAP[type]}</span>
      <p className="flex-1">{message}</p>
      <button
        onClick={() => dispatch(removeNotification(id))}
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function NotificationStack() {
  const notifications = useAppSelector((s) => s.ui.notifications);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {notifications.map((n) => (
        <NotificationItem key={n.id} {...n} />
      ))}
    </div>
  );
}
