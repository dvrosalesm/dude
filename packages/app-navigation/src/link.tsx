import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { forwardRef } from "react";
import { useNavigate } from "react-router-dom";

type LinkHref =
  | string
  | {
      pathname?: string;
      query?: Record<string, string | number | boolean | undefined>;
      hash?: string;
    };

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: LinkHref;
  replace?: boolean;
  children?: ReactNode;
}

function hrefToString(href: LinkHref) {
  if (typeof href === "string") return href;
  const pathname = href.pathname ?? "/";
  const query = href.query
    ? new URLSearchParams(
        Object.entries(href.query)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)]),
      ).toString()
    : "";
  const hash = href.hash ? `#${href.hash.replace(/^#/, "")}` : "";
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

function shouldHandleClientNavigation(
  event: MouseEvent<HTMLAnchorElement>,
  href: string,
  target?: string,
) {
  if (event.defaultPrevented) return false;
  if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return false;
  if (target && target !== "_self") return false;
  if (/^[a-z][a-z\d+.-]*:/i.test(href)) return false;
  return href.startsWith("/");
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, replace, onClick, target, children, ...props },
  ref,
) {
  const navigate = useNavigate();
  const resolvedHref = hrefToString(href);

  return (
    <a
      {...props}
      ref={ref}
      href={resolvedHref}
      target={target}
      onClick={(event) => {
        onClick?.(event);
        if (!shouldHandleClientNavigation(event, resolvedHref, target)) return;
        event.preventDefault();
        navigate(resolvedHref, { replace });
      }}
    >
      {children}
    </a>
  );
});

export default Link;
