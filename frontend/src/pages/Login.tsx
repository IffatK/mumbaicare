import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Logo } from '../components/Layout';
import { Field, Spinner } from '../components/ui';
const schema = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });
const DEMO = [['Admin', 'admin@mumbaicare.local'], ['Analyst', 'analyst@mumbaicare.local'], ['Staff (Andheri)', 'staff.andheri@mumbaicare.local']];
export default function Login() {
  const { user, login } = useAuth(); const [err, setErr] = useState('');
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  if (user) return <Navigate to="/app" replace />;
  const onSubmit = handleSubmit(async v => { setErr(''); try { await login(v.email, v.password); } catch (e: any) { setErr(e.message); } });
  return <div className="grid min-h-screen place-items-center bg-navy-900 p-4">
    <div className="w-full max-w-sm">
      <Link to="/" className="mb-6 flex justify-center"><Logo light /></Link>
      <form onSubmit={onSubmit} className="rounded-lg bg-white p-6 shadow-xl" noValidate>
        <h1 className="font-display text-xl font-semibold text-navy-900">Sign in</h1>
        <p className="mb-5 mt-1 text-sm text-ink-500">Use your MumbaiCare account.</p>
        <div className="space-y-4">
          <Field label="Email" htmlFor="email" error={errors.email?.message}><input id="email" type="email" autoComplete="username" className="input" {...register('email')} /></Field>
          <Field label="Password" htmlFor="pw" error={errors.password?.message}><input id="pw" type="password" autoComplete="current-password" className="input" {...register('password')} /></Field>
          {err && <p className="rounded-md bg-alert-100 px-3 py-2 text-sm text-alert-600" role="alert">{err}</p>}
          <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting && <Spinner />}Sign in</button>
        </div>
      </form>
      <div className="mt-4 rounded-lg bg-navy-800 p-4 text-sm text-ink-200">
        <p className="font-semibold text-white">Local demo accounts</p><p className="mb-2 text-xs">Password for all: <code className="text-tide-500">Password@123</code></p>
        <div className="flex flex-wrap gap-2">{DEMO.map(([l, e]) => <button key={e} type="button" className="rounded bg-navy-700 px-2 py-1 text-xs hover:bg-navy-950"
          onClick={() => { setValue('email', e); setValue('password', 'Password@123'); }}>{l}</button>)}</div>
      </div>
    </div></div>;
}
