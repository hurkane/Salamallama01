// app/Loaders/LayoutLoader.ts
import { LoaderFunction, json, redirect } from "@remix-run/node";
import { getSession } from "~/sessions";
import { getUserInfo } from "../utils/api";

export const layoutLoader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const path = url.pathname;

  // Skip token validation for sign-in and sign-up pages
  if (path === "/sign-in" || path === "/sign-up") {
    return json({});
  }

  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("token");
  const userId = session.get("userId");

  if (!token || !userId) {
    // Redirect to the sign-in page if there is no token
    return redirect("/sign-in");
  }

  try {
    const userInfo = await getUserInfo(userId, token);
    const username = userInfo.username;
    const name = userInfo.name;
    const profilePicture =
      userInfo.profilePicture || "/default_profile_pic.png";

    return json({ userId, username, name, profilePicture, token });
  } catch (error) {
    // Handle errors such as 401 Unauthorized
    if (error.response && error.response.status === 401) {
      return redirect("/sign-in");
    }
    // Other error handling can be added here if needed
    throw error;
  }
};
