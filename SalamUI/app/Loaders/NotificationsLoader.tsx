import { LoaderFunction, json } from "@remix-run/node";
import { getSession } from "~/sessions";
import {
  getUserInfo,
  getNotifications,
  getUnseenNotifications,
} from "../utils/api";

export const loader: LoaderFunction = async ({ request, params }) => {
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("token");
  const userId = session.get("userId");

  if (!userId || !token) {
    throw new Response("Not Found", { status: 404 });
  }

  try {
    const [unseenResponse, seenResponse] = await Promise.all([
      getUnseenNotifications(userId, token, 20, 0),
      getNotifications(userId, token, 20, 0),
    ]);

    return json({
      userId,
      token,
      unseenNotifications: unseenResponse.notifications,
      totalUnseenCount: unseenResponse.totalCount,
      seenNotifications: seenResponse.notifications,
      totalSeenCount: seenResponse.totalCount,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    throw new Response("Failed to fetch notifications", { status: 500 });
  }
};
