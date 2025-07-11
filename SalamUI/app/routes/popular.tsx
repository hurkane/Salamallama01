import { LoaderFunction, json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState, useEffect } from "react";
import { 
  createPost, 
  getPopularFeed, 
  getPopularUsers, 
  getProfilePicture, 
  getUserInfo, 
  followUser, 
  unfollowUser, 
  getFollowStatus 
} from "../utils/api";
import { getSession } from "~/sessions";

import FeedComponent from "~/components/FeedComponent";
import React from "react";

export const loader: LoaderFunction = async ({ request }) => {
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("token");
  const userId = session.get("userId");

  if (!token) {
    redirect("/sign-in");
  }

  return json({ token, userId });
};

export default function Home() {
  const { token, userId } = useLoaderData();
  const [content, setContent] = useState("");
  const [file, setFile] = useState(null);
  const [postIds, setPostIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Popular users state
  const [popularUsers, setPopularUsers] = useState([]);
  const [popularUsersLoading, setPopularUsersLoading] = useState(false);
  const [followStates, setFollowStates] = useState({});
  const [loadingStates, setLoadingStates] = useState({});
  const [showPopularUsers, setShowPopularUsers] = useState(false);

  useEffect(() => {
    fetchFeed(1);
    fetchPopularUsers();
  }, [token]);

  const fetchFeed = async (page) => {
    setLoading(true);
    try {
      const response = await getPopularFeed(page, token);
      setPostIds((prevPostIds) => {
        const newPostIds = response.postIds.filter(
          (id) => !prevPostIds.includes(id)
        );
        return [...prevPostIds, ...newPostIds];
      });
      setTotalPages(response.totalPages);
      setCurrentPage(response.currentPage);
    } catch (err) {
      setError("Failed to fetch feed.");
      console.error("Error fetching feed:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPopularUsers = async () => {
    setPopularUsersLoading(true);
    try {
      // Assuming you have a getPopularUsers API function
      const users = await getPopularUsers(token);
      
      // Fetch additional data for each user
      const usersWithData = await Promise.all(
        users.map(async (user) => {
          const [profilePicture, userInfo] = await Promise.all([
            getProfilePicture(user.id, token),
            getUserInfo(user.id, token),
          ]);
          return {
            id: user.id,
            username: userInfo.username,
            profilePicture,
            followersCount: user.followersCount || 0,
          };
        })
      );
      
      setPopularUsers(usersWithData);
      
      // Check follow status for each popular user
      const followStatuses = {};
      await Promise.all(
        usersWithData.map(async (user) => {
          if (user.id !== userId) {
            try {
              const status = await getFollowStatus(userId, user.id, token);
              followStatuses[user.id] = {
                isFollowing: status.status === "approved",
                isPending: status.status === "pending",
                followId: status.id,
              };
            } catch (err) {
              followStatuses[user.id] = {
                isFollowing: false,
                isPending: false,
                followId: null,
              };
            }
          }
        })
      );
      setFollowStates(followStatuses);
    } catch (err) {
      console.error("Error fetching popular users:", err.message);
    } finally {
      setPopularUsersLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const newPost = await createPost(content, file, token);
      setContent("");
      setFile(null);
      setPostIds((prevPostIds) => [newPost.id, ...prevPostIds]);
    } catch (err) {
      setError("Failed to create post.");
      console.error("Error creating post:", err.message);
    }
  };

  const handleFollow = async (targetUserId) => {
    if (targetUserId === userId) return;
    
    setLoadingStates(prev => ({ ...prev, [targetUserId]: true }));
    
    try {
      const response = await followUser(targetUserId, token);
      setFollowStates(prev => ({
        ...prev,
        [targetUserId]: {
          isFollowing: response.status === "approved",
          isPending: response.status === "pending",
          followId: response.id,
        }
      }));
    } catch (err) {
      console.error("Failed to follow user:", err.message);
    } finally {
      setLoadingStates(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  const handleUnfollow = async (targetUserId) => {
    if (targetUserId === userId) return;
    
    setLoadingStates(prev => ({ ...prev, [targetUserId]: true }));
    
    try {
      await unfollowUser(targetUserId, token);
      setFollowStates(prev => ({
        ...prev,
        [targetUserId]: {
          isFollowing: false,
          isPending: false,
          followId: null,
        }
      }));
    } catch (err) {
      console.error("Failed to unfollow user:", err.message);
    } finally {
      setLoadingStates(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  const loadMorePosts = () => {
    if (currentPage < totalPages) {
      fetchFeed(currentPage + 1);
    }
  };

  const renderFollowButton = (user) => {
    if (user.id === userId) return null;
    
    const followState = followStates[user.id];
    const isLoading = loadingStates[user.id];
    
    if (!followState) {
      return (
        <button
          className="px-3 py-1 bg-gray-500/20 backdrop-blur-lg rounded-lg border border-gray-500/30 text-gray-300 cursor-not-allowed font-medium text-xs"
          disabled
        >
          Loading...
        </button>
      );
    }

    if (followState.isFollowing) {
      return (
        <button
          className="px-3 py-1 bg-red-500/20 backdrop-blur-lg rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/30 hover:text-red-200 transition-all duration-200 font-medium text-xs disabled:opacity-50"
          onClick={() => handleUnfollow(user.id)}
          disabled={isLoading}
        >
          {isLoading ? "Unfollowing..." : "Unfollow"}
        </button>
      );
    } else if (followState.isPending) {
      return (
        <button
          className="px-3 py-1 bg-gray-500/20 backdrop-blur-lg rounded-lg border border-gray-500/30 text-gray-300 cursor-not-allowed font-medium text-xs"
          disabled
        >
          Pending
        </button>
      );
    } else {
      return (
        <button
          className="px-3 py-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-500 hover:to-emerald-500 transition-all duration-200 shadow-lg font-medium text-xs disabled:opacity-50"
          onClick={() => handleFollow(user.id)}
          disabled={isLoading}
        >
          {isLoading ? "Following..." : "Follow"}
        </button>
      );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-primary-dark text-white p-0">
      <div className="w-full max-w-4xl mb-4">
        <form
          onSubmit={handleSubmit}
          className="w-full bg-black bg-opacity-60 backdrop-blur-md p-4 rounded-lg"
        >
          <div className="flex flex-col items-center space-y-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full p-2 border rounded-full bg-gray-900 text-white placeholder-gray-500 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
              required
            />
            <div className="flex items-center justify-center space-x-1 w-full max-w-xs">
              <input
                type="file"
                onChange={(e) => setFile(e.target.files[0])}
                className="cursor-pointer px-2 py-1 sm:px-4 sm:py-2 bg-gray-700 rounded-full text-white hover:bg-gray-600 transition duration-200 text-xs sm:text-sm"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-purple-800 bg-opacity-70 text-white rounded-full hover:bg-purple-700 transition duration-200 text-xs sm:text-sm backdrop-blur-md"
              >
                Post
              </button>
            </div>
          </div>
        </form>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>

      {/* Popular Users Section */}
      <div className="w-full max-w-4xl mb-4">
        <div className="bg-black bg-opacity-60 backdrop-blur-md p-4 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent flex items-center space-x-2">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Popular Users</span>
            </h3>
            <button
              onClick={() => setShowPopularUsers(!showPopularUsers)}
              className="text-indigo-400 hover:text-indigo-300 transition-colors duration-200"
            >
              {showPopularUsers ? "Hide" : "Show"}
            </button>
          </div>
          
          {showPopularUsers && (
            <div className="space-y-3">
              {popularUsersLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
                </div>
              ) : (
                popularUsers.slice(0, 5).map((user) => (
                  <div key={user.id} className="bg-white/10 backdrop-blur-lg rounded-lg border border-white/20 p-3 hover:bg-white/20 transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <img
                          src={user.profilePicture || "/default_profile_pic.png"}
                          alt={user.username}
                          className="w-10 h-10 rounded-full object-cover border border-white/20 hover:border-indigo-400 transition-all duration-200 cursor-pointer"
                          onError={(e) => (e.currentTarget.src = "/default_profile_pic.png")}
                          onClick={() => window.location.href = `/user/${user.id}`}
                        />
                        <div className="cursor-pointer" onClick={() => window.location.href = `/user/${user.id}`}>
                          <h4 className="font-medium text-white hover:text-indigo-400 transition-colors duration-200">
                            {user.username}
                          </h4>
                          <p className="text-sm text-gray-400">
                            {user.followersCount} {user.followersCount === 1 ? 'follower' : 'followers'}
                          </p>
                        </div>
                      </div>
                      {renderFollowButton(user)}
                    </div>
                  </div>
                ))
              )}
              
              {popularUsers.length > 5 && (
                <div className="text-center pt-2">
                  <button
                    onClick={() => window.location.href = '/popular-users'}
                    className="text-indigo-400 hover:text-indigo-300 transition-colors duration-200 text-sm"
                  >
                    View all popular users →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Full-length divider on top */}
      <div className="w-screen border-t border-gray-700 my-2" />

      {postIds.map((postId, index) => (
        <React.Fragment key={postId}>
          <div className="w-full max-w-4xl mb-2">
            <FeedComponent postId={postId} token={token} userId={userId} />
          </div>
          {/* Divider between posts */}
          {index < postIds.length - 1 && (
            <div className="w-screen border-t border-gray-700 my-2" />
          )}
        </React.Fragment>
      ))}

      {/* Full-length divider on bottom */}
      <div className="w-screen border-t border-black-700 my-2" />

      {loading && <p>Loading...</p>}
      {currentPage < totalPages && (
        <button
          className="p-2 bg-gray-700 text-white rounded mt-4 hover:bg-gray-600 transition duration-200"
          onClick={loadMorePosts}
        >
          Load More Posts
        </button>
      )}
      <hr className="my-4 w-full border-2 border-gray-700" />
    </div>
  );
}