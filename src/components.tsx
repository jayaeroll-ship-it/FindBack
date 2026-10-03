import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  MapPin,
  CalendarDays,
  Package,
  Search,
  LoaderCircle,
  ShieldCheck,
  ImagePlus,
} from "lucide-react";
import { api } from "./api";
import type { Item, Config } from "./types";

export function ErrorBox({ message }: { message: string }) {
  return message ? (
    <div className="error" role="alert">
      {message}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="state" role="status">
      <LoaderCircle className="spin" aria-hidden="true" /> Loading…
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Search size={36} aria-hidden="true" />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function useResource<T>(path: string, initial?: T) {
  const [data, setData] = useState<T | undefined>(initial),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<T>(path)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, version]);
  return {
    data,
    setData,
    error,
    loading,
    reload: () => setVersion((v) => v + 1),
  };
}
export function Badge({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function ItemCard({ item }: { item: Item }) {
  return (
    <article className="item-card">
      <Link
        className="card-photo"
        to={`/items/${item.id}`}
        tabIndex={-1}
        aria-hidden="true"
      >
        {item.photos[0] ? (
          <img
            src={item.photos[0] + "?thumb=true"}
            width="480"
            height="360"
            loading="lazy"
            alt=""
          />
        ) : (
          <div className="no-photo">
            <Package size={48} />
            <span>No photo provided</span>
          </div>
        )}
        <Badge tone={item.kind === "found" ? "green" : "orange"}>
          {item.kind === "found" ? "Found" : "Lost"}
        </Badge>
      </Link>
      <div className="card-body">
        <span className="eyebrow">{item.category}</span>
        <h3>
          <Link to={`/items/${item.id}`}>{item.title}</Link>
        </h3>
        <p className="card-meta">
          <MapPin size={15} aria-hidden="true" />
          {item.area}
        </p>
        <p className="card-meta">
          <CalendarDays size={15} aria-hidden="true" />
          {new Date(item.event_date + "T12:00:00").toLocaleDateString(
            undefined,
            { month: "short", day: "numeric", year: "numeric" },
          )}
        </p>
        {item.score !== undefined && (
          <div className="match-score">
            <strong>{Math.round(item.score * 100)}% similarity</strong>
            <span>Potential match</span>
          </div>
        )}
        {item.reasons && (
          <ul className="reasons">
            {item.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
let challengeScript: Promise<void> | undefined;
function loadChallenge() {
  if (window.turnstile) return Promise.resolve();
  if (!challengeScript)
    challengeScript = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        challengeScript = undefined;
        script.remove();
        reject(
          new Error("Security check could not load. Check your connection."),
        );
      };
      document.head.append(script);
    });
  return challengeScript;
}
export function BotCheck({
  config,
  action,
  onToken,
  resetKey = 0,
}: {
  config: Config | null;
  action: string;
  onToken: (v: string) => void;
  resetKey?: number;
}) {
  const ref = useRef<HTMLDivElement>(null),
    callback = useRef(onToken),
    [error, setError] = useState("");
  callback.current = onToken;
  useEffect(() => {
    callback.current("");
    setError("");
    let active = true,
      id: string | undefined;
    if (config?.turnstile_site_key && !config.bot_bypass)
      loadChallenge()
        .then(() => {
          if (active && ref.current)
            id = window.turnstile?.render(ref.current, {
              sitekey: config.turnstile_site_key,
              action,
              size: "flexible",
              callback: (v: string) => callback.current(v),
              "expired-callback": () => callback.current(""),
              "error-callback": () =>
                setError("Security check failed. Reload and try again."),
            });
        })
        .catch((e) => setError(e.message));
    return () => {
      active = false;
      if (id) window.turnstile?.remove(id);
    };
  }, [config, action, resetKey]);
  if (config?.bot_bypass)
    return (
      <p className="help">
        <ShieldCheck size={15} aria-hidden="true" /> Development mode: bot
        protection bypass is explicitly enabled.
      </p>
    );
  if (!config) return <p role="status">Loading security check…</p>;
  if (!config.turnstile_site_key)
    return (
      <ErrorBox message="Bot protection must be configured before this form can be submitted." />
    );
  return (
    <>
      <div ref={ref} />
      <ErrorBox message={error} />
    </>
  );
}
export function PhotoInput({
  onFiles,
  multiple = true,
}: {
  onFiles: (v: File[]) => void;
  multiple?: boolean;
}) {
  const [error, setError] = useState(""),
    [names, setNames] = useState<string[]>([]);
  return (
    <div>
      <label className="upload">
        <ImagePlus size={28} aria-hidden="true" />
        <strong>
          {multiple ? "Add item photos" : "Choose a reference photo"}
        </strong>
        <span>
          JPEG, PNG or WebP · up to 8 MB each{multiple ? " · max. 3" : ""}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple={multiple}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (
              files.length > (multiple ? 3 : 1) ||
              files.some(
                (f) =>
                  f.size > 8 * 1024 * 1024 ||
                  !["image/jpeg", "image/png", "image/webp"].includes(f.type),
              )
            ) {
              setError(
                "Choose up to " +
                  (multiple ? 3 : 1) +
                  " JPEG, PNG or WebP photos under 8 MB each.",
              );
              e.target.value = "";
              onFiles([]);
              setNames([]);
              return;
            }
            setError("");
            onFiles(files);
            setNames(files.map((f) => f.name));
          }}
        />
      </label>
      {names.map((n) => (
        <p className="help" key={n}>
          {n}
        </p>
      ))}
      <ErrorBox message={error} />
    </div>
  );
}
export function LocationMap({ items }: { items: Item[] }) {
  const [enabled, setEnabled] = useState(false),
    [error, setError] = useState(""),
    ref = useRef<HTMLDivElement>(null);
  const located = items.filter(
    (i) => i.latitude !== null && i.longitude !== null,
  );
  useEffect(() => {
    if (!enabled || !ref.current || !located.length) return;
    let disposed = false,
      cleanup = () => {};
    void import("leaflet")
      .then(async (L) => {
        await import("leaflet/dist/leaflet.css");
        if (disposed || !ref.current) return;
        const map = L.map(ref.current, { scrollWheelZoom: false }).setView(
          [located[0].latitude!, located[0].longitude!],
          11,
        );
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 13,
        }).addTo(map);
        const bounds: L.LatLngExpression[] = [];
        located.forEach((item) => {
          const position: L.LatLngExpression = [
            item.latitude!,
            item.longitude!,
          ];
          bounds.push(position);
          const content = document.createElement("a");
          content.href = "/items/" + item.id;
          content.textContent = item.title + " · " + item.area;
          L.circle(position, {
            radius: 1200,
            color: item.kind === "lost" ? "#c45c13" : "#244ddb",
            fillOpacity: 0.1,
          })
            .addTo(map)
            .bindPopup(content);
        });
        if (bounds.length > 1) map.fitBounds(L.latLngBounds(bounds).pad(0.2));
        cleanup = () => map.remove();
      })
      .catch(() =>
        setError(
          "Map could not load. Approximate areas are listed on each item.",
        ),
      );
    return () => {
      disposed = true;
      cleanup();
    };
  }, [enabled, items]);
  if (!located.length)
    return (
      <Empty title="No map locations yet">
        Reports with approximate coordinates will appear here. You can still
        search by area.
      </Empty>
    );
  return (
    <section className="map-panel">
      <div className="map-info">
        <MapPin aria-hidden="true" />
        <p>
          Locations show approximate areas, never exact addresses. Loading the
          map contacts OpenStreetMap’s tile service.
        </p>
        {!enabled && (
          <button className="button secondary" onClick={() => setEnabled(true)}>
            Load map
          </button>
        )}
      </div>
      {enabled && (
        <div
          className="map"
          ref={ref}
          aria-label="Map of approximate report areas"
        />
      )}
      <ErrorBox message={error} />
    </section>
  );
}
