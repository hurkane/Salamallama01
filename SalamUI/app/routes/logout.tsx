import { ActionFunction, redirect } from "@remix-run/node";
import { destroySession, getSession } from "~/sessions";

export let action: ActionFunction = async ({ request }) => {
  let session = await getSession(request.headers.get("Cookie"));

  return redirect("/sign-in", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
};

export default function Logout() {
  return null;
}
