import React, { useState, useEffect, useRef } from "react";
import { useLoaderData, Link, useNavigate } from "@remix-run/react";

import { LoaderData } from "~/types";
import {
  createGroupChat,
  searchUsersByKeyword,
  createOneToOneChat,
  getUserInfo,
  API_BASE_URL,
  getChats,
} from "~/utils/api";
import io from "socket.io-client";
const ENDPOINT = API_BASE_URL.replace(/^http/, "ws");

let socket;

export default function ChatsPage() {
  const data = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [fetchError, setFetchError] = useState("");
  const [creating, setCreating] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [chats, setChats] = useState([]);
  const [usernames, setUsernames] = useState({});
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [page, setPage] = useState(1);

  const [hasMore, setHasMore] = useState(true);

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

  const handleSearchChange = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.length >= 2) {
      try {
        const results = await searchUsersByKeyword(query, 1, 10, token);
        setSearchResults(results.users);
      } catch (error) {
        console.error("Error searching users:", error);
        setFetchError("Error searching users.");
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectUser = (user) => {
    // Check if the user is already selected
    if (selectedUsers.some((selected) => selected._id === user.id)) {
      setFetchError("User is already selected.");
      return;
    }

    const selectedUser = { _id: user.id, ...user };
    setSelectedUsers([...selectedUsers, selectedUser]);
    setSearchQuery("");
    setSearchResults([]);
    setFetchError(""); // Clear any previous error message
  };

  const handleRemoveUser = (userId) => {
    setSelectedUsers(selectedUsers.filter((user) => user._id !== userId));
  };

  const handleCreateChat = async (e) => {
    e.preventDefault();
    setCreating(true);
    setFetchError("");
    console.log("handleCreateChat initiated");
    console.log("Selected users:", selectedUsers);
    console.log("Group name:", groupName);

    try {
      let chat;
      if (selectedUsers.length === 1) {
        chat = await createOneToOneChat(selectedUsers[0]._id, token);
        console.log("Created one-on-one chat:", chat);
      } else if (selectedUsers.length > 1) {
        const userIds = selectedUsers.map((user) => user._id);
        const chatName =
          groupName ||
          `${userInfo.username}, ${selectedUsers
            .map((user) => user.username)
            .join(", ")}`;
        console.log("Creating group chat with users:", userIds);

        chat = await createGroupChat({
          name: chatName,
          users: userIds, // Ensure user IDs are correctly formatted
          token,
        });
        console.log("Group chat response:", chat);
      }

      if (chat && chat._id) {
        console.log("Chat successfully created:", chat);
        setChats((prevChats) => [...prevChats, chat]);
        navigate(`/chat/${chat._id}`);
      } else {
        console.error(
          "Chat creation returned no chat object or invalid response."
        );
        setFetchError("Chat creation failed. Please try again.");
      }
      setGroupName("");
      setSelectedUsers([]);
    } catch (error) {
      setFetchError("Failed to create chat.");
      console.error(
        "Error creating chat:",
        error.response ? error.response.data : error.message
      );
    } finally {
      setCreating(false);
    }
  };

  const isUserOnline = (userId) => onlineUsers.includes(userId);

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

    {/* Main Content */}
    <div className="w-full max-w-4xl relative z-10">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg p-6">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
            Create a New Chat
          </h2>
          <p className="text-gray-400">Start a conversation with your friends</p>
        </div>

        {/* Error Message */}
        {fetchError && (
          <div className="mb-6 bg-red-500/20 backdrop-blur-lg rounded-xl border border-red-500/30 p-4">
            <p className="text-red-300">{fetchError}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleCreateChat} className="space-y-6">
          {/* Group Name Input */}
          {selectedUsers.length > 1 && (
            <div>
              <label htmlFor="groupName" className="block text-gray-300 mb-2 font-medium">
                Group Chat Name
              </label>
              <input
                type="text"
                id="groupName"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full p-3 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                placeholder="Enter group name..."
              />
            </div>
          )}

          {/* User Search */}
          <div className="relative">
            <label htmlFor="userSearch" className="block text-gray-300 mb-2 font-medium">
              Add Users
            </label>
            <input
              type="text"
              id="userSearch"
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full p-3 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
              placeholder="Type a username..."
            />
            
            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <ul className="absolute bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl mt-2 max-h-48 w-full overflow-auto z-20 shadow-lg">
                {searchResults.map((user) => (
                  <li
                    key={user.id}
                    className="p-3 hover:bg-white/20 cursor-pointer flex items-center transition-all duration-200 first:rounded-t-xl last:rounded-b-xl"
                    onClick={() => handleSelectUser(user)}
                  >
                    <img
                      src={user.profilePicture || "/default_profile_pic.png"}
                      alt={user.username}
                      className="w-10 h-10 rounded-full mr-3 object-cover border border-white/20"
                    />
                    <div className="flex-1">
                      <p className="text-white font-medium">{user.username}</p>
                      <p className="text-gray-400 text-sm">@{user.username}</p>
                    </div>
                    {isUserOnline(user.id) && (
                      <span className="w-3 h-3 bg-green-500 rounded-full ml-2 border border-white/20"></span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div>
              <p className="text-gray-300 mb-3 font-medium">Selected Users ({selectedUsers.length})</p>
              <div className="flex flex-wrap gap-3">
                {selectedUsers.map((user) => (
                  <div
                    key={user._id}
                    className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-3 flex items-center space-x-3 hover:bg-white/20 transition-all duration-200"
                  >
                    <img
                      src={user.profilePicture || "/default_profile_pic.png"}
                      alt={user.username}
                      className="w-8 h-8 rounded-full object-cover border border-white/20"
                    />
                    <span className="text-white font-medium">{user.username}</span>
                    <button
                      type="button"
                      className="ml-2 text-red-400 hover:text-red-300 transition-colors duration-200 font-bold text-lg"
                      onClick={() => handleRemoveUser(user._id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full p-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-500 hover:to-purple-500 transition-all duration-200 shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={creating || selectedUsers.length === 0}
          >
            {creating ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Creating...</span>
              </div>
            ) : (
              "Create Chat"
            )}
          </button>
        </form>
      </div>
    </div>

    {/* Bottom spacing */}
    <div className="h-24 lg:h-8"></div>
  </div>
);
}
