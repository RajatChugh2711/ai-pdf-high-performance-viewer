import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm';
import { useAppSelector } from '../app/hooks';
import { selectIsAuthenticated, selectSessionChecked } from '../features/auth/authSelectors';

interface LocationState {
  from?: Location;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const sessionChecked = useAppSelector(selectSessionChecked);

  const state = location.state as LocationState | null;
  const from = state?.from?.pathname ?? '/dashboard';

  useEffect(() => {
    if (sessionChecked && isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, sessionChecked, navigate, from]);

  return <LoginForm />;
}
