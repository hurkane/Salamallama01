import { LoaderFunction, json, redirect } from "@remix-run/node";
import { getSession } from "~/sessions";
import { getUserInfo, getChats } from "../utils/api";

export const chatLoader: LoaderFunction = async ({ request }) => {
  console.log("Starting chatLoader");
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("token");
  const userId = session.get("userId");

  console.log("Session data - Token:", token, "UserId:", userId);

  if (!token || !userId) {
    console.log("Token or UserId missing, redirecting to sign-in.");
    return redirect("/sign-in");
  }

  try {
    const userInfo = await getUserInfo(userId, token);
    console.log("UserInfo:", userInfo); // Log user info

    const page = 1;
    const limit = 10; // Adjust the limit as needed
    const { chats, currentPage, totalPages, totalChats } = await getChats(
      userId,
      token,
      page,
      limit
    );
    console.log("Chats:", chats); // Log chats

    // Extract user IDs from chats and filter out the logged-in user's ID
    const userIds = Array.from(
      new Set(
        chats.flatMap((chat) =>
          chat.users.map((user) => user._id).filter((id) => id !== userId)
        )
      )
    );

    console.log("User IDs:", userIds); // Log user IDs

    return json({
      userId,
      token,
      userInfo,
      chats,
      userIds,
      pagination: {
        currentPage,
        totalPages,
        totalChats,
      },
    });
  } catch (error) {
    const errorMessage = error.response
      ? error.response.data.message
      : error.message;
    console.error("Error loading chat data:", errorMessage);
    return json({ error: errorMessage }, { status: 400 });
  }
};
