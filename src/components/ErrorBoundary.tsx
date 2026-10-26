import { Component, type ErrorInfo, type ReactNode } from "react";
import { t } from "../i18n";
import Mascot from "./Mascot";

/** Última red de seguridad: si una pantalla explota, mostramos un fallback
 * recuperable en vez de dejar el WebView en blanco. */
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("TuaLingua: pantalla caída", error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  reload = () => {
    window.location.reload();
  };

  render() {
    const error = this.state.error;
    if (!error) return this.props.children;
    return (
      <div className="app">
        <div className="screen splash" role="alert">
          <Mascot mood="sad" size={110} />
          <p className="tag">{t("app.something_went_wrong")}</p>
          <p className="error-text">{error.message}</p>
          <button className="btn btn-primary" onClick={this.reset}>
            {t("app.retry")}
          </button>
          <button className="btn ghost" onClick={this.reload}>
            Recargar
          </button>
        </div>
      </div>
    );
  }
}
