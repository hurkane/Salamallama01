import React, { useState, useEffect } from "react";
import {
  getFollowRequests,
  getFollowers,
  acceptFollowRequest,
  rejectFollowRequest,
  getUserInfo,
  removeFollower,
} from "../utils/api";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { loader as userDataLoader } from "~/Loaders/FollowRequestsLoader";

export { userDataLoader as loader };

const FollowRequests = () => {
  const { userId, token, loggedInUserId } = useLoaderData();
  const navigate = useNavigate();
  const [followRequests, setFollowRequests] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    if (userId && token) {
      fetchFollowRequests();
      fetchFollowers();
    } else {
      console.error("User ID or token is missing");
    }
  }, [userId, token]);

  const fetchFollowRequests = async () => {
    try {
      const requests = await getFollowRequests(token);
      const requestsWithUserInfo = await Promise.all(
        requests.map(async (request) => {
          const userInfo = await getUserInfo(request.followerId, token);
          return { ...request, userInfo };
        })
      );
      setFollowRequests(requestsWithUserInfo);
    } catch (err) {
      setFetchError("Failed to fetch follow requests.");
      console.error("Error fetching follow requests:", err.message);
    }
  };

  const fetchFollowers = async () => {
    try {
      const fetchedFollowers = await getFollowers(userId, token);
      console.log("Fetched Followers:", fetchedFollowers); // Debug log

      const followersWithUserInfo = await Promise.all(
        fetchedFollowers.map(async (follower) => {
          const userInfo = await getUserInfo(follower.followerId, token);
          return {
            ...follower,
            username: userInfo.username,
            profilePicture: userInfo.profilePicture,
            followerId: follower.followerId,
          };
        })
      );
      console.log("Followers with User Info:", followersWithUserInfo); // Debug log
      setFollowers(followersWithUserInfo);
    } catch (err) {
      setFetchError("Failed to fetch followers.");
      console.error("Error fetching followers:", err.message);
    }
  };

  const handleAccept = async (id) => {
    try {
      await acceptFollowRequest(id, token);
      setFollowRequests((prevRequests) =>
        prevRequests.map((request) =>
          request.id === id ? { ...request, status: "approved" } : request
        )
      );
    } catch (err) {
      setFetchError("Failed to accept follow request.");
      console.error("Error accepting follow request:", err.message);
    }
  };

  const handleReject = async (id) => {
    try {
      await rejectFollowRequest(id, token);
      setFollowRequests((prevRequests) =>
        prevRequests.filter((request) => request.id !== id)
      );
    } catch (err) {
      setFetchError("Failed to reject follow request.");
      console.error("Error rejecting follow request:", err.message);
    }
  };

  const handleRemoveFollower = async (followId) => {
    try {
      await removeFollower(followId, token);
      setFollowers(followers.filter((follower) => follower.id !== followId));
    } catch (err) {
      console.error("Failed to remove follower:", err.message);
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

    {/* Error State */}
    {fetchError && (
      <div className="w-full max-w-4xl mb-6 relative z-10">
        <div className="bg-red-500/20 backdrop-blur-lg rounded-2xl border border-red-500/30 p-6 text-center shadow-lg">
          <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-red-300 font-medium">{fetchError}</p>
        </div>
      </div>
    )}

    <div className="w-full max-w-4xl space-y-6 relative z-10">
      {/* Follow Requests Section */}
      {followRequests.length > 0 ? (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg p-6">
          <h2 className="text-xl font-semibold text-white flex items-center space-x-2 mb-6">
            <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <span>Follow Requests</span>
            <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full text-sm font-medium">
              {followRequests.length}
            </span>
          </h2>
          
          <div className="space-y-4">
            {followRequests.map((request) => (
              <div
                key={request.id}
                className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-4 transition-all duration-200 hover:bg-white/20 shadow-lg"
              >
                <div className="flex items-center space-x-4">
                  <a
                    href={`/user/${request.followerId}`}
                    className="flex-grow flex items-center space-x-4"
                  >
                    <img
                      src={request.userInfo.profilePicture || "/default_profile_pic.png"}
                      alt="Profile"
                      className="w-12 h-12 rounded-full border-2 border-white/20 object-cover shadow-lg"
                    />
                    <div>
                      <p className="font-semibold text-white">{request.userInfo.username}</p>
                      <p className="text-gray-300">{request.userInfo.name}</p>
                    </div>
                  </a>
                  <div className="flex-shrink-0">
                    {request.status === "pending" ? (
                      <div className="flex space-x-2">
                        <button
                          className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-500 hover:to-emerald-500 transition-all duration-200 shadow-lg font-medium"
                          onClick={() => handleAccept(request.id)}
                        >
                          Accept
                        </button>
                        <button
                          className="px-4 py-2 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl hover:from-red-500 hover:to-pink-500 transition-all duration-200 shadow-lg font-medium"
                          onClick={() => handleReject(request.id)}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-green-400 font-medium">Approved</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-12 text-center shadow-lg">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
          <p className="text-gray-400 text-lg">No follow requests</p>
          <p className="text-gray-500 text-sm mt-2">New follow requests will appear here</p>
        </div>
      )}

      {/* Current Followers Section */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg p-6">
        <h2 className="text-xl font-semibold text-white flex items-center space-x-2 mb-6">
          <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span>Current Followers</span>
          <span className="bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-full text-sm font-medium">
            {followers.length}
          </span>
        </h2>
        
        {followers.length > 0 ? (
          <div className="space-y-4">
            {followers.map((follower) => (
              <div
                key={follower.id}
                className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-4 transition-all duration-200 hover:bg-white/20 hover:scale-[1.02] shadow-lg"
              >
                <div className="flex items-center space-x-4">
                  <img
                    src={follower.profilePicture || "/default_profile_pic.png"}
                    alt={follower.username}
                    className="w-12 h-12 rounded-full border-2 border-white/20 object-cover shadow-lg cursor-pointer"
                    onError={(e) => (e.currentTarget.src = "/default_profile_pic.png")}
                    onClick={() => navigate(`/user/${follower.followerId}`)}
                  />
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => navigate(`/user/${follower.followerId}`)}
                  >
                    <h3 className="text-md font-semibold text-white">{follower.username}</h3>
                    <p className="text-gray-400">@{follower.username}</p>
                  </div>
                  {userId === loggedInUserId && (
                    <button
                      className="px-4 py-2 bg-red-500/20 backdrop-blur-lg rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/30 hover:text-red-200 transition-all duration-200 font-medium"
                      onClick={() => handleRemoveFollower(follower.id)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-gray-400 text-lg">No followers yet</p>
            <p className="text-gray-500 text-sm mt-2">Your followers will appear here</p>
          </div>
        )}
      </div>
    </div>

    {/* Bottom spacing */}
    <div className="h-24 lg:h-8"></div>
  </div>
);
};

export default FollowRequests;
