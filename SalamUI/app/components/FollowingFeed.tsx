import React, { useState, useEffect } from "react";
import { getFollowingFeed } from "../utils/api";
import FeedComponent from "./FeedComponent";

const FollowingFeed = ({ token, userId }) => {
  const [postIds, setPostIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFeed(1);
  }, [token]);

  const fetchFeed = async (page) => {
    setLoading(true);
    try {
      const response = await getFollowingFeed(page, token);
      setPostIds((prevPostIds) => {
        // Avoid adding duplicate posts
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

  const loadMorePosts = () => {
    if (currentPage < totalPages) {
      fetchFeed(currentPage + 1);
    }
  };

  return (
    <div className="posts-feed flex flex-col items-center justify-center w-full">
      {postIds.map((postId, index) => (
        <React.Fragment key={postId}>
          <div className="w-full max-w-4xl mb-2">
            <FeedComponent postId={postId} token={token} userId={userId} />
          </div>
          {/* Divider between posts */}
          {index < postIds.length - 1 && (
            <div className="w-screen border-t-8 border-black my-2" />
          )}
        </React.Fragment>
      ))}
      {loading && <p>Loading...</p>}
      {currentPage < totalPages && (
        <button
          className="p-2 bg-gray-700 text-white rounded mt-4 hover:bg-gray-600 transition duration-200"
          onClick={loadMorePosts}
        >
          Load More Posts
        </button>
      )}
    </div>
  );
};

export default FollowingFeed;
