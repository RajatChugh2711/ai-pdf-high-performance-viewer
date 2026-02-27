import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectUser } from '../../features/auth/authSelectors';
import { logout } from '../../features/auth/authSlice';
import { toggleSidebar } from '../../features/ui/uiSlice';

export function Header() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);

  return (
    <header className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-800 flex-shrink-0 z-10">
      {/* Left: logo + sidebar toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => dispatch(toggleSidebar())}
          className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition"
          title="Toggle sidebar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white">DocChat AI</span>
        </div>
      </div>

      {/* Right: user info + logout */}
      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center">
              <span className="text-xs font-medium text-gray-200">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-sm text-gray-300 hidden sm:block">{user.name}</span>
          </div>
        )}

        <button
          onClick={() => dispatch(logout())}
          className="text-xs text-gray-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-gray-800 transition"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
