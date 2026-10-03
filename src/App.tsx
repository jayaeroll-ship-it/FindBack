import { useEffect, useRef, useState, lazy, Suspense } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Search,
  Plus,
  MapPin,
  ShieldCheck,
  ScanLine,
  Menu,
  X,
  LogOut,
  MessageCircle,
  Bell,
  LayoutDashboard,
  Settings,
  Check,
  Package,
  Compass,
  HeartHandshake,
  SlidersHorizontal,
  Grid2X2,
  Map,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { api, json } from "./api";
import { AppProvider, useApp } from "./context";
import { ConsentProvider, useConsent } from "./consent";
import {
  Badge,
  BotCheck,
  Empty,
  ErrorBox,
  ItemCard,
  Loading,
  PhotoInput,
  LocationMap,
  useResource,
} from "./components";
import type {
  ChatMessage,
  Claim,
  Conversation,
  Item,
  Notice,
  User,
} from "./types";
import "./styles.css";
const Legal = lazy(() => import("./Legal"));

function Logo() {
  return (
    <Link className="logo" to="/" aria-label="FindBack home">
      <img src="/favicon.svg" width="35" height="35" alt="" />
      Find<span>Back</span>
    </Link>
  );
}
function Shell() {
  const { user, setUser, config, configError } = useApp(),
    { manage } = useConsent(),
    [menu, setMenu] = useState(false),
    location = useLocation();
  useEffect(() => {
    setMenu(false);
    window.scrollTo({ top: 0 });
    const el = document.getElementById("main");
    el?.focus({ preventScroll: true });
  }, [location.pathname]);
  useEffect(() => {
    const titles: Record<string, string> = {
      "/": "Find your way back",
      "/browse": "Browse lost & found items",
      "/report-lost": "Report a lost item",
      "/report-found": "Report a found item",
      "/login": "Sign in",
      "/register": "Create an account",
      "/forgot-password": "Reset your password",
      "/reset-password": "Choose a new password",
      "/dashboard": "Your recovery dashboard",
      "/claims": "Ownership claims",
      "/messages": "Private messages",
      "/settings": "Account settings",
      "/admin": "Moderation workspace",
      "/privacy-policy": "Privacy policy",
      "/terms-and-conditions": "Terms & conditions",
    };
    document.title =
      (titles[location.pathname] || "Recovery workspace") + " — FindBack";
  }, [location.pathname]);
  const logout = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
    } catch {
      window.location.reload();
    }
  };
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Logo />
          <button
            className="mobile-menu icon-button"
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-expanded={menu}
            aria-controls="navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <nav
            id="navigation"
            className={menu ? "open" : ""}
            aria-label="Main navigation"
          >
            <NavLink to="/browse">Browse items</NavLink>
            <NavLink to="/report-found">I found something</NavLink>
            {user && <NavLink to="/dashboard">My dashboard</NavLink>}
          </nav>
          <div className="header-actions">
            {user ? (
              <>
                <Link
                  className="icon-button"
                  to="/messages"
                  aria-label="Messages"
                >
                  <MessageCircle size={21} />
                </Link>
                <Link
                  className="avatar"
                  to="/settings"
                  aria-label="Account settings"
                >
                  {user.name.slice(0, 1).toUpperCase()}
                </Link>
                <button
                  className="icon-button logout"
                  onClick={logout}
                  aria-label="Sign out"
                >
                  <LogOut size={19} />
                </button>
              </>
            ) : (
              <Link to="/login" className="sign-in">
                Sign in
              </Link>
            )}
            <Link className="button primary small" to="/report-lost">
              <Plus size={17} aria-hidden="true" />
              Report a Lost Item
            </Link>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <ErrorBox message={configError} />
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/search" element={<Browse />} />
            <Route path="/items/:id" element={<Details />} />
            <Route
              path="/report-lost"
              element={
                <Protected>
                  <ReportForm kind="lost" />
                </Protected>
              }
            />
            <Route
              path="/report-found"
              element={
                <Protected>
                  <ReportForm kind="found" />
                </Protected>
              }
            />
            <Route path="/login" element={<Auth mode="login" />} />
            <Route path="/register" element={<Auth mode="register" />} />
            <Route path="/forgot-password" element={<Auth mode="forgot" />} />
            <Route path="/reset-password" element={<Auth mode="reset" />} />
            <Route
              path="/dashboard"
              element={
                <Protected>
                  <Dashboard />
                </Protected> 
              }
            />
            <Route
              path="/matches/:id"
              element={
                <Protected>
                  <Matches />
                </Protected>
              }
            />
            <Route
              path="/claims"
              element={
                <Protected>
                  <Claims />
                </Protected>
              }
            />
            <Route
              path="/messages"
              element={
                <Protected>
                  <Messages />
                </Protected>
              }
            />
            <Route
              path="/messages/:id"
              element={
                <Protected>
                  <Messages />
                </Protected>
              }
            />
            <Route
              path="/settings"
              element={
                <Protected>
                  <AccountSettings />
                </Protected>
              }
            />
            <Route
              path="/admin"
              element={
                <Protected staff>
                  <Admin />
                </Protected>
              }
            />
            <Route path="/privacy-policy" element={<Legal kind="privacy" />} />
            <Route
              path="/terms-and-conditions"
              element={<Legal kind="terms" />}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="site-footer">
        <div className="footer-main">
          <div>
            <Logo />
            <p>A little technology. A lot of looking out for each other.</p>
          </div>
          <span className="footer-note">
            <ShieldCheck size={17} aria-hidden="true" />
            Made for safer reunions.
          </span>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} FindBack</span>
          <div>
            <Link to="/privacy-policy">Privacy policy</Link>
            <Link to="/terms-and-conditions">Terms & conditions</Link>
            <button onClick={manage}>Cookie preferences</button>
            {config?.social_profile_url && (
              <a
                href={config.social_profile_url}
                rel="noopener noreferrer"
                target="_blank"
              >
                Follow me for more
              </a>
            )}
          </div>
        </div>
      </footer>
    </>
  );
}
function Protected({
  children,
  staff = false,
}: {
  children: ReactNode;
  staff?: boolean;
}) {
  const { user, ready } = useApp(),
    location = useLocation();
  if (!ready) return <Loading />;
  if (!user)
    return (
      <Navigate
        to={
          "/login?next=" +
          encodeURIComponent(location.pathname + location.search)
        }
        replace
      />
    );
  if (staff && user.role === "user")
    return (
      <Page title="Access restricted">
        <p>This workspace is available to moderators and administrators.</p>
        <Link to="/dashboard">Go to your dashboard</Link>
      </Page>
    );
  return children;
}
function Page({
  title,
  kicker,
  description,
  children,
  actions,
}: {
  title: string;
  kicker?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="container page">
      <div className="page-heading">
        <div>
          {kicker && <p className="eyebrow">{kicker}</p>}
          <h1>{title}</h1>
          {description && <p className="lede">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}
function Home() {
  const { data, error, loading } = useResource<{
    items: Item[];
    total: number;
  }>("/reports?size=4");
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  return (
    <>
      <section className="home-hero container">
        <div className="hero-copy">
          <span className="hero-label">
            <span className="mini-loop" />A community that brings things back
          </span>
          <h1>
            Lost something?
            <br />
            Let’s find your
            <br />
            <span>way back.</span>
          </h1>
          <p>
            From everyday essentials to irreplaceable favorites. Connect with
            people nearby and give lost belongings a way home.
          </p>
          <div className="hero-actions">
            <Link className="button primary large" to="/report-lost">
              <Plus size={19} aria-hidden="true" />
              Report a Lost Item
            </Link>
            <Link className="secondary-link" to="/browse">
              Explore found items
            </Link>
          </div>
          <div className="hero-trust">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>Private claims. Helpful matches. Human connections.</span>
          </div>
        </div>
        <div className="hero-feature">
          <div className="feature-top">
            <span className="eyebrow">A BETTER CHANCE OF FINDING IT</span>
            <ScanLine size={23} aria-hidden="true" />
          </div>
          <div className="feature-symbol">
            <img src="/favicon.svg" width="104" height="104" alt="" />
          </div>
          <h2>
            The right connection
            <br />
            changes everything.
          </h2>
          <p>
            Our AI looks for similarities in photos and descriptions. You decide
            what belongs to you.
          </p>
          <div className="feature-chips">
            <span>
              <Check size={16} aria-hidden="true" /> Photo similarity
            </span>
            <span>
              <Check size={16} aria-hidden="true" /> Nearby reports
            </span>
          </div>
          <div className="feature-bottom">
            <HeartHandshake size={24} aria-hidden="true" />
            <span>
              Built around trust,
              <br />
              <strong>one reunion at a time.</strong>
            </span>
          </div>
        </div>
      </section>
      <section className="search-strip container">
        <div>
          <Search size={23} aria-hidden="true" />
          <span>Already looking for something?</span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate("/browse?q=" + encodeURIComponent(query));
          }}
        >
          <label className="sr-only" htmlFor="home-search">
            Search item reports
          </label>
          <input
            id="home-search"
            placeholder="Try “blue backpack” or “keys”…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={120}
          />
          <button className="button primary" type="submit">
            Search items
          </button>
        </form>
      </section>
      <section className="container recent">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE COMMUNITY NOTICEBOARD</p>
            <h2>A few things looking for home.</h2>
            <p>
              Recognize something? A small connection can make a big difference.
            </p>
          </div>
          <Link className="secondary-link" to="/browse">
            Browse all items
          </Link>
        </div>
        <ErrorBox message={error} />
        {loading ? (
          <Loading />
        ) : data?.items.length ? (
          <div className="item-grid">
            {data.items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <Empty title="The noticeboard is ready for your first report">
            Found something or missing a favorite? Share a report to start a
            connection.
          </Empty>
        )}
      </section>
      <section className="how-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">LESS SEARCHING. MORE FINDING.</p>
              <h2>A simple path back.</h2>
            </div>
            <p>Useful technology, with people at the heart of it.</p>
          </div>
          <div className="steps">
            <div>
              <span className="step-icon">
                <Package />
              </span>
              <span className="step-number">01</span>
              <h3>Tell us what’s missing</h3>
              <p>
                A photo, a description and an approximate area give your item a
                place to start.
              </p>
            </div>
            <div>
              <span className="step-icon">
                <ScanLine />
              </span>
              <span className="step-number">02</span>
              <h3>Look for a connection</h3>
              <p>
                Review possible matches across photos, details, locations and
                dates.
              </p>
            </div>
            <div>
              <span className="step-icon">
                <HeartHandshake />
              </span>
              <span className="step-number">03</span>
              <h3>Bring it safely home</h3>
              <p>
                Share private ownership evidence, chat with the finder and plan
                a safe exchange.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
function Browse() {
  const [params, setParams] = useSearchParams(),
    [view, setView] = useState<"grid" | "map">("grid"),
    [filters, setFilters] = useState(false),
    { config } = useApp(),
    { track } = useConsent();
  const query = params.toString(),
    { data, error, loading } = useResource<{
      items: Item[];
      total: number;
      page: number;
    }>("/reports?" + query);
  const [visual, setVisual] = useState<Item[] | null>(null),
    [photo, setPhoto] = useState<File[]>([]),
    [busy, setBusy] = useState(false),
    [visualError, setVisualError] = useState("");
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    next.delete("page");
    setParams(next);
    setVisual(null);
  };
  const search = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setVisualError("");
    const form = new FormData();
    if (photo[0]) form.append("photo", photo[0]);
    try {
      const result = await api<{ items: Item[] }>("/search/visual", {
        method: "POST",
        body: form,
      });
      setVisual(result.items);
      track("search");
    } catch (e) {
      setVisualError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const items = visual || data?.items || [];
  return (
    <Page
      title="The community noticeboard"
      kicker="LOST HERE. FOUND HERE."
      description="Look for your belongings, or help someone find theirs."
    >
      <div className="browse-toolbar">
        <form
          className="search-field"
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("q") as string;
            update("q", value);
            track("search");
          }}
        >
          <Search size={20} aria-hidden="true" />
          <label className="sr-only" htmlFor="browse-q">
            Search items
          </label>
          <input
            key={params.get("q") || ""}
            id="browse-q"
            name="q"
            defaultValue={params.get("q") || ""}
            placeholder="Search a description, item or detail…"
            maxLength={120}
          />
          <button className="button primary" type="submit">
            Search
          </button>
        </form>
        <button
          className="button secondary"
          aria-expanded={filters}
          onClick={() => setFilters(!filters)}
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
          Filters
        </button>
        <div className="view-switch">
          <button
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <Grid2X2 size={19} />
          </button>
          <button
            aria-label="Map view"
            aria-pressed={view === "map"}
            onClick={() => setView("map")}
          >
            <Map size={19} />
          </button>
        </div>
      </div>
      <div className="browse-tabs" role="group" aria-label="Report type">
        {[
          ["", "All items"],
          ["found", "Found items"],
          ["lost", "Lost items"],
        ].map(([value, label]) => (
          <button
            key={label}
            className={(params.get("kind") || "") === value ? "active" : ""}
            onClick={() => update("kind", value)}
          >
            {label}
          </button>
        ))}
        <span>
          {visual
            ? "Visual search results"
            : data
              ? `${data.total} community reports`
              : ""}
        </span>
      </div>
      {filters && (
        <div className="filter-panel">
          {[
            ["category", "Category"],
            ["area", "Approximate area"],
            ["color", "Color"],
            ["brand", "Brand"],
            ["after", "Since date"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              {key === "category" ? (
                <select
                  value={params.get(key) || ""}
                  onChange={(e) => update(key, e.target.value)}
                >
                  <option value="">All categories</option>
                  {config?.categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={key === "after" ? "date" : "text"}
                  value={params.get(key) || ""}
                  maxLength={120}
                  onChange={(e) => update(key, e.target.value)}
                />
              )}
            </label>
          ))}
          <button
            className="text-button"
            onClick={() => {
              setParams({});
              setVisual(null);
            }}
          >
            Clear filters
          </button>
        </div>
      )}
      <details className="visual-search">
        <summary>
          <ScanLine size={20} aria-hidden="true" />
          Search with a photo
        </summary>
        <form className="visual-search-form" onSubmit={search}>
          <p>
            Upload a reference photo. It is processed for this search and is not
            stored.
          </p>
          <PhotoInput multiple={false} onFiles={setPhoto} />
          <button className="button primary" disabled={busy || !photo.length}>
            {busy ? "Searching…" : "Find visually similar items"}
          </button>
          <ErrorBox message={visualError} />
        </form>
      </details>
      <ErrorBox message={error} />
      {loading && !visual ? (
        <Loading />
      ) : !items.length ? (
        <Empty title="No items found">
          Try a broader search or a different area. New reports may still be
          awaiting review.
        </Empty>
      ) : view === "map" ? (
        <LocationMap items={items} />
      ) : (
        <div className="item-grid browse-grid">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
      {!visual && data && data.total > 12 && (
        <div className="pagination">
          <button
            className="button secondary"
            disabled={data.page === 1}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("page", String(data.page - 1));
              setParams(next);
            }}
          >
            <ChevronLeft size={17} aria-hidden="true" />
            Previous
          </button>
          <span>Page {data.page}</span>
          <button
            className="button secondary"
            disabled={data.page * 12 >= data.total}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("page", String(data.page + 1));
              setParams(next);
            }}
          >
            Next
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>
      )}
    </Page>
  );
}
function Auth({ mode }: { mode: "login" | "register" | "forgot" | "reset" }) {
  const { user, setUser, config } = useApp(),
    [params] = useSearchParams(),
    navigate = useNavigate(),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [bot, setBot] = useState(""),
    [resetKey, setResetKey] = useState(0);
  const titles = {
    login: "Welcome back.",
    register: "Let’s bring things back.",
    forgot: "Forgot your password?",
    reset: "A fresh start.",
  };
  const descriptions = {
    login: "Sign in to keep your recovery moving.",
    register: "Join a community that looks out for each other.",
    forgot: "We’ll send a private link to reset it.",
    reset: "Choose a new password for your account.",
  };
  const next = params.get("next") || "/dashboard";
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (mode === "login" || mode === "register") {
        const value = await api<User>(
          "/auth/" + mode,
          json("POST", { ...data, bot_token: bot }),
        );
        setUser(value);
        navigate(safeNext, { replace: true });
      } else {
        const value = await api<{ message: string }>(
          "/auth/" + (mode === "forgot" ? "forgot" : "reset"),
          json("POST", { ...data, token: params.get("token"), bot_token: bot }),
        );
        setSuccess(value.message);
      }
    } catch (e) {
      setError((e as Error).message);
      setResetKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }
  if (user && (mode === "login" || mode === "register"))
    return <Navigate to={safeNext} replace />;
  return (
    <div className="auth-wrap">
      <div className="auth-side">
        <span className="eyebrow">FIND YOUR WAY BACK</span>
        <h2>
          Good people.
          <br />
          Better connections.
        </h2>
        <p>Your next report could be someone else’s happy ending.</p>
        <HeartHandshake size={80} aria-hidden="true" />
      </div>
      <section className="auth-card">
        <h1>{titles[mode]}</h1>
        <p className="lede">{descriptions[mode]}</p>
        {success ? (
          <div className="success" role="status">
            <Check aria-hidden="true" />
            {success}
            <Link to="/login">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            {mode === "register" && (
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>
            )}
            {mode !== "reset" && (
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </label>
            )}
            {mode !== "forgot" && (
              <label>
                {mode === "reset" ? "New password" : "Password"}
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                  minLength={12}
                  maxLength={128}
                />
                {mode !== "login" && (
                  <span className="help">
                    Use at least 12 characters. A passphrase works well.
                  </span>
                )}
              </label>
            )}
            {(mode === "register" || mode === "forgot") && (
              <BotCheck
                config={config}
                action={mode === "register" ? "register" : "reset"}
                onToken={setBot}
                resetKey={resetKey}
              />
            )}
            <ErrorBox message={error} />
            <button
              className="button primary full"
              disabled={
                busy ||
                ((mode === "register" || mode === "forgot") &&
                  !config?.bot_bypass &&
                  !bot)
              }
            >
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : mode === "register"
                    ? "Create account"
                    : mode === "forgot"
                      ? "Send reset link"
                      : "Update password"}
            </button>
            {mode === "login" && (
              <Link className="auth-link" to="/forgot-password">
                Forgot password?
              </Link>
            )}
          </form>
        )}
        {mode === "login" ? (
          <p className="auth-bottom">
            New here?{" "}
            <Link to={"/register?next=" + encodeURIComponent(safeNext)}>
              Create an account
            </Link>
          </p>
        ) : mode === "register" ? (
          <p className="auth-bottom">
            Already a member?{" "}
            <Link to={"/login?next=" + encodeURIComponent(safeNext)}>
              Sign in
            </Link>
          </p>
        ) : null}
        {mode === "register" && (
          <p className="help">
            By creating an account you agree to our{" "}
            <Link to="/terms-and-conditions">terms</Link>. Read our{" "}
            <Link to="/privacy-policy">privacy policy</Link>.
          </p>
        )}
      </section>
    </div>
  );
}
function ReportForm({ kind }: { kind: "lost" | "found" }) {
  const { config } = useApp(),
    navigate = useNavigate(),
    { track } = useConsent(),
    [photos, setPhotos] = useState<File[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [bot, setBot] = useState(""),
    [resetKey, setResetKey] = useState(0);
  const today = new Date().toLocaleDateString("en-CA");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(e.currentTarget),
      values = Object.fromEntries(form);
    const payload = {
      ...values,
      kind,
      latitude: values.latitude === "" ? null : Number(values.latitude),
      longitude: values.longitude === "" ? null : Number(values.longitude),
      bot_token: bot,
    };
    const upload = new FormData();
    upload.append("payload", JSON.stringify(payload));
    photos.forEach((p) => upload.append("photos", p));
    try {
      const result = await api<Item>("/reports", {
        method: "POST",
        body: upload,
      });
      track("report_submission");
      navigate("/items/" + result.id + "?submitted=1");
    } catch (e) {
      setError((e as Error).message);
      setResetKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      title={
        kind === "lost"
          ? "Let’s find your lost item."
          : "Help something find its way home."
      }
      kicker={kind === "lost" ? "REPORT A LOST ITEM" : "REPORT A FOUND ITEM"}
      description="A few useful details can make all the difference."
    >
      <div className="report-layout">
        <form className="panel report-form" onSubmit={submit}>
          <div className="form-section">
            <span className="section-number">01</span>
            <h2>The item</h2>
            <p>
              Include identifying details, but keep serial numbers and private
              proof for a claim.
            </p>
            <PhotoInput onFiles={setPhotos} />
            <label>
              Item name
              <input
                name="title"
                placeholder="e.g. Navy blue everyday backpack"
                required
                minLength={4}
                maxLength={120}
              />
            </label>
            <div className="form-row">
              <label>
                Category
                <select name="category" required defaultValue="">
                  <option value="" disabled>
                    Choose a category
                  </option>
                  {config?.categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Color
                <input
                  name="color"
                  placeholder="e.g. Navy blue"
                  maxLength={40}
                />
              </label>
            </div>
            <label>
              Brand <span className="optional">(optional)</span>
              <input
                name="brand"
                maxLength={80}
                placeholder="e.g. Fjällräven"
              />
            </label>
            <label>
              Description
              <textarea
                name="description"
                rows={5}
                required
                minLength={20}
                maxLength={3000}
                placeholder="Tell us about the item’s shape, material and visible details. Avoid posting personal information."
              />
            </label>
          </div>
          <div className="form-section">
            <span className="section-number">02</span>
            <h2>Where and when</h2>
            <label>
              Approximate area
              <input
                name="area"
                placeholder="Neighborhood, park or station"
                required
                minLength={3}
                maxLength={120}
              />
            </label>
            <label>
              Date {kind === "lost" ? "last seen" : "found"}
              <input
                name="event_date"
                type="date"
                min="2000-01-01"
                max={today}
                required
              />
            </label>
            <details>
              <summary>Place an approximate area on the map (optional)</summary>
              <p className="help">
                Enter nearby coordinates rather than a home address. We round
                them to a grid of about 2 km before storing them.
              </p>
              <div className="form-row">
                <label>
                  Latitude
                  <input
                    name="latitude"
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                  />
                </label>
                <label>
                  Longitude
                  <input
                    name="longitude"
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                  />
                </label>
              </div>
            </details>
          </div>
          <BotCheck
            config={config}
            action="report"
            onToken={setBot}
            resetKey={resetKey}
          />
          <ErrorBox message={error} />
          <button
            className="button primary full"
            disabled={busy || (!config?.bot_bypass && !bot)}
          >
            {busy ? "Saving your report…" : "Submit " + kind + " item report"}
          </button>
        </form>
        <aside className="report-aside">
          <div className="tip-card">
            <ShieldCheck size={28} aria-hidden="true" />
            <h3>A little privacy goes a long way.</h3>
            <p>
              Photos are public once a report is approved. Avoid visible
              addresses, IDs, passwords or full serial numbers.
            </p>
            <p>
              Save unique details for the private ownership check. A match is
              only a suggestion.
            </p>
          </div>
          <div className="tip-card pale">
            <ScanLine size={28} aria-hidden="true" />
            <h3>Give your match a head start.</h3>
            <p>
              A clear photo, an accurate category and a useful description help
              our AI look for potential connections.
            </p>
            <p>Reports can be submitted before matching is available.</p>
          </div>
        </aside>
      </div>
    </Page>
  );
}
function Details() {
  const { id } = useParams(),
    {
      data: item,
      error,
      loading,
      reload,
    } = useResource<Item>("/reports/" + id),
    { user, config } = useApp(),
    navigate = useNavigate(),
    [params] = useSearchParams(),
    [claim, setClaim] = useState(false),
    [bot, setBot] = useState(""),
    [resetKey, setResetKey] = useState(0),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState(""),
    [success, setSuccess] = useState(""),
    { track } = useConsent();
  if (loading) return <Loading />;
  if (!item)
    return (
      <Page title="Item unavailable">
        <ErrorBox message={error} />
        <Link to="/browse">Browse other reports</Link>
      </Page>
    );
  const contact = async () => {
    if (!user) {
      navigate("/login?next=" + encodeURIComponent("/items/" + id));
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ id: string }>(
        "/reports/" + id + "/conversations",
        { method: "POST" },
      );
      navigate("/messages/" + result.id);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const submitClaim = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setActionError("");
    const evidence = new FormData(e.currentTarget).get("evidence");
    try {
      await api(
        "/reports/" + id + "/claims",
        json("POST", { evidence, bot_token: bot }),
      );
      setSuccess(
        "Your private ownership claim has been sent. Track the decision in Claims.",
      );
      setClaim(false);
      track("claim_initiation");
    } catch (e) {
      setActionError((e as Error).message);
      setResetKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };
  const status = async (value: string) => {
    setBusy(true);
    try {
      await api("/reports/" + id + "/status", json("PATCH", { status: value }));
      reload();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      title={item.title}
      kicker={item.kind === "lost" ? "LOST ITEM REPORT" : "FOUND ITEM REPORT"}
      actions={
        <Link className="secondary-link" to="/browse">
          Back to browse
        </Link>
      }
    >
      {params.get("submitted") && (
        <div className="success" role="status">
          Report saved.{" "}
          {item.review_status === "pending"
            ? "It will appear publicly after moderation review."
            : "It is now on the community noticeboard."}{" "}
          Similarity matching is queued.
        </div>
      )}
      <div className="detail-layout">
        <div>
          {item.photos.length ? (
            <div className="detail-photos">
              {item.photos.map((photo, i) => (
                <img
                  key={photo}
                  src={photo}
                  width="800"
                  height="600"
                  loading={i ? "lazy" : "eager"}
                  alt={`${item.title}, photo ${i + 1}`}
                />
              ))}
            </div>
          ) : (
            <div className="detail-placeholder">
              <Package size={80} aria-hidden="true" />
              <p>No photo provided</p>
            </div>
          )}
          <div className="panel detail-description">
            <h2>About this item</h2>
            <p className="preserve-lines">{item.description}</p>
            <dl className="item-facts">
              <div>
                <dt>Category</dt>
                <dd>{item.category}</dd>
              </div>
              <div>
                <dt>Color</dt>
                <dd>{item.color || "Not specified"}</dd>
              </div>
              <div>
                <dt>Brand</dt>
                <dd>{item.brand || "Not specified"}</dd>
              </div>
              <div>
                <dt>Date {item.kind === "lost" ? "last seen" : "found"}</dt>
                <dd>{item.event_date}</dd>
              </div>
            </dl>
            <h3>
              <MapPin size={19} aria-hidden="true" />
              Approximate area
            </h3>
            <p>{item.area}</p>
            <LocationMap items={[item]} />
          </div>
        </div>
        <aside>
          <div className="panel detail-actions">
            <div className="badge-row">
              <Badge tone={item.kind === "found" ? "green" : "orange"}>
                {item.kind === "found" ? "Found" : "Lost"}
              </Badge>
              <Badge>{item.status}</Badge>
            </div>
            {item.is_owner ? (
              <>
                <h2>Your report</h2>
                <p>
                  Publication: {item.review_status}. Embeddings:{" "}
                  {item.embedding_status}.
                </p>
                <Link className="button primary full" to={"/matches/" + id}>
                  Review potential matches
                </Link>
                {item.status !== "recovered" && (
                  <button
                    className="button secondary full"
                    disabled={busy}
                    onClick={() => status("recovered")}
                  >
                    Mark as recovered
                  </button>
                )}
                {item.status === "active" && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => status("closed")}
                  >
                    Close report
                  </button>
                )}
              </>
            ) : (
              <>
                <h2>
                  {item.kind === "found"
                    ? "Could this be yours?"
                    : "Have a helpful lead?"}
                </h2>
                <p>
                  Similarity can point you in the right direction. Ownership
                  needs a private check.
                </p>
                {item.status === "active" && (
                  <>
                    <button
                      className="button primary full"
                      disabled={busy}
                      onClick={contact}
                    >
                      <MessageCircle size={18} aria-hidden="true" />
                      Contact {item.kind === "found" ? "finder" : "reporter"}
                    </button>
                    {item.kind === "found" && (
                      <button
                        className="button secondary full"
                        onClick={() =>
                          user
                            ? setClaim(!claim)
                            : navigate(
                                "/login?next=" +
                                  encodeURIComponent("/items/" + id),
                              )
                        }
                      >
                        Start an ownership claim
                      </button>
                    )}
                  </>
                )}
              </>
            )}
            <ErrorBox message={actionError} />
            {success && (
              <div className="success" role="status">
                {success}
                <Link to="/claims">View claims</Link>
              </div>
            )}
            {claim && (
              <form onSubmit={submitClaim}>
                <label>
                  Private ownership evidence
                  <textarea
                    name="evidence"
                    required
                    minLength={30}
                    maxLength={5000}
                    rows={5}
                    placeholder="Describe unique details that are not visible in the report, or how you can prove ownership."
                  />
                </label>
                <p className="help">
                  Only you and the report owner can read this evidence.
                </p>
                <BotCheck
                  config={config}
                  action="claim"
                  onToken={setBot}
                  resetKey={resetKey}
                />
                <button
                  className="button primary full"
                  disabled={busy || (!config?.bot_bypass && !bot)}
                >
                  {busy ? "Submitting…" : "Submit private claim"}
                </button>
              </form>
            )}
          </div>
          <div className="tip-card pale">
            <ShieldCheck aria-hidden="true" />
            <h3>Make a safe connection.</h3>
            <p>
              Keep your conversation here. Verify ownership before sharing
              contact details. Arrange exchanges in a public place.
            </p>
          </div>
          {user && !item.is_owner && <AbuseForm id={item.id} />}
        </aside>
      </div>
    </Page>
  );
}
function AbuseForm({ id }: { id: string }) {
  const [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <details className="abuse-form">
      <summary>Report a problem with this item</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const body = new FormData(e.currentTarget).get("reason");
          try {
            await api("/reports/" + id + "/abuse", json("POST", { body }));
            setSuccess("Sent to the moderation team.");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Reason
          <textarea name="reason" required minLength={5} maxLength={2000} />
        </label>
        <ErrorBox message={error} />
        {success ? (
          <p role="status">{success}</p>
        ) : (
          <button className="button secondary" disabled={busy}>
            Send abuse report
          </button>
        )}
      </form>
    </details>
  );
}
function WorkspaceNav() {
  const { user } = useApp();
  return (
    <nav className="workspace-nav" aria-label="Recovery workspace">
      <NavLink to="/dashboard">
        <LayoutDashboard size={18} aria-hidden="true" />
        Overview
      </NavLink>
      <NavLink to="/claims">
        <ShieldCheck size={18} aria-hidden="true" />
        Claims
      </NavLink>
      <NavLink to="/messages">
        <MessageCircle size={18} aria-hidden="true" />
        Messages
      </NavLink>
      <NavLink to="/settings">
        <Settings size={18} aria-hidden="true" />
        Settings
      </NavLink>
      {user?.role !== "user" && <NavLink to="/admin">Moderation</NavLink>}
    </nav>
  );
}
function Dashboard() {
  const { user } = useApp(),
    { data, error, loading } = useResource<{ reports: Item[] }>("/dashboard"),
    notices = useResource<Notice[]>("/notifications"),
    [noticeError, setNoticeError] = useState("");
  return (
    <Page
      title={`Welcome back, ${user?.name.split(" ")[0]}.`}
      kicker="YOUR RECOVERY WORKSPACE"
      description="Every report is a chance to bring something back."
      actions={
        <Link className="button primary" to="/report-lost">
          <Plus size={18} aria-hidden="true" />
          Report a Lost Item
        </Link>
      }
    >
      <WorkspaceNav />
      <div className="dashboard-stats">
        {[
          ["Your reports", data?.reports.length || 0],
          [
            "Active searches",
            data?.reports.filter((i) => i.status === "active").length || 0,
          ],
          [
            "Recovered",
            data?.reports.filter((i) => i.status === "recovered").length || 0,
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="workspace-columns">
        <section>
          <div className="section-heading">
            <h2>Your reports</h2>
            <Link to="/report-found" className="secondary-link">
              Report a found item
            </Link>
          </div>
          <ErrorBox message={error} />
          {loading ? (
            <Loading />
          ) : data?.reports.length ? (
            <div className="report-list">
              {data.reports.map((r) => (
                <div key={r.id} className="report-row">
                  <div>
                    <Badge tone={r.kind === "found" ? "green" : "orange"}>
                      {r.kind}
                    </Badge>
                    <h3>
                      <Link to={"/items/" + r.id}>{r.title}</Link>
                    </h3>
                    <p>
                      {r.area} · {r.status} · {r.review_status}
                    </p>
                    <p className="help">
                      Matching:{" "}
                      {r.embedding_status === "ready"
                        ? "ready to review"
                        : "waiting for the embedding worker"}
                    </p>
                  </div>
                  <Link
                    className="button secondary small"
                    to={"/matches/" + r.id}
                  >
                    View matches
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Your first report starts here">
              Use the report form to start looking, or help someone else.
            </Empty>
          )}
        </section>
        <aside className="panel notifications">
          <div className="section-heading">
            <h2>
              <Bell size={20} aria-hidden="true" />
              Updates
            </h2>
            <button
              className="text-button"
              onClick={async () => {
                try {
                  await api("/notifications/read", { method: "POST" });
                  notices.reload();
                } catch (e) {
                  setNoticeError((e as Error).message);
                }
              }}
            >
              Mark read
            </button>
          </div>
          <ErrorBox message={noticeError || notices.error} />
          {notices.data?.length ? (
            notices.data.map((n) => (
              <Link
                className={"notice " + (!n.read ? "unread" : "")}
                to={n.href}
                key={n.id}
              >
                <span>{n.text}</span>
                <Badge tone="muted">{n.kind}</Badge>
              </Link>
            ))
          ) : (
            <p className="help">
              Match suggestions, messages and claim decisions will appear here.
            </p>
          )}
        </aside>
      </div>
    </Page>
  );
}
function Matches() {
  const { id } = useParams(),
    { data, error, loading } = useResource<{
      source: Item;
      items: Item[];
      disclaimer: string;
    }>("/reports/" + id + "/matches"),
    { track } = useConsent();
  useEffect(() => {
    if (data) track("match_view");
  }, [data]);
  return (
    <Page
      title="Possible connections."
      kicker="AI MATCH SUGGESTIONS"
      description="Ranked by photo and text similarity, category, approximate area and date."
    >
      <WorkspaceNav />
      <div className="info-strip">
        <ShieldCheck size={21} aria-hidden="true" />A high similarity score is a
        lead to investigate. It never confirms ownership or approves a claim.
      </div>
      {data && (
        <p className="lede">
          Looking for: <Link to={"/items/" + id}>{data.source.title}</Link>
        </p>
      )}
      <ErrorBox message={error} />
      {error && (
        <p className="help">
          If this report is queued, start the embedding worker and refresh after
          processing. Matching does not use a placeholder score.
        </p>
      )}
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        <div className="item-grid browse-grid">
          {data.items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        !error && (
          <Empty title="No potential matches yet">
            As the noticeboard grows, new connections may appear in your
            updates.
          </Empty>
        )
      )}
    </Page>
  );
}
function Claims() {
  const { data, error, loading, reload } = useResource<Claim[]>("/claims");
  return (
    <Page
      title="Ownership claims"
      description="Private proof. Clear decisions. Safer reunions."
    >
      <WorkspaceNav />
      <ErrorBox message={error} />
      {loading ? (
        <Loading />
      ) : data?.length ? (
        <div className="claims-list">
          {data.map((claim) => (
            <ClaimCard key={claim.id} claim={claim} reload={reload} />
          ))}
        </div>
      ) : (
        <Empty title="No claims yet">
          If a found item looks like yours, start a private ownership claim from
          its report.
        </Empty>
      )}
    </Page>
  );
}
function ClaimCard({ claim, reload }: { claim: Claim; reload: () => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const decide = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        "/claims/" + claim.id,
        json("PATCH", Object.fromEntries(new FormData(e.currentTarget))),
      );
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="panel claim-card">
      <div className="section-heading">
        <h2>
          <Link to={"/items/" + claim.report.id}>{claim.report.title}</Link>
        </h2>
        <Badge
          tone={
            claim.status === "accepted"
              ? "green"
              : claim.status === "rejected"
                ? "orange"
                : "blue"
          }
        >
          {claim.status}
        </Badge>
      </div>
      <p className="eyebrow">PRIVATE OWNERSHIP EVIDENCE</p>
      <p className="preserve-lines">{claim.evidence}</p>
      {claim.decision_note && (
        <div className="decision">
          <strong>Decision note</strong>
          <p>{claim.decision_note}</p>
        </div>
      )}
      {claim.can_decide && claim.status === "pending" && (
        <form onSubmit={decide}>
          <div className="form-row">
            <label>
              Decision
              <select name="status">
                <option value="accepted">
                  Accept after verifying evidence
                </option>
                <option value="rejected">Reject ownership claim</option>
              </select>
            </label>
            <label>
              Private decision note
              <input name="note" required minLength={5} maxLength={1000} />
            </label>
          </div>
          <p className="help">
            Accepting starts a handoff. Mark the report recovered after the
            exchange.
          </p>
          <ErrorBox message={error} />
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Save human-reviewed decision"}
          </button>
        </form>
      )}
    </article>
  );
}
function Messages() {
  const { id } = useParams(),
    conversations = useResource<Conversation[]>("/conversations");
  return (
    <Page
      title="Keep the conversation here."
      kicker="PRIVATE MESSAGES"
      description="Talk through the details and arrange a safe exchange."
    >
      <WorkspaceNav />
      <div className="messages-layout">
        <aside className="panel conversation-list">
          <h2>Conversations</h2>
          <ErrorBox message={conversations.error} />
          {conversations.loading ? (
            <Loading />
          ) : conversations.data?.length ? (
            conversations.data.map((c) => (
              <NavLink to={"/messages/" + c.id} key={c.id}>
                <MessageCircle size={20} aria-hidden="true" />
                <span>{c.title}</span>
              </NavLink>
            ))
          ) : (
            <p className="help">Contact a reporter to start a conversation.</p>
          )}
        </aside>
        {id ? (
          <Chat key={id} id={id} />
        ) : (
          <div className="panel">
            <Empty title="Choose a conversation">
              Your messages are only available to the people in the
              conversation.
            </Empty>
          </div>
        )}
      </div>
    </Page>
  );
}
function Chat({ id }: { id: string }) {
  const { data, error, loading, reload } = useResource<ChatMessage[]>(
      "/conversations/" + id + "/messages",
    ),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [sendError, setSendError] = useState(""),
    bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [id]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [data?.length]);
  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSendError("");
    try {
      await api(
        "/conversations/" + id + "/messages",
        json("POST", { body: message }),
      );
      setMessage("");
      reload();
    } catch (e) {
      setSendError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel chat">
      <div className="chat-header">
        <ShieldCheck size={19} aria-hidden="true" />
        Private conversation · updates every 8 seconds
      </div>
      <ErrorBox message={error} />
      <div
        className="chat-body"
        aria-live="polite"
        aria-label="Conversation messages"
      >
        {loading && !data ? (
          <Loading />
        ) : data?.length ? (
          data.map((m) => (
            <div
              key={m.id}
              className={"chat-message " + (m.mine ? "mine" : "")}
            >
              <p>{m.body}</p>
              <time dateTime={m.created_at + "Z"}>
                {new Date(m.created_at + "Z").toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
          ))
        ) : (
          !error && (
            <Empty title="Start with a hello">
              Keep private identifying details in this conversation.
            </Empty>
          )
        )}
        <div ref={bottom} />
      </div>
      <form className="chat-compose" onSubmit={send}>
        <label className="sr-only" htmlFor="message-body">
          Your message
        </label>
        <textarea
          id="message-body"
          rows={2}
          maxLength={2000}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write a message…"
        />
        <button
          className="button primary"
          disabled={busy || !message.trim() || !!error}
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </form>
      <ErrorBox message={sendError} />
    </section>
  );
}
function AccountSettings() {
  const { user, setUser } = useApp(),
    { manage } = useConsent(),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    navigate = useNavigate();
  async function save(e: FormEvent<HTMLFormElement>, action: string) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (action === "name") {
        await api("/account", json("PATCH", body));
        setUser({ ...user!, name: body.name as string });
        setSuccess("Account name updated.");
      } else if (action === "password") {
        await api("/account/password", json("POST", body));
        setUser(null);
        navigate("/login");
      } else {
        await api("/account/delete", json("POST", body));
        setUser(null);
        navigate("/");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      title="Account settings"
      description="Your details, security and privacy controls."
    >
      <WorkspaceNav />
      <div className="settings-grid">
        <section className="panel">
          <h2>Your profile</h2>
          <p className="help">{user?.email}</p>
          <form onSubmit={(e) => save(e, "name")}>
            <label>
              Your name
              <input
                name="name"
                required
                minLength={2}
                maxLength={80}
                defaultValue={user?.name}
              />
            </label>
            <button className="button primary" disabled={busy}>
              Save profile
            </button>
          </form>
        </section>
        <section className="panel">
          <h2>Change password</h2>
          <form onSubmit={(e) => save(e, "password")}>
            <label>
              Current password
              <input
                name="current_password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              New password
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
              />
            </label>
            <button className="button secondary" disabled={busy}>
              Update password & sign out
            </button>
          </form>
        </section>
        <section className="panel">
          <h2>Cookie preferences</h2>
          <p>
            Change optional analytics consent at any time. Essential cookies
            keep your account secure.
          </p>
          <button className="button secondary" onClick={manage}>
            Manage preferences
          </button>
        </section>
        <section className="panel">
          <h2>Delete your account</h2>
          <p>
            Your personal profile, reports, photos, authored messages and
            submitted evidence will be removed or anonymized.
          </p>
          <details>
            <summary>Review account deletion</summary>
            <form onSubmit={(e) => save(e, "delete")}>
              <label>
                Confirm current password
                <input
                  name="current_password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <label className="checkbox-label">
                <input type="checkbox" required />I understand that this deletes
                my account.
              </label>
              <button className="button danger" disabled={busy}>
                Delete account permanently
              </button>
            </form>
          </details>
        </section>
      </div>
      <ErrorBox message={error} />
      {success && (
        <div className="success" role="status">
          {success}
        </div>
      )}
    </Page>
  );
}
type AdminData = {
  counts: Record<string, number>;
  pending: Item[];
  abuses: { id: string; report_id: string; title: string; reason: string }[];
  users: { id: string; name: string; role: string; disabled: boolean }[];
};
function Admin() {
  const { data, error, loading, reload } = useResource<AdminData>("/admin"),
    [actionError, setActionError] = useState(""),
    [busy, setBusy] = useState(false);
  const action = async (path: string, body?: unknown) => {
    setBusy(true);
    setActionError("");
    try {
      await api(path, json("PATCH", body || {}));
      reload();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      title="Community moderation"
      description="Review reports, respond to concerns and manage access."
    >
      <WorkspaceNav />
      <ErrorBox message={error || actionError} />
      {loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="dashboard-stats">
              {Object.entries(data.counts).map(([label, value]) => (
                <div key={label}>
                  <span>{label.replaceAll("_", " ")}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <section className="panel">
              <h2>Reports awaiting review</h2>
              {data.pending.length ? (
                data.pending.map((item) => (
                  <div className="review-row" key={item.id}>
                    <div>
                      <h3>
                        <Link to={"/items/" + item.id}>{item.title}</Link>
                      </h3>
                      <p>{item.description}</p>
                      <span>
                        {item.area} · {item.category}
                      </span>
                    </div>
                    <div className="button-row">
                      <button
                        className="button primary small"
                        disabled={busy}
                        onClick={() =>
                          action("/admin/reports/" + item.id, {
                            status: "published",
                          })
                        }
                      >
                        Publish
                      </button>
                      <button
                        className="button secondary small"
                        disabled={busy}
                        onClick={() =>
                          action("/admin/reports/" + item.id, {
                            status: "hidden",
                          })
                        }
                      >
                        Hide
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p>No reports awaiting review.</p>
              )}
            </section>
            <section className="panel">
              <h2>Abuse reports</h2>
              {data.abuses.length ? (
                data.abuses.map((a) => (
                  <div className="review-row" key={a.id}>
                    <div>
                      <Link to={"/items/" + a.report_id}>{a.title}</Link>
                      <p>{a.reason}</p>
                    </div>
                    <div className="button-row">
                      <button
                        className="button secondary small"
                        disabled={busy}
                        onClick={() =>
                          action("/admin/reports/" + a.report_id, {
                            status: "hidden",
                          })
                        }
                      >
                        Hide item
                      </button>
                      <button
                        className="button secondary small"
                        disabled={busy}
                        onClick={() => action("/admin/abuse/" + a.id)}
                      >
                        Resolve concern
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p>No open abuse reports.</p>
              )}
            </section>
            {data.users.length > 0 && (
              <section className="panel">
                <h2>User access</h2>
                {data.users.map((u) => (
                  <form
                    className="user-row"
                    key={u.id}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = new FormData(e.currentTarget);
                      void action("/admin/users/" + u.id, {
                        role: form.get("role"),
                        disabled: form.has("disabled"),
                      });
                    }}
                  >
                    <strong>{u.name}</strong>
                    <label className="sr-only" htmlFor={"role-" + u.id}>
                      Role for {u.name}
                    </label>
                    <select
                      id={"role-" + u.id}
                      name="role"
                      defaultValue={u.role}
                    >
                      <option value="user">User</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Administrator</option>
                    </select>
                    <label className="checkbox-label">
                      <input
                        name="disabled"
                        type="checkbox"
                        defaultChecked={u.disabled}
                      />
                      Suspended
                    </label>
                    <button className="button secondary small" disabled={busy}>
                      Save access
                    </button>
                  </form>
                ))}
              </section>
            )}
          </>
        )
      )}
    </Page>
  );
}
function NotFound() {
  return (
    <div className="not-found container">
      <Compass size={72} aria-hidden="true" />
      <p className="eyebrow">404 · A LITTLE OFF TRACK</p>
      <h1>This page got lost.</h1>
      <p>Let’s get you back to somewhere familiar.</p>
      <div className="button-row">
        <Link className="button primary" to="/">
          Go home
        </Link>
        <Link className="button secondary" to="/browse">
          Browse items
        </Link>
      </div>
    </div>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <ConsentProvider>
          <Shell />
        </ConsentProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
