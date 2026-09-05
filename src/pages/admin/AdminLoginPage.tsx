import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";

export function AdminLoginPage() {
  const { session, loading, signIn } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) {
    return <Navigate to="/admin" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş başarısız.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="stack"
      style={{ maxWidth: 380, margin: "10vh auto", padding: "0 16px" }}
    >
      <div className="brand" style={{ justifyContent: "center" }}>
        <span className="brand-mark">FP</span>
        <span>Fon Portföy Admin</span>
      </div>

      <form className="card stack" onSubmit={handleSubmit}>
        <p className="section-title">Yönetici Girişi</p>

        <div className="field">
          <label className="field-label" htmlFor="email">
            E-posta
          </label>
          <input
            id="email"
            type="email"
            className="input"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="password">
            Parola
          </label>
          <input
            id="password"
            type="password"
            className="input"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p style={{ color: "var(--color-danger)", fontSize: 14 }}>{error}</p>}

        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
      </form>

      <p className="disclaimer" style={{ textAlign: "center" }}>
        Bu bölüm yalnızca yetkili yöneticiler içindir. Herkese açık kayıt yoktur.
      </p>
    </div>
  );
}
