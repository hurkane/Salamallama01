// components/SearchResults.jsx
import React, { useState, useEffect } from "react";
import {
  searchPostsByKeyword,
  getPost,
  searchUsersByKeyword,
  getProfilePicture,
} from "../utils/api";
import { useLoaderData, useParams, Link } from "@remix-run/react";
import { loader as userDataLoader } from "~/Loaders/SearchResultsLoader";
import FeedComponent from "~/components/FeedComponent";

export { userDataLoader as loader };

const SearchResults = () => {
  const { token, userId } = useLoaderData();
  const { keyword } = useParams();
  const [postIds, setPostIds] = useState([]);
  const [users, setUsers] = useState([]);
  const [postCurrentPage, setPostCurrentPage] = useState(1);
  const [userCurrentPage, setUserCurrentPage] = useState(1);
  const [postTotalPages, setPostTotalPages] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    fetchPosts(1);
    fetchUsers(1);
  }, [token, keyword]);

  const fetchPosts = async (page) => {
    setLoadingPosts(true);
    try {
      const data = await searchPostsByKeyword(keyword, page, 20, token);
      setPostIds((prevPostIds) => {
        const newPostIds = data.postIds.filter(
          (id) => !prevPostIds.includes(id)
        );
        return [...prevPostIds, ...newPostIds];
      });
      setPostTotalPages(data.totalPages);
      setPostCurrentPage(data.currentPage);
    } catch (err) {
      setFetchError("Failed to fetch posts.");
      console.error("Error fetching posts:", err.message);
    } finally {
      setLoadingPosts(false);
    }
  };

  const fetchUsers = async (page) => {
    setLoadingUsers(true);
    try {
      const data = await searchUsersByKeyword(keyword, page, 20, token);
      const userInfos = await Promise.all(
        data.users.map(async (user) => {
          const profilePicture = await getProfilePicture(user.id, token);
          return { ...user, profilePicture };
        })
      );
      setUsers((prevUsers) => [
        ...prevUsers.filter((u) => !userInfos.find((info) => info.id === u.id)),
        ...userInfos,
      ]);
      setUserTotalPages(data.totalPages);
      setUserCurrentPage(data.currentPage);
    } catch (err) {
      setFetchError("Failed to fetch users.");
      console.error("Error fetching users:", err.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadMorePosts = () => {
    if (postCurrentPage < postTotalPages) {
      fetchPosts(postCurrentPage + 1);
    }
  };

  const loadMoreUsers = () => {
    if (userCurrentPage < userTotalPages) {
      fetchUsers(userCurrentPage + 1);
    }
  };

  const displayedUsers = showAllUsers ? users : users.slice(0, 3);

  return (
    <div className="search-results-page flex flex-col items-center justify-center w-full">
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
      {fetchError && <p className="text-red-500 mt-2">{fetchError}</p>}
      <div className="w-full max-w-4xl">
        {users.length > 0 && (
          <>
            <h2 className="text-lg font-bold mb-2">
              User Results for "{keyword}"
            </h2>
            {displayedUsers.map((user) => (
              <div
                key={user.id}
                className="mb-4 p-4 border rounded flex items-center"
              >
                <Link
                  to={`/user/${user.id}`}
                  className="flex-grow flex items-center"
                >
                  <img
                    src={user.profilePicture || "/default_profile_pic.png"}
                    alt="Profile"
                    className="w-10 h-10 rounded-full mr-4"
                  />
                  <div>
                    <p className="font-bold">{user.username}</p>
                    <p>{user.email}</p>
                  </div>
                </Link>
              </div>
            ))}
            {!showAllUsers && users.length > 3 && (
              <button
                className="p-2 bg-gray-700 text-white rounded mt-4 hover:bg-gray-600 transition duration-200"
                onClick={() => setShowAllUsers(true)}
              >
                Show More Users
              </button>
            )}
            {showAllUsers && userCurrentPage < userTotalPages && (
              <button
                className="p-2 bg-gray-700 text-white rounded mt-4 hover:bg-gray-600 transition duration-200"
                onClick={loadMoreUsers}
              >
                Load More Users
              </button>
            )}
          </>
        )}
        <hr className="my-4 w-full" />
        {postIds.length > 0 ? (
          <>
            <h2 className="text-lg font-bold mb-2">
              Post Results for "{keyword}"
            </h2>
            {postIds.map((postId, index) => (
              <React.Fragment key={postId}>
                <div className="w-full max-w-4xl mb-2">
                  <FeedComponent
                    postId={postId}
                    token={token}
                    userId={userId}
                  />
                </div>
                {index < postIds.length - 1 && (
                  <div
                    className="w-full bg-black my-4"
                    style={{ height: "5px" }}
                  />
                )}
              </React.Fragment>
            ))}
            {loadingPosts && <p>Loading...</p>}
            {postCurrentPage < postTotalPages && (
              <button
                className="p-2 bg-gray-700 text-white rounded mt-4 hover:bg-gray-600 transition duration-200"
                onClick={loadMorePosts}
              >
                Load More Posts
              </button>
            )}
          </>
        ) : (
          <p>No posts found for "{keyword}".</p>
        )}
      </div>
    </div>
  );
};

export default SearchResults;
