// loaders/SearchResultsLoader.js
import { json } from "@remix-run/node";
import { getSession } from "~/sessions";

export const loader = async ({ request }) => {
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("token");

  if (!token) {
    throw new Response("Not Found", { status: 404 });
  }

  return json({ token });
};
