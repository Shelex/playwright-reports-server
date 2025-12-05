import { Suspense } from 'react';
import LoginForm from '../components/login-form';

export default function LoginPage() {
  return (
    <Suspense fallback="opening login page...">
      <LoginForm />
    </Suspense>
  );
}
