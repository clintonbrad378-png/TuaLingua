import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { uiLang } from "./i18n";
import "./styles.css";

document.documentElement.lang = uiLang();

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}
