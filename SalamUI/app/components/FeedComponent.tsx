import { useEffect, useState, useRef } from "react";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  getPost,
  getProfilePicture,
  getInteractions,
  sendViewInteraction,
  getCommentsForPost,
  addComment,
  likePost,
  dislikePost,
  deletePost,
  getCurrentUserInteraction,
  removeInteraction,
} from "../utils/api";
import CommentComponent from "~/components/CommentComponent";
import ReactPlayer from "react-player";
import { useCookies } from "react-cookie";
import likeIcon from "~/icons/like.svg";
import likedIcon from "~/icons/liked.svg";
import dislikeIcon from "~/icons/dislike.svg";
import dislikedIcon from "~/icons/disliked.svg";
import commentIcon from "~/icons/comment.svg";
import viewIcon from "~/icons/view.svg";
import shareIcon from "~/icons/share.svg";
import deleteIcon from "~/icons/delete.svg";
import React from "react";
import UrlPreview from "~/components/UrlPreview";

function makeUrlsClickable(text) {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const isVideo = (url) => {
    const videoExtensions = [
      ".mp4",
      ".mov",
      ".m4v",
      ".webm",
      ".ogg",
      ".mkv",
      ".avi",
      ".wmv",
      ".flv",
      ".m4a",
      ".3gp",
      ".3g2",
      ".rmvb",
      ".ts",
      ".vob",
    ];
    const urlWithoutParams = url.split(/[?#]/)[0];
    return videoExtensions.some((ext) => urlWithoutParams.endsWith(ext));
  };

  const isAudio = (url) => {
    const audioExtensions = [".mp3", ".wav", ".ogg", ".m4a"];
    const urlWithoutParams = url.split("?")[0];
    return audioExtensions.some((ext) => urlWithoutParams.endsWith(ext));
  };

  return text.split(urlPattern).map((part, index) => {
    if (urlPattern.test(part)) {
      const isVideoUrl = isVideo(part);
      const isAudioUrl = isAudio(part);
      return (
        <span key={index}>
          <a
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            {part}
          </a>
          {!isVideoUrl && !isAudioUrl && <UrlPreview url={part} />}
        </span>
      );
    }
    return part;
  });
}

const FeedComponent = ({ postId, token, userId }) => {
  const [post, setPost] = useState(null);
  const [profilePicture, setProfilePicture] = useState("");
  const [interactions, setInteractions] = useState([]);
  const [comments, setComments] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fetchError, setFetchError] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [commentContent, setCommentContent] = useState("");
  const [commentMedia, setCommentMedia] = useState(null);
  const [cookies, setCookie] = useCookies(["viewedPosts"]);
  const [interactionType, setInteractionType] = useState(null);
  const [isPrivatePostDenied, setIsPrivatePostDenied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const postRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPostDetails = async () => {
      try {
        setIsLoading(true);
        setFetchError(null);
        setIsPrivatePostDenied(false);

        const fetchedPost = await getPost(postId, token);
        
        if (!fetchedPost) {
          setIsPrivatePostDenied(true);
          setIsLoading(false);
          return;
        }

        setPost(fetchedPost);
        const profilePic = await getProfilePicture(fetchedPost.userId, token);
        setProfilePicture(profilePic);

        const postInteractions = await getInteractions(postId, token);
        setInteractions(postInteractions || []);

        // Set the interaction type based on current user's interaction
        const currentUserInteraction = await getCurrentUserInteraction(
          postId,
          token
        );
        if (currentUserInteraction) {
          setInteractionType(currentUserInteraction.type);
        }

        const commentsResponse = await getCommentsForPost(postId, token);
        setComments(commentsResponse.comments);
        setTotalPages(commentsResponse.totalPages);
        
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching post details:", error.message);
        
        // Check if it's a privacy/permission error
        if (error.status === 403 || error.status === 401) {
          setIsPrivatePostDenied(true);
        } else {
          setFetchError("Failed to load post. Please try again.");
        }
        
        setIsLoading(false);
      }
    };

    fetchPostDetails();
  }, [postId, token]);

  // Function to check if post is in the viewport
  const isInViewport = (element) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight)
    );
  };

  useEffect(() => {
    const handleScroll = () => {
      if (post && isInViewport(postRef.current)) {
        const hasViewed = cookies.viewedPosts?.includes(post.id);
        if (!hasViewed) {
          sendViewInteraction(post.id, token).catch((error) =>
            console.error("Error viewing post:", error.message)
          );
          // Set a cookie to prevent viewing for a specified time period (e.g., session)
          setCookie("viewedPosts", [...(cookies.viewedPosts || []), post.id], {
            path: "/",
            expires: new Date(Date.now() + 1000 * 60 * 60 * 24), // 1 day expiration for session
          });
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Check visibility on initial render
    return () => window.removeEventListener("scroll", handleScroll);
  }, [post, token, cookies, setCookie]);

  const fetchInteractions = async () => {
    if (token && post?.id) {
      try {
        const data = await getInteractions(post.id, token);
        setInteractions(data || []);

        // Set the interaction type based on current user's interaction
        const currentUserInteraction = await getCurrentUserInteraction(
          post.id,
          token
        );
        if (currentUserInteraction) {
          setInteractionType(currentUserInteraction.type);
        } else {
          setInteractionType(null);
        }
      } catch {
        setFetchError("Failed to fetch interactions.");
      }
    }
  };

  const handleInteraction = async (type) => {
    if (token && post?.id) {
      try {
        if (type === interactionType) {
          // Fetch current interaction status again before removing
          const current = await getCurrentUserInteraction(post.id, token);
          if (current) {
            await removeInteraction(current.id, token);
            setInteractionType(null);
          }
        } else {
          if (type === "like") await likePost(post.id, token);
          else if (type === "dislike") await dislikePost(post.id, token);
          setInteractionType(type);
        }

        // Refetch interactions after update
        fetchInteractions();
      } catch (error) {
        console.error("Failed to update interactions:", error.message);
        setFetchError("Failed to update interactions.");
      }
    }
  };

  const toggleComments = () => {
    setShowComments(!showComments);
  };

  const loadMoreComments = async () => {
    if (token && post?.id && currentPage < totalPages) {
      try {
        const nextPage = currentPage + 1;
        const response = await getCommentsForPost(post.id, token, nextPage);
        setComments((prevComments) => [...prevComments, ...response.comments]);
        setCurrentPage(nextPage);
      } catch (error) {
        console.error("Error loading more comments:", error.message);
        setFetchError("Failed to load more comments.");
      }
    }
  };

  const handleSubmitComment = async (event) => {
    event.preventDefault();
    if (post?.id && token) {
      try {
        await addComment(post.id, commentContent, commentMedia, token);
        setCommentContent(""); // Clear form fields
        setCommentMedia(null);
        const commentsResponse = await getCommentsForPost(postId, token); // Refresh comments list
        setComments(commentsResponse.comments);
      } catch (error) {
        console.error("Error adding comment:", error.message);
        setFetchError("Failed to add comment.");
      }
    }
  };

  const handleDeletePost = async () => {
    if (post?.id && token) {
      try {
        await deletePost(post.id, token);
        // Update the state to nullify the deleted post
        setPost(null);
      } catch (error) {
        console.error("Error deleting post:", error.message);
        setFetchError("Failed to delete post.");
      }
    }
  };

  const handleShare = () => {
    const postUrl = window.location.href;

    if (navigator.share) {
      navigator
        .share({
          title: "Check out this post",
          text: "Take a look at this amazing post I found!",
          url: postUrl,
        })
        .then(() => console.log("Post shared successfully"))
        .catch((error) => console.error("Error sharing post:", error));
    } else if (navigator.clipboard) {
      navigator.clipboard
        .writeText(postUrl)
        .then(() => {
          alert("Post link copied to clipboard!");
        })
        .catch((err) => console.error("Failed to copy: ", err));
    } else {
      // Fallback for older browsers or environments without clipboard support
      const textarea = document.createElement("textarea");
      textarea.value = postUrl;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        alert("Post link copied to clipboard!");
      } catch (err) {
        console.error("Fallback: Oops, unable to copy", err);
      }
      document.body.removeChild(textarea);
    }
  };

  const navigateToUserPage = (userId) => {
    navigate(`/user/${userId}`);
  };

  const navigateToPostPage = () => {
    navigate(`/posts/${post.id}`);
  };

  const [showFullContent, setShowFullContent] = useState(false);

  const handleReadMore = () => setShowFullContent(true);

  const contentPreview = post?.content?.slice(0, 300);

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        <p className="ml-3 text-gray-300">Loading post...</p>
      </div>
    );
  }

  // Private post access denied - return null to hide component completely
  if (isPrivatePostDenied) {
    return null;
  }

  // Error state
  if (fetchError && !post) {
    return (
      <div className="w-full p-6 text-center">
        <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4">
          <p className="text-red-400">{fetchError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 text-sm text-gray-300 hover:text-white underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!post) return null;

  const likeCount = interactions.filter((i) => i.type === "like")?.length || 0;
  const dislikeCount =
    interactions.filter((i) => i.type === "dislike")?.length || 0;
  const viewCount = interactions.filter((i) => i.type === "view")?.length || 0;

  const isVideo = (url) => {
    const videoExtensions = [
      ".mp4",
      ".mov",
      ".m4v",
      ".webm",
      ".ogg",
      ".mkv",
      ".avi",
      ".wmv",
      ".flv",
      ".m4a",
      ".3gp",
      ".3g2",
      ".rmvb",
      ".ts",
      ".vob",
    ];
    const urlWithoutParams = url.split(/[?#]/)[0];
    return videoExtensions.some((ext) => urlWithoutParams.endsWith(ext));
  };
  
  const isAudio = (url) => {
    const audioExtensions = [".mp3", ".wav", ".ogg", ".m4a"];
    const urlWithoutParams = url.split("?")[0];
    return audioExtensions.some((ext) => urlWithoutParams.endsWith(ext));
  };

  return (
    <div className="w-full" ref={postRef}>
      <div className="p-6">
        <div className="flex items-center space-x-4 mb-4">
          <img
            src={profilePicture || "/default_profile_pic.png"}
            alt={post?.User?.username || "Anonymous"}
            className="w-12 h-12 rounded-full cursor-pointer border-2 border-white/20"
            onClick={() => navigateToUserPage(post.userId)}
            onError={(e) => (e.currentTarget.src = "/default_profile_pic.png")}
          />
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h2
                className="text-lg font-semibold cursor-pointer text-white hover:text-gray-200 transition-colors"
                onClick={() => navigateToUserPage(post.userId)}
              >
                {post?.User?.name || "Anonymous"}
              </h2>
              {post?.User?.profilePublic === false && (
                <span className="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded-full border border-yellow-600/30">
                  Private Profile
                </span>
              )}
            </div>
            <p className="text-gray-300 text-sm">
              @{post?.User?.username || "unknown"}
            </p>
          </div>
          {post?.userId === userId && (
            <button
              className="text-red-400 hover:text-red-300 flex items-center space-x-1 px-3 py-1 bg-white/10 hover:bg-white/20 transition-colors"
              onClick={handleDeletePost}
            >
              <img src={deleteIcon} alt="Delete" className="w-4 h-4" />
              <span className="text-sm">Delete</span>
            </button>
          )}
        </div>

        <div className="mb-4">
          <p
            className="text-gray-100 cursor-pointer break-words whitespace-pre-wrap"
            onClick={navigateToPostPage}
          >
            {post?.mediaUrl && isVideo(post.mediaUrl)
              ? post?.content
              : makeUrlsClickable(
                  showFullContent ? post?.content : contentPreview
                )}
            {post?.content?.length > 300 && !showFullContent && (
              <button
                onClick={handleReadMore}
                className="text-indigo-400 hover:text-indigo-300 ml-2 transition-colors"
              >
                Read More
              </button>
            )}
          </p>
        </div>

        {post?.mediaUrl &&
          (isVideo(post.mediaUrl) ? (
            <div className="flex justify-center mb-4">
              <div className="overflow-hidden border border-white/20">
                <ReactPlayer
                  url={post.mediaUrl}
                  controls
                  width="100%"
                  height="auto"
                  config={{
                    file: { attributes: { controlsList: "nodownload" } },
                  }}
                  style={{ maxWidth: "400px", maxHeight: "400px" }}
                />
              </div>
            </div>
          ) : isAudio(post.mediaUrl) ? (
            <div className="flex justify-center mb-4">
              <audio
                controls
                src={post.mediaUrl}
                className="bg-white/5 border border-white/20"
                style={{ maxWidth: "400px" }}
              />
            </div>
          ) : (
            <div className="flex justify-center mb-4">
              <img
                src={post.mediaUrl}
                alt="Post Media"
                className="border border-white/20 max-w-full"
                loading="lazy"
                style={{ maxWidth: "400px", maxHeight: "400px" }}
              />
            </div>
          ))}

        {!post?.mediaUrl && ReactPlayer.canPlay(post?.content) && (
          <div className="flex justify-center mb-4">
            <div className="overflow-hidden border border-white/20">
              <ReactPlayer
                url={post.content}
                width="100%"
                height="auto"
                controls
                style={{ maxWidth: "400px", maxHeight: "400px" }}
              />
            </div>
          </div>
        )}

        <p className="text-gray-400 text-sm mb-4">
          {new Date(post?.createdAt || "").toLocaleString()}
        </p>

        {/* Updated Facebook-style interaction bar */}
        <div className="border-t border-white/20 pt-3">
          <div className="flex items-center justify-around">
            <button
              className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-white/10 flex-1 ${
                interactionType === "like"
                  ? "text-blue-400"
                  : "text-gray-300 hover:text-blue-400"
              }`}
              onClick={() => handleInteraction("like")}
            >
              <img
                src={interactionType === "like" ? likedIcon : likeIcon}
                alt="Like"
                className="w-6 h-6"
              />
              <span className="font-medium">{likeCount}</span>
            </button>
            
            <button
              className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-white/10 flex-1 ${
                interactionType === "dislike"
                  ? "text-red-400"
                  : "text-gray-300 hover:text-red-400"
              }`}
              onClick={() => handleInteraction("dislike")}
            >
              <img
                src={interactionType === "dislike" ? dislikedIcon : dislikeIcon}
                alt="Dislike"
                className="w-6 h-6"
              />
              <span className="font-medium">{dislikeCount}</span>
            </button>
            
            <div className="flex items-center justify-center space-x-2 px-3 py-2 text-gray-400 flex-1">
              <img src={viewIcon} alt="View" className="w-6 h-6" />
              <span className="font-medium">{viewCount || 0}</span>
            </div>
            
            <button
              className="flex items-center justify-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-white/10 text-gray-300 hover:text-white flex-1"
              onClick={toggleComments}
            >
              <img src={commentIcon} alt="Comment" className="w-6 h-6" />
              <span className="font-medium">{comments?.length || 0}</span>
            </button>
            
            <button
              className="flex items-center justify-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-white/10 text-gray-300 hover:text-white flex-1"
              onClick={handleShare}
            >
              <img src={shareIcon} alt="Share" className="w-6 h-6" />
              <span className="font-medium">Share</span>
            </button>
          </div>
        </div>

        {fetchError && <p className="text-red-400 text-sm mt-2">{fetchError}</p>}
        
        {/* Full-width comments section */}
        {showComments && (
          <div className="mt-4 pt-4 border-t border-white/20">
            <form onSubmit={handleSubmitComment} className="relative mb-4">
              <textarea
                value={commentContent}
                onChange={(e) => {
                  setCommentContent(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                placeholder="Add a comment..."
                className="w-full p-4 border border-white/20 bg-white/5 backdrop-blur-sm text-white placeholder-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 rounded-lg"
                style={{ overflow: "hidden", resize: "none", fontSize: "16px" }}
              />

              <div className="flex items-center justify-between mt-3">
                <label className="cursor-pointer p-2 bg-white/10 hover:bg-white/20 transition-colors rounded-lg">
                  <input
                    type="file"
                    onChange={(e) => setCommentMedia(e.target.files[0])}
                    className="hidden"
                  />
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-5 h-5 text-gray-300"
                  >
                    <path d="M16 8l-7 7a3 3 0 01-4.243-4.243l7-7a5 5 0 017.071 7.071l-7.5 7.5a7 7 0 01-9.9-9.9l7.5-7.5" />
                  </svg>
                </label>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
                >
                  Comment
                </button>
              </div>
              {fetchError && (
                <p className="text-red-400 text-sm mt-2">{fetchError}</p>
              )}
            </form>

            <div className="space-y-4">
              {comments?.map((comment) => (
                <div key={comment.id} className="w-full">
                  <CommentComponent
                    commentId={comment.id}
                    token={token}
                    userId={userId}
                  />
                </div>
              ))}
            </div>
            
            {totalPages > currentPage && (
              <button
                onClick={loadMoreComments}
                className="w-full mt-4 p-3 bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 transition-colors rounded-lg"
              >
                Load More Comments
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedComponent;