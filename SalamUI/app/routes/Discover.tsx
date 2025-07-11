// components/Discover.tsx
import React, { useState, useEffect } from "react";
import { getTopSentences } from "../utils/api";
import { useLoaderData, Link, useNavigate } from "@remix-run/react";
import { loader as userDataLoader } from "~/Loaders/DiscoverLoader";
import PopularUsers from "~/components/PopularUsers";
export { userDataLoader as loader };

const Discover = () => {
  const { token } = useLoaderData();
  const [trendingWords, setTrendingWords] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fetchError, setFetchError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchTrendingWords(1);
  }, [token]);

  const fetchTrendingWords = async (page) => {
    try {
      const data = await getTopSentences(page, 10, token); // Fetch 10 words at a time
      setTrendingWords((prevWords) => {
        const newWords = data.sentences.filter(
          (word) =>
            !prevWords.some((prevWord) => prevWord.sentence === word.sentence)
        );
        return [...prevWords, ...newWords];
      });
      setCurrentPage(data.currentPage);
      setTotalPages(Math.ceil(data.totalCount / 10)); // Set total pages based on 10 words per page
    } catch (err) {
      setFetchError("Failed to fetch trending words.");
      console.error("Error fetching trending words:", err.message);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    navigate(`/search/${searchQuery}`);
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

    {/* Search Section */}
    <div className="w-full max-w-4xl mb-8 relative z-10">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg p-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-4 flex items-center space-x-2">
          <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>Discover</span>
        </h2>
        <form onSubmit={handleSearchSubmit} className="flex space-x-2">
          <input
            type="text"
            className="flex-grow p-3 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
            placeholder="Search for posts, users, or topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            type="submit"
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-500 hover:to-purple-500 transition-all duration-200 shadow-lg font-medium"
          >
            Search
          </button>
        </form>
      </div>
    </div>

    {/* Popular Users Section */}
    <div className="w-full max-w-4xl mb-8 relative z-10">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg p-6">
        <h3 className="text-xl font-semibold text-white flex items-center space-x-2 mb-4">
          <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span>Popular Users</span>
        </h3>
        <PopularUsers token={token} />
      </div>
    </div>

    {/* Trending Section */}
    <div className="w-full max-w-4xl space-y-6 relative z-10">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg p-6">
        <h3 className="text-xl font-semibold text-white flex items-center space-x-2 mb-4">
          <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <span>Trending</span>
        </h3>
        
        {trendingWords.length > 0 ? (
          <div className="space-y-4">
            {trendingWords.map((word, index) => (
              <div
                key={index}
                className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-4 transition-all duration-200 hover:bg-white/20 hover:scale-[1.02] shadow-lg"
              >
                <Link to={`/search/${word.sentence}`}>
                  <p className="text-indigo-300 hover:text-indigo-200 transition-colors duration-200 break-words font-medium mb-2">
                    {word.sentence}
                  </p>
                </Link>
                <div className="flex items-center space-x-2 text-gray-400 text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>Count: {word.count}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <p className="text-gray-400 text-lg">No trending words found</p>
            <p className="text-gray-500 text-sm mt-2">Check back later for trending topics</p>
          </div>
        )}
      </div>

      {/* Load More Button */}
      {currentPage < totalPages && (
        <div className="flex justify-center">
          <button
            className="px-8 py-3 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 text-white hover:bg-white/20 transition-all duration-200 font-medium shadow-lg"
            onClick={() => fetchTrendingWords(currentPage + 1)}
          >
            Load More
          </button>
        </div>
      )}
    </div>

    {/* Bottom spacing */}
    <div className="h-24 lg:h-8"></div>
  </div>
);
};

export default Discover;
