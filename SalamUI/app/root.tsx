import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useMatches,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import type { LinksFunction, LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import NotFoundPage from "~/routes/404";
import Layout from "~/components/Layout";
import { layoutLoader } from "./Loaders/LayoutLoader";

import "./tailwind.css";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];
export function ErrorBoundary() {
  const error = useRouteError();
  
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return <NotFoundPage />;
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">
            {error.status} {error.statusText}
          </h1>
          <p>{error.data}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
        <p>{error instanceof Error ? error.message : "Unknown error"}</p>
      </div>
    </div>
  );
}

// Loader for the root
export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const path = url.pathname;

  // Skip token validation for sign-in and sign-up pages
  if (
    path === "/sign-in" ||
    path === "/sign-up" ||
    path === "/forgot-password" ||
    path === "/terms" ||
    path === "/privacy" ||
    path === "/404" ||
    path === "/library" ||
    path === "/chats" ||
    path === "/posts" ||
    path === "/reset-password"
  ) {
    return json({});
  }

  return layoutLoader({ request });
};

export default function App() {
  const matches = useMatches();

  const showLayout = !matches.some(
    (match) =>
      ["/sign-in", "/forgot-password", "/reset-password", "/sign-up", "/terms", "/privacy", "/404"].includes(
        match.pathname
      ) ||
      /\/chat\/[^\/]+/.test(match.pathname) ||
      /\/ChatDetails\/[^\/]+/.test(match.pathname) ||
      /\/book\/[^\/]+/.test(match.pathname) ||
            /\/bookread\/[^\/]+/.test(match.pathname)
  );

  const darkMode = true;

  return (
    <html lang="en" className={darkMode ? "dark" : ""}>
      <head>
        <meta charSet="utf-8" />
        {/* Zoom the app to 85% on initial load for mobile */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=0.85, maximum-scale=1.0, user-scalable=no"
        />
        <Meta />
        <Links />
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body className="bg-white dark:bg-gray-950 m-0 p-0">
        {showLayout ? (
          <Layout>
            <Outlet />
          </Layout>
        ) : (
          <Outlet />
        )}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
