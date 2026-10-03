export type User = {
  id: string;
  name: string;
  email: string;
  role: "user" | "moderator" | "admin";
  csrf: string;
};
export type Item = {
  id: string;
  kind: "lost" | "found";
  title: string;
  description: string;
  category: string;
  color: string;
  brand: string;
  area: string;
  latitude: number | null;
  longitude: number | null;
  event_date: string;
  status: string;
  review_status: string;
  embedding_status: string;
  photos: string[];
  is_owner?: boolean;
  score?: number;
  reasons?: string[];
};
export type Config = {
  categories: string[];
  turnstile_site_key: string;
  bot_bypass: boolean;
  operator_name: string;
  contact_email: string;
  retention_days: number;
  analytics_script_url: string;
  analytics_domain: string;
  analytics_provider: string;
  social_profile_url: string;
  public_origin: string;
};
export type Claim = {
  id: string;
  report: Item;
  status: string;
  evidence: string;
  decision_note: string;
  can_decide: boolean;
};
export type Notice = {
  id: string;
  text: string;
  href: string;
  read: boolean;
  kind: string;
};
export type Conversation = { id: string; title: string; report_id: string };
export type ChatMessage = {
  id: string;
  body: string;
  mine: boolean;
  created_at: string;
};
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}
