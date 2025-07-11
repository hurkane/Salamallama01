import { LoaderFunction, json } from "@remix-run/node";
import {
  getUserPosts,
  getUserInfo,
  getFollowStatus,
  getFollowers,
  getFollowing,
} from "../utils/api";
import { getSession } from "~/sessions";

export const loader: LoaderFunction = async ({ request, params }) => {
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("token");
  const loggedInUserId = session.get("userId");
  const { userId } = params;

  if (!userId || !token || !loggedInUserId) {
    throw new Response("Not Found", { status: 404 });
  }

  console.log(
    `Fetching data for userId: ${userId} and loggedInUserId: ${loggedInUserId}`
  );

  const userInfo = await getUserInfo(userId, token);
  let isFollowing = { status: null, id: null };

  if (loggedInUserId !== userId) {
    isFollowing = await getFollowStatus(loggedInUserId, userId, token);
  }

  const followers = await getFollowers(userId, token);
  const following = await getFollowing(userId, token);

  console.log(`User Info: ${JSON.stringify(userInfo)}`);
  console.log(`Follow Status: ${JSON.stringify(isFollowing)}`);

  return json({
    token,
    userId,
    loggedInUserId,
    userInfo,
    isFollowing,
    followers,
    following,
  });
};
