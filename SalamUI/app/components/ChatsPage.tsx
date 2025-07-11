import React, { useState, useEffect, useRef } from "react";
import { useLoaderData, Link, useNavigate } from "@remix-run/react";
import { LoaderData } from "~/types";
import { getUserInfo, API_BASE_URL, getChats } from "~/utils/api";
import io from "socket.io-client";
const ENDPOINT = API_BASE_URL.replace(/^http/, "ws");

let socket;

export default function ChatsPage() {
  const data = useLoaderData<LoaderData>();

  const [fetchError, setFetchError] = useState("");
  const [unreadCounts, setUnreadCounts] = useState({});
  const [chats, setChats] = useState([]);
  const [usernames, setUsernames] = useState({});
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastChatElementRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");

  console.log("Loader Data:", data);

  const { userId, token, userInfo } = data;

  useEffect(() => {
    const fetchInitialChats = async () => {
      try {
        const {
          chats: initialChats,
          currentPage,
          totalPages,
        } = await getChats(userId, token, 1);
        setChats(initialChats);
        setPage(currentPage + 1);
        setHasMore(currentPage < totalPages);
      } catch (error) {
        console.error("Error fetching initial chats:", error);
      }
    };

    fetchInitialChats();
  }, [userId, token]);

  useEffect(() => {
    console.log("Connecting to Socket.io...");
    socket = io(ENDPOINT);

    socket.on("connect", () => {
      console.log("Socket.io connected!");
    });

    socket.emit("setup", { _id: userId });
    console.log("Socket setup emitted for user:", userId);
    socket.on("connected", () => console.log("Socket connected"));
    socket.emit("join chat", userId);

    socket.on("user online", (userId) => {
      setOnlineUsers((prevOnlineUsers) => [...prevOnlineUsers, userId]);
    });

    socket.on("user offline", (userId) => {
      setOnlineUsers((prevOnlineUsers) =>
        prevOnlineUsers.filter((id) => id !== userId)
      );
    });

    socket.on("unread messages", (unreadMessages) => {
      console.log("Received unread messages for all chats:", unreadMessages);
      const counts = {};
      unreadMessages.forEach((msg) => {
        counts[msg.chat] = (counts[msg.chat] || 0) + 1;
      });
      console.log("Unread counts for all chats:", counts);
      setUnreadCounts(counts);
    });

    socket.on("message received", async (newMessage) => {
      console.log("New message received:", newMessage);
      if (newMessage.chat._id) {
        setUnreadCounts((prev) => ({
          ...prev,
          [newMessage.chat._id]: (prev[newMessage.chat._id] || 0) + 1,
        }));

        const senderInfo = await getUserInfo(newMessage.sender, token);
        setUsernames((prev) => ({
          ...prev,
          [newMessage.sender]: senderInfo.username,
        }));

        setChats((prevChats) =>
          prevChats.map((chat) =>
            chat._id === newMessage.chat._id
              ? { ...chat, latestMessage: newMessage }
              : chat
          )
        );
      }
    });

    socket.on("unread messages for chat", ({ chatId, unreadMessages }) => {
      console.log(
        `Received unread messages for chat ${chatId}:`,
        unreadMessages
      );
      setUnreadCounts((prev) => ({
        ...prev,
        [chatId]: unreadMessages.length,
      }));
      console.log("Unread counts for specific chat:", unreadCounts);
    });

    return () => {
      console.log("Disconnecting from Socket.io...");
      socket.disconnect();
    };
  }, [userId, token]);

  const getChatTitle = (chat) => {
    if (chat.isGroupChat) {
      return chat.chatName;
    } else {
      const chatParticipant = chat.users.find((user) => user._id !== userId);
      return chatParticipant?.username || "Chat";
    }
  };

  const getChatPhoto = (chat) => {
    if (!chat || !chat.users || chat.users.length === 0) {
      return null;
    }

    if (chat.isGroupChat) {
      const pictures = chat.users.map(
        (user) => user.profilePicture || "/default_profile_pic.png"
      );
      if (pictures.length === 1) {
        return (
          <div className="relative">
            <img
              src={pictures[0]}
              alt="Chat Profile"
              className="w-12 h-12 rounded-full"
            />
            {isUserOnline(chat.users[0]?._id) && (
              <span className="w-2 h-2 bg-green-500 rounded-full absolute bottom-1 right-1"></span>
            )}
          </div>
        );
      }
      return (
        <div className="relative w-12 h-12">
          <img
            src={pictures[0]}
            alt="Chat Profile"
            className="absolute top-0 left-0 w-8 h-8 rounded-full"
          />
          {isUserOnline(chat.users[0]?._id) && (
            <span className="w-2 h-2 bg-green-500 rounded-full absolute top-0 right-1"></span>
          )}
          <img
            src={pictures[1]}
            alt="Chat Profile"
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full"
          />
          {isUserOnline(chat.users[1]?._id) && (
            <span className="w-2 h-2 bg-green-500 rounded-full absolute bottom-0 right-1"></span>
          )}
        </div>
      );
    } else {
      const chatParticipant = chat.users.find((user) => user._id !== userId);
      if (!chatParticipant) return null;
      const picture =
        chatParticipant.profilePicture || "/default_profile_pic.png";
      return (
        <div className="relative">
          <img
            src={picture}
            alt="Chat Profile"
            className="w-12 h-12 rounded-full"
          />
          {isUserOnline(chatParticipant._id) && (
            <span className="w-2 h-2 bg-green-500 rounded-full absolute bottom-1 right-1"></span>
          )}
        </div>
      );
    }
  };
  const filteredChats = chats.filter((chat) => {
    const chatUser = chat.users?.find((user) => user._id !== userId);
    const chatName = chat.isGroupChat
      ? chat.chatName
      : chatUser?.username || "Chat";
    return chatName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const isUserOnline = (userId) => onlineUsers.includes(userId);

  const loadMoreChats = async () => {
    setLoading(true);
    try {
      const {
        chats: newChats,
        currentPage,
        totalPages,
      } = await getChats(userId, token, page);
      setChats((prevChats) => [...prevChats, ...newChats]);
      setPage((prevPage) => currentPage + 1);
      setHasMore(currentPage < totalPages);
    } catch (error) {
      console.error("Error loading more chats:", error);
    } finally {
      setLoading(false);
    }
  };

return (
  <div className="flex flex-col items-center justify-start min-h-screen text-white px-0.5 py-3 lg:p-3 pt-16 lg:pt-6 relative">
        {/* Back Button */}
    <div className="w-full max-w-4xl mb-4 relative z-10">
      <button
        className="flex items-center space-x-2 px-4 py-2 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 text-gray-300 hover:text-white hover:bg-white/20 transition-all duration-200"
        onClick={() => window.history.back()}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <path d="M15 18l-6-6 6-6"></path>
        </svg>
        <span>Back</span>
      </button>
    </div>
    <div className="w-full max-w-4xl relative z-10">
      {/* Chat Rooms Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6 shadow-lg mb-6">
        <h2 className="text-2xl font-semibold text-white flex items-center space-x-2">
          <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span>Chat Rooms</span>
        </h2>
        <p className="text-gray-300 text-sm mt-1">Connect with friends and communities</p>
        
        {fetchError && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-red-300">{fetchError}</p>
          </div>
        )}
        
        <Link
          to="/newchat"
          className="mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-3 rounded-xl w-full block text-center font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>New Chat</span>
        </Link>
      </div>

      {/* Search Section */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6 shadow-lg mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 pl-10 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200"
          />
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Your Chats Section */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg overflow-hidden">
        <div className="p-6 border-b border-white/20">
          <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
            <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-2-2V10a2 2 0 012-2h2m2-4h6a2 2 0 012 2v6a2 2 0 01-2 2h-6l-4 4V8a2 2 0 012-2z" />
            </svg>
            <span>Your Chats</span>
          </h2>
        </div>
        
        <div className="p-6 space-y-3">
          {filteredChats.map((chat, index) => (
            <Link
              key={chat._id}
              to={`/chat/${chat._id}`}
              className="block bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4 hover:bg-white/20 transition-all duration-200 shadow-lg hover:shadow-xl"
              ref={index === chats.length - 1 ? lastChatElementRef : null}
            >
              <div className="flex items-center space-x-4">
                <div className="relative">
                  {getChatPhoto(chat)}
                  {chat.latestMessage && isUserOnline(chat.latestMessage.sender) && (
                    <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white/20"></span>
                  )}
                </div>
                <div className="flex-grow max-w-full overflow-hidden">
                  <h3 className="text-lg font-semibold truncate text-white">
                    {getChatTitle(chat)}
                  </h3>
                  <p className="text-gray-300 break-words whitespace-pre-wrap max-w-full truncate">
                    {chat.latestMessage
                      ? `${
                          usernames[chat.latestMessage.sender] ||
                          chat.latestMessage.sender
                        }: ${chat.latestMessage.content.substring(0, 20)}${
                          chat.latestMessage.content.length > 20 ? "..." : ""
                        }`
                      : "No messages yet"}
                  </p>
                </div>
                {unreadCounts[chat._id] > 0 && (
                  <span className="bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-full text-xs px-2 py-1 font-medium shadow-lg">
                    {unreadCounts[chat._id]}
                  </span>
                )}
              </div>
            </Link>
          ))}
          
          {loading && (
            <div className="text-center py-4">
              <div className="inline-flex items-center space-x-2">
                <div className="w-4 h-4 bg-indigo-500 rounded-full animate-pulse"></div>
                <span className="text-gray-300">Loading...</span>
              </div>
            </div>
          )}
          
          {hasMore && !loading && (
            <button
              onClick={loadMoreChats}
              className="w-full p-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl text-white font-semibold transition-all duration-200 shadow-lg flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <span>Load More</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom spacing for mobile navigation */}
      <div className="h-24 lg:h-8"></div>
    </div>
  </div>
);
}
