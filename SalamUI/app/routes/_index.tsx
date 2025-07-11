// app/routes/_index.tsx
import { LoaderFunction, redirect } from "@remix-run/node";
import Cookies from "js-cookie";
import axios from "axios";
import { API_BASE_URL } from "~/utils/api";

export let loader: LoaderFunction = async ({ request }) => {
  const cookie = request.headers.get("Cookie");
  const token = cookie ? Cookies.get("token") : null;

  if (token) {
    try {
      // Verify the token with your backend
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/verify-token`,
        { token }
      );

      if (response.status === 200) {
        return redirect("/home");
      }
    } catch (error) {
      // Token validation failed
    }
  }

  return redirect("/sign-in");
};

export default function Index() {
  return null;
}
