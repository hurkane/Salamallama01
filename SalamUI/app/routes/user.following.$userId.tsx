import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  getFollowing,
  getProfilePicture,
  getUserInfo,
  unfollowUser,
  followUser,
  getFollowStatus,
} from "~/utils/api";
import { getSession } from "~/sessions";
import { useEffect, useState } from "react";

export const loader = async ({ params, request }) => {
  const userId = params.userId;
  const cookieHeader = request.headers.get("Cookie");
  const session = await getSession(cookieHeader);
  const token = session.get("token");
  const loggedInUserId = session.get("userId");

  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  try {
    const following = await getFollowing(userId, token);
    if (following.error) {
      return {
        following: [],
        userId,
        loggedInUserId,
        token,
        error: following.error,
      };
    }
    return { following, userId, loggedInUserId, token };
  } catch (error) {
    console.error("Failed to fetch following:", error);
    throw new Response("Failed to fetch following", { status: 500 });
  }
};

export default function FollowingPage() {
  const { following, userId, loggedInUserId, token } = useLoaderData();
  const navigate = useNavigate();
  const [followingData, setFollowingData] = useState([]);
  const [followStates, setFollowStates] = useState({});
  const [loadingStates, setLoadingStates] = useState({});

  useEffect(() => {
    const fetchFollowingData = async () => {
      const data = await Promise.all(
        following.map(async (followed) => {
          const [profilePicture, userInfo] = await Promise.all([
            getProfilePicture(followed.followedId, token),
            getUserInfo(followed.followedId, token),
          ]);
          return {
            id: followed.id, // Use the Follow ID
            userId: followed.followedId,
            username: userInfo.username,
            profilePicture,
          };
        })
      );
      setFollowingData(data);

      // Check follow status for each followed user (if we're viewing someone else's following)
      if (userId !== loggedInUserId) {
        const followStatuses = {};
        await Promise.all(
          data.map(async (followed) => {
            try {
              const status = await getFollowStatus(loggedInUserId, followed.userId, token);
              followStatuses[followed.userId] = {
                isFollowing: status.status === "approved",
                isPending: status.status === "pending",
                followId: status.id,
              };
            } catch (err) {
              // If we can't check follow status, assume not following
              followStatuses[followed.userId] = {
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
    fetchFollowingData();
  }, [following, token, userId, loggedInUserId]);

  const handleUnfollow = async (followId) => {
    try {
      await unfollowUser(followId, token);
      setFollowingData(
        followingData.filter((followed) => followed.id !== followId)
      );
    } catch (err) {
      console.error("Failed to unfollow user:", err);
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

  const handleUnfollowFromList = async (targetUserId) => {
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

  const renderActionButtons = (followed) => {
    if (followed.userId === loggedInUserId) {
      // This is the logged-in user, don't show any action buttons
      return null;
    }

    if (userId === loggedInUserId) {
      // We're viewing our own following page
      return (
        <div className="flex space-x-2">
          <button
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all duration-200 shadow-lg font-medium text-sm"
            onClick={() => navigate(`/user/${followed.userId}`)}
          >
            View Profile
          </button>
          <button
            className="px-4 py-2 bg-red-500/20 backdrop-blur-lg rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/30 hover:text-red-200 transition-all duration-200 font-medium text-sm"
            onClick={() => handleUnfollow(followed.id)}
          >
            Unfollow
          </button>
        </div>
      );
    } else {
      // We're viewing someone else's following page
      const followState = followStates[followed.userId];
      const isLoading = loadingStates[followed.userId];
      
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
            onClick={() => navigate(`/user/${followed.userId}`)}
          >
            View Profile
          </button>
          
          {/* Follow/Unfollow Button */}
          {followState.isFollowing ? (
            <button
              className="px-4 py-2 bg-red-500/20 backdrop-blur-lg rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/30 hover:text-red-200 transition-all duration-200 font-medium text-sm disabled:opacity-50"
              onClick={() => handleUnfollowFromList(followed.userId)}
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
              onClick={() => handleFollow(followed.userId)}
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              <span>Following</span>
            </h2>
            <p className="text-gray-400">
              {followingData.length} {followingData.length === 1 ? 'person' : 'people'} following
            </p>
          </div>

          {/* Following List */}
          <div className="space-y-4">
            {followingData.map((followed) => (
              <div key={followed.id} className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-4 hover:bg-white/20 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <img
                      src={followed.profilePicture || "/default_profile_pic.png"}
                      alt={followed.username}
                      className="w-12 h-12 rounded-full cursor-pointer object-cover border border-white/20 hover:border-indigo-400 transition-all duration-200"
                      onError={(e) =>
                        (e.currentTarget.src = "/default_profile_pic.png")
                      }
                      onClick={() => navigate(`/user/${followed.userId}`)}
                    />
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => navigate(`/user/${followed.userId}`)}
                    >
                      <h3 className="text-lg font-semibold text-white hover:text-indigo-400 transition-colors duration-200">
                        {followed.username}
                      </h3>
                      <p className="text-gray-400">@{followed.username}</p>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  {renderActionButtons(followed)}
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {followingData.length === 0 && (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              <p className="text-gray-400 text-lg">Not following anyone yet</p>
              <p className="text-gray-500 text-sm mt-2">When you follow people, they'll appear here.</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom spacing */}
      <div className="h-24 lg:h-8"></div>
    </div>
  );
}