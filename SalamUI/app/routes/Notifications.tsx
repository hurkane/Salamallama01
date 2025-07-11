import React, { useState, useEffect } from "react";
import {
  getNotifications,
  getUnseenNotifications,
  getProfilePicture,
  markNotificationAsSeen,
} from "../utils/api";
import { useLoaderData } from "@remix-run/react";
import { loader as userDataLoader } from "~/Loaders/NotificationsLoader";
import { Link } from "react-router-dom";

export { userDataLoader as loader };

const Notifications = () => {
  const { userId, token } = useLoaderData();
  const [unseenNotifications, setUnseenNotifications] = useState([]);
  const [seenNotifications, setSeenNotifications] = useState([]);
  const [unseenPage, setUnseenPage] = useState(1);
  const [seenPage, setSeenPage] = useState(1);
  const [totalUnseenCount, setTotalUnseenCount] = useState(0);
  const [totalSeenCount, setTotalSeenCount] = useState(0);
  const [fetchError, setFetchError] = useState("");
  const [loadingUnseen, setLoadingUnseen] = useState(false);
  const [loadingSeen, setLoadingSeen] = useState(false);

  useEffect(() => {
    if (userId && token) {
      fetchInitialNotifications();
    } else {
      console.error("User ID or token is missing");
    }
  }, [userId, token]);

  const fetchInitialNotifications = async () => {
    setLoadingUnseen(true);
    setLoadingSeen(true);
    try {
      const unseen = await getUnseenNotifications(userId, token, 20, 0);
      const seen = await getNotifications(userId, token, 20, 0);

      const unseenWithProfilePictures = await addProfilePictures(unseen);
      const seenWithProfilePictures = await addProfilePictures(seen);

      // Mark all unseen notifications as seen
      await markAllAsSeen(unseenWithProfilePictures);

      setUnseenNotifications(unseenWithProfilePictures);
      setSeenNotifications(seenWithProfilePictures);

      setTotalUnseenCount(unseen.length);
      setTotalSeenCount(seen.length);

      setUnseenPage(1);
      setSeenPage(1);

      console.log(`Total unseen count: ${unseen.length}`);
      console.log(`Total seen count: ${seen.length}`);
    } catch (err) {
      setFetchError("Failed to fetch notifications.");
      console.error("Error fetching notifications:", err.message);
    } finally {
      setLoadingUnseen(false);
      setLoadingSeen(false);
    }
  };

  const fetchUnseenNotifications = async (page) => {
    setLoadingUnseen(true);
    try {
      const unseen = await getUnseenNotifications(
        userId,
        token,
        20,
        (page - 1) * 20
      );
      const unseenWithProfilePictures = await addProfilePictures(unseen);

      // Mark all unseen notifications as seen
      await markAllAsSeen(unseenWithProfilePictures);

      setUnseenNotifications((prev) => [
        ...prev,
        ...unseenWithProfilePictures.filter((n) => !n.seen),
      ]);

      setTotalUnseenCount((prevCount) => prevCount + unseen.length);
      setUnseenPage(page);

      console.log(
        `Fetched unseen notifications for page ${page}: ${unseen.length}`
      );
    } catch (err) {
      setFetchError("Failed to fetch unseen notifications.");
      console.error("Error fetching unseen notifications:", err.message);
    } finally {
      setLoadingUnseen(false);
    }
  };

  const fetchSeenNotifications = async (page) => {
    setLoadingSeen(true);
    try {
      const seen = await getNotifications(userId, token, 20, (page - 1) * 20);
      const seenWithProfilePictures = await addProfilePictures(seen);

      setSeenNotifications((prev) => [
        ...prev,
        ...seenWithProfilePictures.filter((n) => n.seen),
      ]);

      setTotalSeenCount((prevCount) => prevCount + seen.length);
      setSeenPage(page);

      console.log(
        `Fetched seen notifications for page ${page}: ${seen.length}`
      );
    } catch (err) {
      setFetchError("Failed to fetch seen notifications.");
      console.error("Error fetching seen notifications:", err.message);
    } finally {
      setLoadingSeen(false);
    }
  };

  const addProfilePictures = async (notifications) => {
    return await Promise.all(
      notifications.map(async (notification, index) => {
        try {
          const profilePicture = await getProfilePicture(
            notification.triggeredByUserId,
            token
          );
          return {
            ...notification,
            profilePicture,
            key: `${notification.id}-${index}`,
          };
        } catch (err) {
          console.error(
            `Failed to fetch profile picture for userId: ${notification.triggeredByUserId}`,
            err.message
          );
          return {
            ...notification,
            profilePicture: "/default_profile_pic.png",
            key: `${notification.id}-${index}`,
          };
        }
      })
    );
  };

  const markAllAsSeen = async (notifications) => {
    await Promise.all(
      notifications.map(async (notification) => {
        if (!notification.seen) {
          await markNotificationAsSeen(notification.id, token);
          notification.seen = true;
        }
      })
    );
  };

  const markAsSeen = async (notificationId) => {
    try {
      await markNotificationAsSeen(notificationId, token);
      setUnseenNotifications((prevNotifications) =>
        prevNotifications.filter(
          (notification) => notification.id !== notificationId
        )
      );
      const seenNotification = unseenNotifications.find(
        (notification) => notification.id === notificationId
      );
      if (seenNotification) {
        setSeenNotifications((prevNotifications) => [
          ...prevNotifications,
          { ...seenNotification, seen: true },
        ]);
      }
    } catch (err) {
      console.error("Failed to mark notification as seen", err.message);
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

    {/* Page Header */}
    <div className="w-full max-w-4xl mb-8 relative z-10">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg p-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent flex items-center space-x-2">
          <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5V8h10v9z" />
          </svg>
          <span>Notifications</span>
        </h1>
      </div>
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

    {/* Loading States */}
    {loadingUnseen && (
      <div className="w-full max-w-4xl mb-6 relative z-10">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-400" />
            <span className="text-gray-300">Loading unseen notifications...</span>
          </div>
        </div>
      </div>
    )}

    {loadingSeen && (
      <div className="w-full max-w-4xl mb-6 relative z-10">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400" />
            <span className="text-gray-300">Loading seen notifications...</span>
          </div>
        </div>
      </div>
    )}

    <div className="w-full max-w-4xl space-y-6 relative z-10">
      {/* Unseen Notifications Section */}
      {unseenNotifications.length > 0 ? (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg p-6">
          <h2 className="text-xl font-semibold text-white flex items-center space-x-2 mb-6">
            <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Unseen Notifications</span>
            <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full text-sm font-medium">
              {unseenNotifications.length}
            </span>
          </h2>
          
          <div className="space-y-4">
            {unseenNotifications.map((notification) => (
              <div
                key={notification.key}
                className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-4 transition-all duration-200 hover:bg-white/20 hover:scale-[1.02] cursor-pointer shadow-lg border-l-4 border-l-yellow-400"
                onClick={() => markAsSeen(notification.id)}
              >
                <div className="flex items-start space-x-4">
                  <Link to={`/user/${notification.triggeredByUserId}`}>
                    <img
                      src={notification.profilePicture}
                      alt="Profile"
                      className="w-12 h-12 rounded-full border-2 border-white/20 object-cover shadow-lg"
                    />
                  </Link>
                  <div className="flex-grow">
                    <p className="text-white break-words leading-relaxed mb-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-gray-400">
                      <span className="flex items-center space-x-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{new Date(notification.createdAt).toLocaleString()}</span>
                      </span>
                      {notification.referenceId && (
                        <Link
                          to={`/posts/${notification.referenceId}`}
                          className="text-indigo-300 hover:text-indigo-200 transition-colors duration-200 font-medium"
                        >
                          Go to Post →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex justify-center mt-6">
            <button
              className="px-8 py-3 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 text-white hover:bg-white/20 transition-all duration-200 font-medium shadow-lg"
              onClick={() => fetchUnseenNotifications(unseenPage + 1)}
            >
              Load More Unseen Notifications
            </button>
          </div>
        </div>
      ) : (
        !loadingUnseen && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-12 text-center shadow-lg">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5V8h10v9z" />
            </svg>
            <p className="text-gray-400 text-lg">No unseen notifications</p>
            <p className="text-gray-500 text-sm mt-2">You're all caught up!</p>
          </div>
        )
      )}

      {/* Seen Notifications Section */}
      {seenNotifications.length > 0 ? (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg p-6">
          <h2 className="text-xl font-semibold text-white flex items-center space-x-2 mb-6">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Seen Notifications</span>
            <span className="bg-gray-500/20 text-gray-300 px-2 py-1 rounded-full text-sm font-medium">
              {seenNotifications.length}
            </span>
          </h2>
          
          <div className="space-y-4">
            {seenNotifications.map((notification) => (
              <div
                key={notification.key}
                className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 p-4 transition-all duration-200 hover:bg-white/10 opacity-75 shadow-lg"
              >
                <div className="flex items-start space-x-4">
                  <Link to={`/user/${notification.triggeredByUserId}`}>
                    <img
                      src={notification.profilePicture}
                      alt="Profile"
                      className="w-12 h-12 rounded-full border-2 border-white/10 object-cover shadow-lg"
                    />
                  </Link>
                  <div className="flex-grow">
                    <p className="text-gray-300 break-words leading-relaxed mb-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span className="flex items-center space-x-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{new Date(notification.createdAt).toLocaleString()}</span>
                      </span>
                      {notification.referenceId && (
                        <Link
                          to={`/posts/${notification.referenceId}`}
                          className="text-indigo-400 hover:text-indigo-300 transition-colors duration-200 font-medium"
                        >
                          Go to Post →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex justify-center mt-6">
            <button
              className="px-8 py-3 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 text-white hover:bg-white/20 transition-all duration-200 font-medium shadow-lg"
              onClick={() => fetchSeenNotifications(seenPage + 1)}
            >
              Load More Notifications
            </button>
          </div>
        </div>
      ) : (
        !loadingSeen && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-12 text-center shadow-lg">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-gray-400 text-lg">No seen notifications</p>
            <p className="text-gray-500 text-sm mt-2">Previous notifications will appear here</p>
          </div>
        )
      )}
    </div>

    {/* Bottom spacing */}
    <div className="h-24 lg:h-8"></div>
  </div>
);
};

export default Notifications;
