import { useNavigate, useParams, useLocation, useSearchParams } from "react-router-dom";

/** Next.js `useRouter`-compatible helper for the Vite + React Router client. */
export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (path: string) => navigate(path),
    replace: (path: string) => navigate(path, { replace: true }),
    back: () => navigate(-1),
    forward: () => navigate(1),
    refresh: () => navigate(0),
    prefetch: async () => undefined,
  };
}

export { useParams, useLocation, useSearchParams };
