import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState, useEffect } from "react";
import {
  getFollowers,
  getProfilePicture,
  getUserInfo,
  removeFollower,
  followUser,
  unfollowUser,
  getFollowStatus,
} from "~/utils/api";

import { loader as userDataLoader } from "~/Loaders/UserDataLoader";

export { userDataLoader as loader };

export default function FollowersPage() {
  const { followers, userId, loggedInUserId, token } = useLoaderData();
  const navigate = useNavigate();
  const [followerData, setFollowerData] = useState([]);
  const [followStates, setFollowStates] = useState({});
  const [loadingStates, setLoadingStates] = useState({});

  useEffect(() => {
    const fetchFollowerData = async () => {
      const data = await Promise.all(
        followers.map(async (follower) => {
          const [profilePicture, userInfo] = await Promise.all([
            getProfilePicture(follower.followerId, token),
            getUserInfo(follower.followerId, token),
          ]);
          return {
            id: follower.id, // Follow ID for removal
            userId: follower.followerId,
            username: userInfo.username,
            profilePicture,
          };
        })
      );
      setFollowerData(data);
      
      // Check follow status for each follower (if we're viewing someone else's followers)
      if (userId !== loggedInUserId) {
        const followStatuses = {};
        await Promise.all(
          data.map(async (follower) => {
            try {
              const status = await getFollowStatus(loggedInUserId, follower.userId, token);
              followStatuses[follower.userId] = {
                isFollowing: status.status === "approved",
                isPending: status.status === "pending",
                followId: status.id,
              };
            } catch (err) {
              // If we can't check follow status, assume not following
              followStatuses[follower.userId] = {
                isFollowing: false,
                isPending: false,
                followId: null,
              };
            }
          })
        );
        setFollowStates(followStatuses);
      }
    };
    fetchFollowerData();
  }, [followers, token, userId, loggedInUserId]);

  const handleRemoveFollower = async (followId) => {
    try {
      await removeFollower(followId, token);
      setFollowerData(
        followerData.filter((follower) => follower.id !== followId)
      );
    } catch (err) {
      console.error("Failed to remove follower:", err.message);
    }
  };

  const handleFollow = async (targetUserId) => {
    if (targetUserId === loggedInUserId) return;
    
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
    if (targetUserId === loggedInUserId) return;
    
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

  const renderActionButtons = (follower) => {
    if (follower.userId === loggedInUserId) {
      // This is the logged-in user, don't show any action buttons
      return null;
    }

    if (userId === loggedInUserId) {
      // We're viewing our own followers page
      return (
        <div className="flex space-x-2">
          <button
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all duration-200 shadow-lg font-medium text-sm"
            onClick={() => navigate(`/user/${follower.userId}`)}
          >
            View Profile
          </button>
          <button
            className="px-4 py-2 bg-red-500/20 backdrop-blur-lg rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/30 hover:text-red-200 transition-all duration-200 font-medium text-sm"
            onClick={() => handleRemoveFollower(follower.id)}
          >
            Remove
          </button>
        </div>
      );
    } else {
      // We're viewing someone else's followers page
      const followState = followStates[follower.userId];
      const isLoading = loadingStates[follower.userId];
      
      if (!followState) {
        return (
          <button
            className="px-4 py-2 bg-gray-500/20 backdrop-blur-lg rounded-xl border border-gray-500/30 text-gray-300 cursor-not-allowed font-medium text-sm"
            disabled
          >
            Loading...
          </button>
        );
      }

      return (
        <div className="flex space-x-2">
          <button
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all duration-200 shadow-lg font-medium text-sm"
            onClick={() => navigate(`/user/${follower.userId}`)}
          >
            View Profile
          </button>
          
          {/* Follow/Unfollow Button */}
          {followState.isFollowing ? (
            <button
              className="px-4 py-2 bg-red-500/20 backdrop-blur-lg rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/30 hover:text-red-200 transition-all duration-200 font-medium text-sm disabled:opacity-50"
              onClick={() => handleUnfollow(follower.userId)}
              disabled={isLoading}
            >
              {isLoading ? "Unfollowing..." : "Unfollow"}
            </button>
          ) : followState.isPending ? (
            <button
              className="px-4 py-2 bg-gray-500/20 backdrop-blur-lg rounded-xl border border-gray-500/30 text-gray-300 cursor-not-allowed font-medium text-sm"
              disabled
            >
              Pending
            </button>
          ) : (
            <button
              className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-500 hover:to-emerald-500 transition-all duration-200 shadow-lg font-medium text-sm disabled:opacity-50"
              onClick={() => handleFollow(follower.userId)}
              disabled={isLoading}
            >
              {isLoading ? "Following..." : "Follow"}
            </button>
          )}
        </div>
      );
    }
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen text-white px-0.5 py-3 lg:p-3 pt-16 lg:pt-6 relative">
      {/* Back Button */}
      <div className="w-full max-w-4xl mb-4 relative z-10">
        <button
          className="flex items-center space-x-2 px-4 py-2 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 text-gray-300 hover:text-white hover:bg-white/20 transition-all duration-200"
          onClick={() => navigate(`/user/${userId}`)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
          >
            <path d="M15 18l-6-6 6-6"></path>
          </svg>
          <span>Back to Profile</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-4xl relative z-10">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg p-6">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2 flex items-center space-x-3">
              <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.1-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Followers</span>
            </h2>
            <p className="text-gray-400">
              {followerData.length} {followerData.length === 1 ? 'follower' : 'followers'}
            </p>
          </div>

          {/* Followers List */}
          <div className="space-y-4">
            {followerData.map((follower) => (
              <div key={follower.id} className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-4 hover:bg-white/20 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <img
                      src={follower.profilePicture || "/default_profile_pic.png"}
                      alt={follower.username}
                      className="w-12 h-12 rounded-full cursor-pointer object-cover border border-white/20 hover:border-indigo-400 transition-all duration-200"
                      onError={(e) =>
                        (e.currentTarget.src = "/default_profile_pic.png")
                      }
                      onClick={() => navigate(`/user/${follower.userId}`)}
                    />
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => navigate(`/user/${follower.userId}`)}
                    >
                      <h3 className="text-lg font-semibold text-white hover:text-indigo-400 transition-colors duration-200">
                        {follower.username}
                      </h3>
                      <p className="text-gray-400">@{follower.username}</p>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  {renderActionButtons(follower)}
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {followerData.length === 0 && (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-gray-4 text-lg">No followers yet</p>
              <p className="text-gray-500 text-sm mt-2">When people follow this account, they'll appear here.</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom spacing */}
      <div className="h-24 lg:h-8"></div>
    </div>
  );
}