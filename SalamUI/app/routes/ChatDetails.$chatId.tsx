import { json, redirect } from "@remix-run/node";
import { getSession } from "~/sessions";
import { API_BASE_URL, getChatById } from "~/utils/api";

export const loader = async ({ request, params }) => {
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("token");
  const userId = session.get("userId");
  const { chatId } = params;

  if (!token || !userId || !chatId) {
    return redirect("/sign-in");
  }

  try {
    const chat = await getChatById(chatId, token);
    return json({ userId, chat, token });
  } catch (error) {
    console.error("Error loading chat data:", error);
    return json({ error: error.message }, { status: 404 });
  }
};

import React, { useState, useEffect } from "react";
import { useLoaderData, Link, useNavigate } from "@remix-run/react";
import { LoaderData } from "~/types";
import {
  renameGroupChat,
  addToGroupChat,
  removeFromGroupChat,
  searchUsersByKeyword,
  getUserInfo,
  addAdminToGroupChat,
} from "~/utils/api";
import io from "socket.io-client";

const ENDPOINT = API_BASE_URL.replace(/^http/, "ws");

let socket;

export default function ChatDetails() {
  const { userId, chat, token } = useLoaderData<LoaderData>();
  const navigate = useNavigate();

  const [groupChatName, setGroupChatName] = useState(chat.chatName);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [fetchError, setFetchError] = useState("");
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);

  const fetchUserDetails = async () => {
    const userDetailPromises = chat.users.map((userId) =>
      getUserInfo(userId, token)
    );

    try {
      const userDetails = await Promise.all(userDetailPromises);
      setUsers(userDetails);
    } catch (error) {
      console.error("Error fetching user details:", error);
    }
  };

  useEffect(() => {
    fetchUserDetails();

    // Initialize Socket.io
    socket = io(ENDPOINT);
    socket.emit("setup", { _id: userId });
    socket.on("connected", () => setSocketConnected(true));
    socket.emit("join chat", chat._id);

    // Listen for online users
    socket.on("user online", (userId) => {
      setOnlineUsers((prevOnlineUsers) => [...prevOnlineUsers, userId]);
    });
    socket.on("user offline", (userId) => {
      setOnlineUsers((prevOnlineUsers) =>
        prevOnlineUsers.filter((id) => id !== userId)
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [chat._id, userId, token]);

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

  const handleAddUser = async (userId) => {
    try {
      const updatedChat = await addToGroupChat(chat._id, userId, token);
      chat.users = updatedChat.users;
      await fetchUserDetails(); // Refetch user details
      setSearchQuery("");
      setSearchResults([]);
    } catch (error) {
      console.error("Error adding user to group:", error);
    }
  };

  const handleRemoveUser = async (userId) => {
    try {
      const updatedChat = await removeFromGroupChat(chat._id, userId, token);
      chat.users = updatedChat.users;
      await fetchUserDetails(); // Refetch user details
    } catch (error) {
      console.error("Error removing user from group:", error);
    }
  };

  const handleRenameGroup = async (e) => {
    e.preventDefault();
    try {
      const updatedChat = await renameGroupChat(chat._id, groupChatName, token);
      setGroupChatName(updatedChat.chatName);
      navigate(`/chat/${chat._id}`); // Navigate back to chat page after renaming
    } catch (error) {
      console.error("Error renaming group:", error);
    }
  };

  const handleAddAdmin = async (userId) => {
    try {
      const updatedChat = await addAdminToGroupChat(chat._id, userId, token);
      chat.groupAdmins = updatedChat.groupAdmins;
      await fetchUserDetails(); // Refetch user details
    } catch (error) {
      console.error("Error adding admin to group:", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen text-white p-4 pt-20 lg:pt-8 relative">
      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/10 backdrop-blur-lg border-b border-white/20 shadow-lg">
        <div className="flex items-center justify-between w-full p-4 max-w-4xl mx-auto">
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
          <h1 className="text-lg font-semibold text-center flex-grow"> Chat Details</h1>
          <div className="w-16"></div> {/* Spacer for centering */}
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-4xl mt-8 relative z-10">
        {/* Rename Group Section */}
        {chat.groupAdmins.includes(userId) && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6 shadow-lg mb-8">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <svg className="w-6 h-6 mr-2 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Rename Group
            </h2>
            <form onSubmit={handleRenameGroup} className="space-y-4">
              <input
                type="text"
                value={groupChatName}
                onChange={(e) => setGroupChatName(e.target.value)}
                className="w-full p-3 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200"
                placeholder="Enter new group name"
              />
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-3 rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg"
              >
                Rename Group
              </button>
            </form>
          </div>
        )}

        {/* Chat Members Section */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg overflow-hidden mb-8">
          <div className="p-6 border-b border-white/20">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <svg className="w-6 h-6 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Chat Members
            </h2>
            <p className="text-gray-300 text-sm mt-1">
              {users.length} {users.length === 1 ? 'member' : 'members'} in this group
            </p>
          </div>

          <div className="p-6 space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-200 border border-white/10"
              >
                <Link to={`/user/${user.id}`} className="flex items-center flex-grow">
                  <div className="relative">
                    <img
                      src={user.profilePicture || "/default_profile_pic.png"}
                      alt={user.username}
                      className="w-10 h-10 rounded-full mr-3 border-2 border-white/20"
                      onError={(e) => {
                        e.target.src = "/default_profile_pic.png";
                      }}
                    />
                    {onlineUsers.includes(user.id) && (
                      <div className="absolute -bottom-0.1 -right-0.1 w-3 h-3 bg-green-500 rounded-full border-2 border-white/20"></div>
                    )}
                  </div>
                  <div className="flex-grow">
                    <span className="text-white font-medium">{user.username}</span>
                    <div className="flex items-center mt-1">
                      {chat.groupAdmins.includes(user.id) && (
                        <span className="text-xs bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-2 py-1 rounded-full mr-2">
                          Admin
                        </span>
                      )}
                      <span className={`text-xs ${onlineUsers.includes(user.id) ? 'text-green-400' : 'text-gray-400'}`}>
                        {onlineUsers.includes(user.id) ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </Link>
                {chat.groupAdmins.includes(userId) && user.id !== userId && (
                  <div className="flex space-x-2">
                    {!chat.groupAdmins.includes(user.id) && (
                      <button
                        onClick={() => handleAddAdmin(user.id)}
                        className="px-3 py-1 text-xs bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-all duration-200 border border-blue-500/30"
                      >
                        Make Admin
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveUser(user.id)}
                      className="px-3 py-1 text-xs bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-all duration-200 border border-red-500/30"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Add User Section */}
        {chat.groupAdmins.includes(userId) && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <svg className="w-6 h-6 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add User
            </h2>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full p-3 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all duration-200"
                placeholder="Search users to add..."
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 shadow-lg max-h-60 overflow-auto z-10">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="p-3 hover:bg-white/10 cursor-pointer flex items-center transition-all duration-200 border-b border-white/10 last:border-b-0"
                      onClick={() => handleAddUser(user.id)}
                    >
                      <img
                        src={user.profilePicture || "/default_profile_pic.png"}
                        alt={user.username}
                        className="w-8 h-8 rounded-full mr-3 border-2 border-white/20"
                        onError={(e) => {
                          e.target.src = "/default_profile_pic.png";
                        }}
                      />
                      <span className="text-white font-medium">{user.username}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom spacing for mobile navigation */}
      <div className="h-24 lg:h-8"></div>
    </div>
  );
}