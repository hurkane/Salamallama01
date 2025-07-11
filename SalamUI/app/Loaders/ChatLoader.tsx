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
    const userInfoResponse = await getUserInfo(userId, token);
    const page = 1;
    const limit = 10;
    const chatsResponse = await getChats(userId, token, page, limit);
    
    console.log("UserInfo:", userInfoResponse);
    console.log("Chats Response:", chatsResponse);

    // Clean up userInfo - only include serializable fields
    const userInfo = {
      id: userInfoResponse.id || userInfoResponse._id,
      username: userInfoResponse.username,
      name: userInfoResponse.name,
      email: userInfoResponse.email,
      profilePicture: userInfoResponse.profilePicture,
      // Add other fields you need but avoid __v, functions, etc.
    };

    // Clean up chats data - this is the critical part
    const chats = chatsResponse.chats.map(chat => ({
      id: chat._id || chat.id,
      chatName: chat.chatName,
      isGroupChat: chat.isGroupChat,
      // Properly serialize the users array
      users: Array.isArray(chat.users) ? chat.users.map(user => ({
        _id: user._id || user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        // Don't include __v, functions, or other Mongoose properties
      })) : [],
      groupAdmins: Array.isArray(chat.groupAdmins) ? chat.groupAdmins.map(admin => ({
        _id: admin._id || admin.id,
        username: admin.username,
        name: admin.name,
        // Only include serializable admin fields
      })) : [],
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      // Properly serialize the latestMessage object
      latestMessage: chat.latestMessage ? {
        id: chat.latestMessage._id || chat.latestMessage.id,
        content: chat.latestMessage.content,
        senderId: chat.latestMessage.senderId,
        chatId: chat.latestMessage.chatId,
        createdAt: chat.latestMessage.createdAt,
        // Include other message fields you need
      } : null,
      // Don't include __v or other Mongoose properties
    }));

    // Extract user IDs from the cleaned chats data
    const userIds = Array.from(
      new Set(
        chats.flatMap((chat) =>
          chat.users.map((user) => user._id).filter((id) => id !== userId)
        )
      )
    );

    console.log("Cleaned chats:", chats);
    console.log("User IDs:", userIds);

    return json({
      userId,
      token,
      userInfo,
      chats,
      userIds,
      pagination: {
        currentPage: chatsResponse.currentPage,
        totalPages: chatsResponse.totalPages,
        totalChats: chatsResponse.totalChats,
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
