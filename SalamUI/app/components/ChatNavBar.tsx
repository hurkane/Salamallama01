// Updated ChatNavBar Component with Mobile-Only Toggle
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL, getChats, getUserInfo } from "~/utils/api";
import io from "socket.io-client";

const ENDPOINT = API_BASE_URL.replace(/^http/, "ws");

const ChatNavBar = ({ userId, token, isCollapsed, toggleNav }) => {
  const [chats, setChats] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [usernames, setUsernames] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [unreadCounts, setUnreadCounts] = useState({});
  const [isMobile, setIsMobile] = useState(false);

  const lastChatElementRef = useRef(null);
  let socket;

  // Check if screen is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const fetchInitialChats = async () => {
      try {
        console.log("Fetching initial chats for user:", userId);
        const {
          chats: initialChats,
          currentPage,
          totalPages,
        } = await getChats(userId, token, 1);
        console.log("Initial chats fetched:", initialChats);
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
    if (!token) {
      console.log("Token is missing, socket not initialized.");
      return;
    }

    console.log("Connecting to Socket.io...");
    socket = io(ENDPOINT, { auth: { token } });
    socket.on("connect", () => {
      console.log("Socket.io connected!");
      socket.emit("setup", { _id: userId });
    });

    console.log("Setting up socket listeners...");

    socket.on("user online", (userId) => {
      console.log("User online:", userId);
      setOnlineUsers((prevOnlineUsers) => [...prevOnlineUsers, userId]);
    });

    socket.on("user offline", (userId) => {
      console.log("User offline:", userId);
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
      console.log("Unread counts updated:", counts);
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

        setChats((prevChats) => {
          const updatedChats = prevChats.map((chat) =>
            chat._id === newMessage.chat._id
              ? { ...chat, latestMessage: newMessage }
              : chat
          );

          const chatExists = prevChats.some(
            (chat) => chat._id === newMessage.chat._id
          );

          if (!chatExists) {
            updatedChats.push({
              ...newMessage.chat,
              latestMessage: newMessage,
            });
          }

          console.log("Updated chats:", updatedChats);
          return updatedChats;
        });
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
  }, [token, userId]);

  const isUserOnline = (userId) => onlineUsers.includes(userId);

  const getChatPhoto = (chat, isSmall = false) => {
    if (!chat || !chat.users || chat.users.length === 0) {
      return null;
    }

    const size = isSmall ? "w-10 h-10" : "w-12 h-12";
    const borderSize = isSmall ? "border border-white/20" : "border-2 border-white/20";
    const onlineIndicatorSize = isSmall ? "w-2 h-2" : "w-3 h-3";
    const onlineIndicatorBorder = isSmall ? "border border-white" : "border-2 border-white";

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
              className={`${size} rounded-full ${borderSize}`}
            />
            {isUserOnline(chat.users[0]?._id) && (
              <span className={`${onlineIndicatorSize} bg-green-400 rounded-full absolute -bottom-1 -right-1 ${onlineIndicatorBorder}`}></span>
            )}
          </div>
        );
      }
      const groupSize = isSmall ? "w-10 h-10" : "w-12 h-12";
      const imgSize = isSmall ? "w-6 h-6" : "w-8 h-8";
      const smallIndicatorSize = isSmall ? "w-1.5 h-1.5" : "w-2 h-2";
      const smallIndicatorBorder = isSmall ? "border border-white" : "border border-white";
      
      return (
        <div className={`relative ${groupSize}`}>
          <img
            src={pictures[0]}
            alt="Chat Profile"
            className={`absolute top-0 left-0 ${imgSize} rounded-full border border-white/20`}
          />
          {isUserOnline(chat.users[0]?._id) && (
            <span className={`${smallIndicatorSize} bg-green-400 rounded-full absolute top-0 right-1 ${smallIndicatorBorder}`}></span>
          )}
          <img
            src={pictures[1]}
            alt="Chat Profile"
            className={`absolute bottom-0 right-0 ${imgSize} rounded-full border border-white/20`}
          />
          {isUserOnline(chat.users[1]?._id) && (
            <span className={`${smallIndicatorSize} bg-green-400 rounded-full absolute bottom-0 right-1 ${smallIndicatorBorder}`}></span>
          )}
        </div>
      );
    } else {
      const chatParticipant = chat.users?.find((user) => user._id !== userId);
      if (!chatParticipant) return null;
      const picture =
        chatParticipant.profilePicture || "/default_profile_pic.png";
      return (
        <div className="relative">
          <img
            src={picture}
            alt="Chat Profile"
            className={`${size} rounded-full ${borderSize}`}
          />
          {isUserOnline(chatParticipant._id) && (
            <span className={`${onlineIndicatorSize} bg-green-400 rounded-full absolute -bottom-1 -right-1 ${onlineIndicatorBorder}`}></span>
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

  // Determine if we should show collapsed state based on mobile and collapse state
  const shouldShowCollapsed = isMobile && isCollapsed;

  return (
    <div className="relative h-full">
      {/* Toggle Button - Only show on mobile */}
      {isMobile && (
        <button
          onClick={toggleNav}
          className={`absolute top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-full shadow-lg transition-all duration-200 z-10 flex items-center justify-center ${
            isCollapsed ? "-left-3 w-8 h-8" : "-left-4 w-10 h-10"
          }`}
        >
          <svg
            className={`transition-transform duration-200 ${
              isCollapsed ? "rotate-180 w-4 h-4" : "w-5 h-5"
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      )}

      {/* Main Content Container */}
      <div
        className={`h-full bg-white/10 backdrop-blur-lg border-l border-white/20 text-white overflow-y-auto transition-all duration-300 flex flex-col items-center ${
          shouldShowCollapsed ? "w-12" : "w-80"
        }`}
      >
        {/* Expanded State - Always show on desktop, show on mobile when not collapsed */}
        {!shouldShowCollapsed && (
          <div className="p-4 h-full w-full max-w-sm">
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2 flex items-center justify-center space-x-2">
                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>Messages</span>
              </h2>
              <p className="text-gray-300 text-sm text-center">Stay connected with your friends</p>
            </div>

            {/* New Chat Button */}
            <Link
              to="/newchat"
              className="flex items-center justify-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white p-3 rounded-xl w-full mb-6 transition-all duration-200 shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="font-medium">New Chat</span>
            </Link>

            {/* Search Bar */}
            <div className="relative mb-6">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search chats..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
              />
            </div>

            {/* Chat List */}
            <div className="chat-list space-y-2 flex-1 overflow-y-auto">
              {filteredChats.map((chat, index) => (
                <Link
                  key={chat._id}
                  to={`/chat/${chat._id}`}
                  className="block bg-white/5 backdrop-blur-sm hover:bg-white/10 rounded-xl p-4 transition-all duration-200 border border-white/10 hover:border-white/20 relative group"
                  ref={
                    index === filteredChats.length - 1 ? lastChatElementRef : null
                  }
                >
                  <div className="flex items-center space-x-3">
                    {getChatPhoto(chat)}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">
                        {chat.isGroupChat
                          ? chat.chatName
                          : usernames[
                              chat.users?.find((user) => user._id !== userId)
                                ?.username
                            ] ||
                            chat.users?.find((user) => user._id !== userId)
                              ?.username ||
                            "Chat"}
                      </h3>
                      <p className="text-gray-300 text-sm truncate mt-1">
                        {chat.latestMessage
                          ? `${
                              usernames[chat.latestMessage.sender] ||
                              chat.latestMessage.sender
                            }: ${chat.latestMessage.content.substring(0, 25)}${
                              chat.latestMessage.content.length > 25 ? "..." : ""
                            }`
                          : "No messages yet"}
                      </p>
                    </div>
                    {unreadCounts[chat._id] > 0 && (
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center justify-center h-6 w-6 bg-red-500 text-white text-xs font-bold rounded-full">
                          {unreadCounts[chat._id]}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}

              {loading && (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-400"></div>
                </div>
              )}
              
              {hasMore && !loading && (
                <button
                  onClick={() => setPage((prevPage) => prevPage + 1)}
                  className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-white font-medium mt-4 transition-all duration-200 border border-white/10 hover:border-white/20"
                >
                  Load More
                </button>
              )}
            </div>
          </div>
        )}

        {/* Collapsed State - Only show on mobile when collapsed */}
        {shouldShowCollapsed && (
          <div className="w-full h-full flex flex-col items-center justify-start pt-16 space-y-2">
            <Link
              to="/newchat"
              className="p-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg transition-all duration-200 shadow-lg flex items-center justify-center"
              title="New Chat"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </Link>
            <div className="w-6 border-t border-white/20"></div>
            <div className="flex flex-col items-center space-y-1">
              {filteredChats.slice(0, 8).map((chat) => (
                <Link
                  key={chat._id}
                  to={`/chat/${chat._id}`}
                  className="p-1 hover:bg-white/10 rounded-md transition-all duration-200 flex items-center justify-center"
                  title={chat.isGroupChat ? chat.chatName : chat.users?.find((user) => user._id !== userId)?.username || "Chat"}
                >
                  {getChatPhoto(chat, true)}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatNavBar;