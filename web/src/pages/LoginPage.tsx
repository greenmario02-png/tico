import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth, getErrorMessage } from "@/lib/auth-context";
import { AppApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icon } from "@/components/Icon";
import { BakerMascot, type MascotState } from "@/components/mascot/BakerMascot";
import { ExchangeRateCard } from "@/components/ExchangeRateCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [pwFocused, setPwFocused] = React.useState(false);
  const [showPw, setShowPw] = React.useState(false);
  const [slow, setSlow] = React.useState(false);
  const [retryLeft, setRetryLeft] = React.useState(0);
  const limited = retryLeft > 0;
  const mascotState: MascotState = showPw ? "peek" : pwFocused ? "coverEyes" : "idle";

  React.useEffect(() => {
    if (user) {
      const from = (location.state as { from?: Location })?.from?.pathname ?? "/";
      navigate(from, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Cuenta regresiva viva del 429; se limpia al llegar a 0 o al desmontar.
  React.useEffect(() => {
    if (retryLeft <= 0) return;
    const t = setTimeout(() => setRetryLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [retryLeft]);

  React.useEffect(() => {
    if (limited) setError(`Demasiados intentos. Vuelve a intentar en ${retryLeft} s`);
    else if (retryLeft === 0) setError((e) => (e?.startsWith("Demasiados intentos. Vuelve") ? null : e));
  }, [retryLeft, limited]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (limited) return;
    setError(null);
    setSubmitting(true);
    const slowTimer = setTimeout(() => setSlow(true), 4000);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof AppApiError && err.statusCode === 429 && err.retryAfterSeconds) {
        setRetryLeft(err.retryAfterSeconds);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      clearTimeout(slowTimer);
      setSlow(false);
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <LoginBackdrop />
      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-6 md:flex-row md:gap-12">
        <div className="flex flex-1 flex-col items-center text-center">
          <BakerMascot state={mascotState} className="w-40 text-foreground sm:w-56 md:w-72" />
          <p className="mt-2 text-xl font-semibold">Tu panadería, bajo control</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">Costos, recetas e inventario al día, para que solo te ocupes de hornear.</p>
        </div>
        <div className="flex w-full max-w-sm flex-col items-center gap-3">
          <Card className="w-full bg-card/90 shadow-lg backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Panadería — Costeo e Inventario</CardTitle>
            <CardDescription>Ingresa con tu correo y contraseña para continuar.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit} data-testid="login-form">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Correo</Label>
                <Input
                  id="email"
                  data-testid="login-email"
                  // type="text" a propósito, no "email": la validación nativa
                  // del navegador para type="email" rechaza en silencio
                  // direcciones con caracteres no-ASCII en la parte local
                  // (p. ej. "dueño@panaderia.bo", un usuario real sembrado en
                  // este sistema) y bloquea el submit del <form> sin mostrar
                  // ningún mensaje. El backend ya valida el formato con
                  // zod .email(), que sí lo acepta.
                  type="text"
                  inputMode="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    data-testid="login-password"
                    autoComplete="current-password"
                    required
                    className="pr-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPwFocused(true)}
                    onBlur={() => setPwFocused(false)}
                  />
                  <button
                    type="button"
                    data-testid="login-toggle-password"
                    aria-label={showPw ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={showPw}
                    // onMouseDown/preventDefault: evita que el input pierda el foco
                    // (y la mascota deje de taparse) al pulsar el ojo.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Icon name={showPw ? "visibility_off" : "visibility"} size={20} />
                  </button>
                </div>
              </div>
              {error && (
                <p className="text-sm text-destructive" data-testid="login-error">
                  {error}
                </p>
              )}
              {slow && (
                <p
                  role="status"
                  data-testid="login-waking"
                  className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
                >
                  <Icon name="bedtime" size={18} className="mt-0.5 shrink-0" />
                  <span>Despertando el servidor… puede tardar hasta un minuto la primera vez</span>
                </p>
              )}
              <Button type="submit" disabled={submitting || limited} aria-busy={submitting} data-testid="login-submit">
                {submitting && <Icon name="progress_activity" size={18} className="animate-spin" />}
                {submitting ? "Ingresando…" : "Ingresar"}
              </Button>
            </form>
          </CardContent>
          </Card>
          <ExchangeRateCard compact className="w-full" />
        </div>
      </div>
    </div>
  );
}

// Decoración de fondo: formas difusas + siluetas de trigo con baja opacidad.
function LoginBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
      <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-primary opacity-[0.12] blur-3xl" />
      <div className="absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-warning opacity-[0.10] blur-3xl" />
      <svg className="absolute bottom-6 left-4 h-64 w-64 text-primary opacity-[0.10]" viewBox="0 0 100 100" fill="currentColor">
        <Wheat />
      </svg>
      <svg className="absolute right-6 top-6 h-52 w-52 rotate-[25deg] text-primary opacity-[0.09]" viewBox="0 0 100 100" fill="currentColor">
        <Wheat />
      </svg>
      <svg className="absolute right-[38%] top-[8%] h-28 w-28 text-primary opacity-[0.08]" viewBox="0 0 100 60" fill="currentColor">
        <ellipse cx="50" cy="34" rx="46" ry="22" />
        <path d="M30 20 l8 -10 M50 16 l0 -12 M70 20 l-8 -10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function Wheat() {
  return (
    <g>
      <path d="M50 98 C50 70 50 40 50 12" stroke="currentColor" strokeWidth="3" fill="none" />
      {[14, 28, 42, 56].map((y) => (
        <g key={y}>
          <ellipse cx="41" cy={y + 6} rx="6" ry="11" transform={`rotate(-30 41 ${y + 6})`} />
          <ellipse cx="59" cy={y + 6} rx="6" ry="11" transform={`rotate(30 59 ${y + 6})`} />
        </g>
      ))}
      <ellipse cx="50" cy="9" rx="5" ry="10" />
    </g>
  );
}
