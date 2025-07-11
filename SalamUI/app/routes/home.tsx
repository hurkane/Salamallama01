import { LoaderFunction, json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { getSession } from "~/sessions";
import CreatePost from "~/components/CreatePost";
import PostsFeed from "~/components/ForYouFeed";
import FollowingFeed from "~/components/FollowingFeed";

export const loader: LoaderFunction = async ({ request }) => {
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("token");
  const userId = session.get("userId");
  
  if (!token) {
    return redirect("/sign-in");
  }
  
  return json({ token, userId });
};

export default function Home() {
  const { token, userId } = useLoaderData();
  const [posts, setPosts] = useState([]);
  const [selectedTab, setSelectedTab] = useState("posts"); // State to track the selected tab

  const handlePostCreated = (newPost) => {
    setPosts([newPost, ...posts]);
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen text-white px-0.5 py-3 lg:p-3 pt-16 lg:pt-6 relative">

      {/* Create Post Section */}
      <div className="w-full max-w-4xl mb-4 relative z-10">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-3 shadow-lg">
          <CreatePost token={token} onPostCreated={handlePostCreated} />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="w-full max-w-4xl mb-4 relative z-10">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-1.5 shadow-lg">
          <div className="flex justify-center space-x-1.5">
            <button
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex-1 text-sm ${
                selectedTab === "posts"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md"
                  : "text-gray-300 hover:text-white hover:bg-white/10"
              }`}
              onClick={() => setSelectedTab("posts")}
            >
              <div className="flex items-center justify-center space-x-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>For You</span>
              </div>
            </button>
            <button
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex-1 text-sm ${
                selectedTab === "following"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md"
                  : "text-gray-300 hover:text-white hover:bg-white/10"
              }`}
              onClick={() => setSelectedTab("following")}
            >
              <div className="flex items-center justify-center space-x-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Following</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Feed Container */}
      <div className="w-full max-w-4xl relative z-10">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 shadow-lg overflow-hidden">
          {/* Feed Header */}
          <div className="p-4 border-b border-white/20">
            <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
              {selectedTab === "posts" ? (
                <>
                  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>For You Feed</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Following Feed</span>
                </>
              )}
            </h2>
            <p className="text-gray-300 text-xs mt-1">
              {selectedTab === "posts" 
                ? "Discover posts curated just for you"
                : "See what your friends are sharing"
              }
            </p>
          </div>

          {/* Feed Content */}
          <div className="p-4">
            {selectedTab === "posts" ? (
              <PostsFeed
                posts={posts}
                setPosts={setPosts}
                token={token}
                userId={userId}
              />
            ) : (
              <FollowingFeed token={token} userId={userId} />
            )}
          </div>
        </div>
      </div>

      {/* Bottom spacing for mobile navigation */}
      <div className="h-16 lg:h-6"></div>
    </div>
  );
}