import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState, useEffect } from "react";
import {
  getUserPosts,
  getBanner,
  followUser,
  unfollowUser,
  getProfilePicture,
  getFollowStatus,
  createOneToOneChat,
  API_BASE_URL,
} from "../utils/api";
import io from "socket.io-client";

import FeedComponent from "~/components/FeedComponent";

import { loader as userDataLoader } from "~/Loaders/UserDataLoader";
import React from "react";

const ENDPOINT = API_BASE_URL.replace(/^http/, "ws");
let socket;

export { userDataLoader as loader };

export default function UserPage() {
  const { token, userId, loggedInUserId, userInfo, followers, following } =
    useLoaderData();
  const navigate = useNavigate();
  const [postIds, setPostIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [profilePicture, setProfilePicture] = useState(
    userInfo.profilePicture || "/default_profile_pic.png"
  );
  const [banner, setBanner] = useState(
    userInfo.banner || "/default_banner.png"
  );
  const [username, setUsername] = useState(userInfo.username);
  const [bio, setBio] = useState(userInfo.bio || "");
  const [name, setName] = useState(userInfo.name || "");
  const [profilePublic, setProfilePublic] = useState(userInfo.profilePublic);
  const [isUserFollowing, setIsUserFollowing] = useState(false);
  const [isPendingFollow, setIsPendingFollow] = useState(false);
  const [followersCount, setFollowersCount] = useState(followers.length);
  const [followingCount, setFollowingCount] = useState(following.length);
  const [followId, setFollowId] = useState(null);
  const [followStatusLoaded, setFollowStatusLoaded] = useState(false); // Add this state
  
  // New state for online status and content tabs
  const [isUserOnline, setIsUserOnline] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");
  const [creatingChat, setCreatingChat] = useState(false);

  useEffect(() => {
    fetchProfileData();
    initializeSocket();
    
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [token, userId]);

  const initializeSocket = () => {
    socket = io(ENDPOINT);

    socket.on("connect", () => {
      console.log("Socket.io connected for user profile!");
    });

    socket.emit("setup", { _id: loggedInUserId });
    
    socket.on("user online", (onlineUserId) => {
      if (onlineUserId === userId) {
        setIsUserOnline(true);
      }
    });

    socket.on("user offline", (offlineUserId) => {
      if (offlineUserId === userId) {
        setIsUserOnline(false);
      }
    });

    // Check if user is initially online
    socket.emit("check user online", userId);
    socket.on("user online status", ({ userId: checkedUserId, isOnline }) => {
      if (checkedUserId === userId) {
        setIsUserOnline(isOnline);
      }
    });
  };

  const fetchProfileData = async () => {
    try {
      const profilePicUrl = await getProfilePicture(userId, token);
      setProfilePicture(profilePicUrl);

      const bannerUrl = await getBanner(userId, token);
      setBanner(bannerUrl);

      if (userId !== loggedInUserId) {
        await checkFollowStatus();
      } else {
        setFollowStatusLoaded(true); // If viewing own profile, mark as loaded
      }

      // Wait for follow status to be loaded before deciding what to show
      if (userId === loggedInUserId || profilePublic) {
        fetchUserPosts(1);
      }
    } catch (err) {
      console.error("Error fetching profile data:", err.message);
      setFollowStatusLoaded(true); // Mark as loaded even on error
    }
  };

  const fetchUserPosts = async (page) => {
    setLoading(true);
    try {
      const response = await getUserPosts(userId, page, token);
      setPostIds(
        (prevPostIds) => new Set([...prevPostIds, ...response.postIds])
      );
      setTotalPages(response.totalPages);
      setCurrentPage(response.currentPage);
    } catch (err) {
      if (err.response?.status === 403) {
        setError("This user's posts are private.");
      } else {
        setError("Failed to fetch user posts.");
      }
      console.error("Error fetching user posts:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMorePosts = () => {
    if (currentPage < totalPages) {
      fetchUserPosts(currentPage + 1);
    }
  };

  const handleFollow = async () => {
    try {
      const followResponse = await followUser(userId, token);
      setIsUserFollowing(followResponse.status === "approved");
      setIsPendingFollow(followResponse.status === "pending");
      setFollowersCount(followersCount + 1);
      setFollowId(followResponse.id);
      
      // If follow is approved, try to fetch posts
      if (followResponse.status === "approved") {
        fetchUserPosts(1);
      }
    } catch (err) {
      setError("Failed to follow user.");
      console.error("Error following user:", err.message);
    }
  };

  const handleUnfollow = async () => {
    try {
      await unfollowUser(userId, token);
      setIsUserFollowing(false);
      setIsPendingFollow(false);
      setFollowersCount(followersCount - 1);
      setFollowId(null);
      
      // Clear posts if profile is private
      if (!profilePublic) {
        setPostIds(new Set());
        setError("This user's posts are private.");
      }
    } catch (err) {
      setError("Failed to unfollow user.");
      console.error("Error unfollowing user:", err.message);
    }
  };

  const checkFollowStatus = async () => {
    try {
      const response = await getFollowStatus(loggedInUserId, userId, token);
      setIsUserFollowing(response.status === "approved");
      setIsPendingFollow(response.status === "pending");
      setFollowId(response.id);
      
      // After checking follow status, decide whether to fetch posts
      if (response.status === "approved" || profilePublic) {
        fetchUserPosts(1);
      } else {
        setError("This user's posts are private.");
      }
    } catch (err) {
      console.error("Error checking follow status:", err.message);
      if (!profilePublic) {
        setError("This user's posts are private.");
      }
    } finally {
      setFollowStatusLoaded(true);
    }
  };

  const handleCreateChat = async () => {
    if (userId === loggedInUserId) return;
    
    setCreatingChat(true);
    try {
      const chat = await createOneToOneChat(userId, token);
      if (chat && chat._id) {
        navigate(`/chat/${chat._id}`);
      }
    } catch (err) {
      setError("Failed to create chat.");
      console.error("Error creating chat:", err.message);
    } finally {
      setCreatingChat(false);
    }
  };

  // Determine if user can see content
  const canSeeContent = userId === loggedInUserId || profilePublic || isUserFollowing;

  const renderTabContent = () => {
    if (!followStatusLoaded && userId !== loggedInUserId) {
      return (
        <div className="flex justify-center py-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-400" />
              <span className="text-gray-300">Loading...</span>
            </div>
          </div>
        </div>
      );
    }

    if (!canSeeContent) {
      return (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-12 text-center shadow-lg">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h3 className="text-xl font-semibold text-white mb-2">Private Account</h3>
          <p className="text-gray-400">This user's posts are private. Follow them to see their content.</p>
        </div>
      );
    }

    switch (activeTab) {
      case "posts":
        return (
          <div className="space-y-6">
            {[...postIds].map((postId, index) => (
              <div key={postId} className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg overflow-hidden">
                <div className="p-6">
                  <FeedComponent postId={postId} token={token} />
                </div>
              </div>
            ))}

            {currentPage < totalPages && (
              <div className="flex justify-center">
                <button
                  className="px-8 py-3 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 text-white hover:bg-white/20 transition-all duration-200 font-medium"
                  onClick={loadMorePosts}
                >
                  Load More Posts
                </button>
              </div>
            )}

            {loading && (
              <div className="flex justify-center py-8">
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-400" />
                    <span className="text-gray-300">Loading posts...</span>
                  </div>
                </div>
              </div>
            )}

            {!loading && postIds.length === 0 && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-12 text-center">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
                <p className="text-gray-400 text-lg">No posts yet</p>
                <p className="text-gray-500 text-sm mt-2">
                  {loggedInUserId === userId ? "Create your first post!" : "This user hasn't posted anything yet."}
                </p>
              </div>
            )}
          </div>
        );
      case "media":
        return (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-400 text-lg">Media content</p>
            <p className="text-gray-500 text-sm mt-2">Photos and videos will appear here</p>
          </div>
        );
      case "comments":
        return (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-gray-400 text-lg">Comments & Replies</p>
            <p className="text-gray-500 text-sm mt-2">User comments and replies will appear here</p>
          </div>
        );
      default:
        return null;
    }
  };
return (
    <div className="flex flex-col items-center justify-start min-h-screen text-white px-0.5 py-3 lg:p-3 pt-16 lg:pt-6 relative">
      {/* Profile Header */}
      <div className="w-full max-w-4xl mb-8 relative z-10">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg overflow-visible">
          {/* Banner Section with Overlay Back Button */}
          <div className="relative h-56 sm:h-64 overflow-hidden rounded-t-2xl">
            <img
              src={banner}
              alt="Banner"
              className="w-full h-full object-cover"
              onError={(e) => (e.currentTarget.src = "/default_banner.png")}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            
            {/* Back Button Overlay */}
            <div className="absolute top-4 left-4 z-20">
              <button
                className="flex items-center space-x-2 px-4 py-2 bg-black/40 backdrop-blur-lg rounded-xl border border-white/20 text-gray-200 hover:text-white hover:bg-black/60 transition-all duration-200 shadow-lg"
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
          </div>

          {/* Compact Profile Info Section */}
          <div className="p-6 relative -mt-16 sm:-mt-20">
            <div className="flex items-start justify-between">
              {/* Left Side - Profile Picture */}
              <div className="relative mr-6">
                <img
                  src={profilePicture}
                  alt={username}
                  className="w-24 sm:w-32 h-24 sm:h-32 rounded-full border-4 border-white/20 object-cover shadow-2xl bg-gray-800"
                />
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20" />
                
                {/* Online Status Indicator */}
                {isUserOnline && userId !== loggedInUserId && (
                  <div className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 rounded-full border-2 border-white/30 flex items-center justify-center">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                  </div>
                )}
              </div>

              {/* Right Side - Action Buttons */}
              <div className="flex space-x-3 mt-4">
                {loggedInUserId === userId ? (
                  <button
                    className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-500 hover:to-purple-500 transition-all duration-200 shadow-lg font-medium"
                    onClick={() => navigate(`/edit-profile`)}
                  >
                    Edit Profile
                  </button>
                ) : (
                  <>
                    {isUserFollowing ? (
                      <button
                        className="px-4 py-2 bg-red-500/20 backdrop-blur-lg rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/30 hover:text-red-200 transition-all duration-200 font-medium"
                        onClick={handleUnfollow}
                      >
                        Unfollow
                      </button>
                    ) : isPendingFollow ? (
                      <button
                        className="px-4 py-2 bg-gray-500/20 backdrop-blur-lg rounded-xl border border-gray-500/30 text-gray-300 cursor-not-allowed font-medium"
                        disabled
                      >
                        Pending
                      </button>
                    ) : (
                      <button
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all duration-200 shadow-lg font-medium"
                        onClick={handleFollow}
                      >
                        Follow
                      </button>
                    )}
                    
                    {/* Chat Button */}
                    <button
                      className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-500 hover:to-emerald-500 transition-all duration-200 shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleCreateChat}
                      disabled={creatingChat}
                    >
                      {creatingChat ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          <span>Creating...</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <span>Message</span>
                        </div>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Profile Details */}
            <div className="mt-4">
              <div className="flex items-center space-x-2 mb-1">
                <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  {name}
                </h2>
                {isUserOnline && userId !== loggedInUserId && (
                  <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full border border-green-500/30">
                    Online
                  </span>
                )}
              </div>
              <p className="text-gray-300 text-base mb-3">@{username}</p>
              <p className="text-gray-400 mb-3 leading-relaxed">{bio}</p>
              <p className="text-gray-500 text-sm mb-4">
                Joined {new Date(userInfo.createdAt).toLocaleDateString()}
              </p>

              {/* Stats */}
              <div className="flex space-x-6">
                <div
                  className="cursor-pointer group"
                  onClick={() => navigate(`/user/followers/${userId}`)}
                >
                  <span className="text-white font-bold group-hover:text-indigo-400 transition-colors duration-200">
                    {followersCount}
                  </span>
                  <span className="text-gray-400 ml-1">
                    {canSeeContent ? "Followers" : "Private"}
                  </span>
                </div>
                <div
                  className="cursor-pointer group"
                  onClick={() => navigate(`/user/following/${userId}`)}
                >
                  <span className="text-white font-bold group-hover:text-purple-400 transition-colors duration-200">
                    {followingCount}
                  </span>
                  <span className="text-gray-400 ml-1">
                    {canSeeContent ? "Following" : "Private"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="w-full max-w-4xl space-y-6 relative z-10">
        {/* Content Navigation Tabs - Show only if user can see content */}
        {canSeeContent && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg">
            <div className="flex p-2">
              <button
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${
                  activeTab === "posts"
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "text-gray-300 hover:text-white hover:bg-white/10"
                }`}
                onClick={() => setActiveTab("posts")}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
                <span>Posts</span>
                <span className="bg-white/20 text-xs px-2 py-1 rounded-full">
                  {postIds.length}
                </span>
              </button>
              
              <button
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${
                  activeTab === "media"
                    ? "bg-purple-600 text-white shadow-lg"
                    : "text-gray-300 hover:text-white hover:bg-white/10"
                }`}
                onClick={() => setActiveTab("media")}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Media</span>
              </button>
              
              <button
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${
                  activeTab === "comments"
                    ? "bg-green-600 text-white shadow-lg"
                    : "text-gray-300 hover:text-white hover:bg-white/10"
                }`}
                onClick={() => setActiveTab("comments")}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>Comments</span>
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {renderTabContent()}
      </div>

      {/* Error State */}
      {error && (
        <div className="w-full max-w-4xl relative z-10">
          <div className="bg-red-500/20 backdrop-blur-lg rounded-2xl border border-red-500/30 p-6 text-center">
            <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-300 font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Bottom spacing */}
      <div className="h-24 lg:h-8"></div>
    </div>
  );
}