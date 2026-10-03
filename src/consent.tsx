import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { X, Cookie } from "lucide-react";
const KEY = "findback-consent-v1";
type Consent = { analytics: boolean; version: 1 };
export function readConsent(): Consent | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "null");
    return value?.version === 1 && typeof value.analytics === "boolean"
      ? value
      : null;
  } catch {
    return null;
  }
}
const Context = createContext({
  analytics: false,
  manage: () => {},
  track: (_event: string) => {},
});
export const useConsent = () => useContext(Context);
export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<Consent | null>(readConsent);
  const [manage, setManage] = useState(false);
  const [choice, setChoice] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const save = (analytics: boolean) => {
    const value: Consent = { version: 1, analytics };
    try {
      localStorage.setItem(KEY, JSON.stringify(value));
    } catch {
      /* Consent still applies in this session. */
    }
    setConsent(value);
    setManage(false);
  };
  useEffect(() => {
    if (manage) {
      previousFocus.current = document.activeElement as HTMLElement;
      setChoice(consent?.analytics || false);
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
      previousFocus.current?.focus();
    }
  }, [manage, consent]);
  const track = (event: string) => {
    if (consent?.analytics)
      void import("./tracking").then((m) => m.track(event));
  };
  return (
    <Context.Provider
      value={{
        analytics: consent?.analytics || false,
        manage: () => setManage(true),
        track,
      }}
    >
      {children}
      {!consent && (
        <aside className="cookie-banner" aria-label="Cookie consent">
          <Cookie size={25} aria-hidden="true" />
          <div>
            <strong>Your privacy, your choice.</strong>
            <p>
              Essential storage keeps you signed in. Optional analytics help us
              improve FindBack.
            </p>
          </div>
          <div className="cookie-actions">
            <button className="button primary" onClick={() => save(true)}>
              Accept optional cookies
            </button>
            <button className="button secondary" onClick={() => save(false)}>
              Reject optional cookies
            </button>
            <button className="text-button" onClick={() => setManage(true)}>
              Manage preferences
            </button>
          </div>
        </aside>
      )}
      <dialog
        ref={dialog}
        onCancel={() => setManage(false)}
        aria-labelledby="cookie-title"
      >
        <div className="dialog-heading">
          <h2 id="cookie-title">Cookie preferences</h2>
          <button
            aria-label="Close cookie preferences"
            className="icon-button"
            onClick={() => setManage(false)}
          >
            <X />
          </button>
        </div>
        <p>
          Essential session cookies and local preferences are always enabled. We
          use optional analytics only with your permission.
        </p>
        <div className="preference">
          <div>
            <strong>Essential</strong>
            <p>Sign-in, security and your cookie choice.</p>
          </div>
          <span>Always on</span>
        </div>
        <label className="preference">
          <div>
            <strong>Optional analytics</strong>
            <p>Anonymous totals for searches and recovery actions.</p>
          </div>
          <input
            type="checkbox"
            checked={choice}
            onChange={(e) => setChoice(e.target.checked)}
          />
        </label>
        <button className="button primary full" onClick={() => save(choice)}>
          Save preferences
        </button>
      </dialog>
    </Context.Provider>
  );
}
