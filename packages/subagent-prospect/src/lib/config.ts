export interface LandingPageField {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "number" | "textarea" | "select";
  placeholder?: string;
  required: boolean;
  options?: string[];
}

export interface LandingPage {
  id: string;
  title: string;
  description: string;
  html: string;
  fields: LandingPageField[];
  styles: string;
  published: boolean;
  /** Plain-text asset attributions shown in the internal preview workflow. */
  attributions?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  landingPageId: string;
  data: Record<string, string>;
  createdAt: string;
  source?: string;
}
