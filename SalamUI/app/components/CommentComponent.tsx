import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "@remix-run/react";
import { useCookies } from "react-cookie";
import {
  getComment,
  getCommentInteractions,
  addSubComment,
  getSubComments,
  likeComment,
  dislikeComment,
  viewComment,
  deleteComment,
  getCurrentUsercommentInteraction,
  removeInteraction,
  API_BASE_URL,
} from "~/utils/api";
import likeIcon from "~/icons/like.svg";
import likedIcon from "~/icons/liked.svg";
import dislikeIcon from "~/icons/dislike.svg";
import dislikedIcon from "~/icons/disliked.svg";
import commentIcon from "~/icons/comment.svg";
import viewIcon from "~/icons/view.svg";
import deleteIcon from "~/icons/delete.svg";
import "@fortawesome/fontawesome-free/css/all.min.css";
import axios from "axios";

interface CommentData {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  media?: string;
  User: { username: string; profilePicture?: string; name?: string };
  postId: string;
}

interface InteractionData {
  likes: number;
  dislikes: number;
  views: number;
}

interface CommentProps {
  commentId: string;
  token: string;
  depth?: number;
  userId: string;
  isOnCommentPage?: boolean; // New prop to determine context
}

const CommentComponent = ({
  commentId,
  token,
  depth = 0,
  userId,
  isOnCommentPage = false, // Default to false
}: CommentProps) => {
  const [comment, setComment] = useState<CommentData | null>(null);
  const [interactions, setInteractions] = useState<InteractionData>({
    likes: 0,
    dislikes: 0,
    views: 0,
  });
  const [subCommentIds, setSubCommentIds] = useState<string[]>([]);
  const [subCommentContent, setSubCommentContent] = useState<string>("");
  const [subCommentMedia, setSubCommentMedia] = useState<File | null>(null);
  const [showAddComment, setShowAddComment] = useState<boolean>(isOnCommentPage && depth === 0);
  const [collapsed, setCollapsed] = useState<boolean>(true);
  const [interactionType, setInteractionType] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState("");
  const [cookies, setCookie] = useCookies(["viewedComments"]);
  const commentRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();

  useEffect(() => {
    fetchCommentDetails();
  }, [commentId, token]);

  // Function to check if comment is in the viewport
  const isInViewport = (element: HTMLElement | null) => {
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
      if (comment && isInViewport(commentRef.current)) {
        const hasViewed = cookies.viewedComments?.includes(comment.id);
        if (!hasViewed) {
          viewComment(comment.id, token).catch((error) =>
            console.error("Error viewing comment:", error.message)
          );
          // Set a cookie to prevent viewing for a specified time period (e.g., session)
          setCookie("viewedComments", [...(cookies.viewedComments || []), comment.id], {
            path: "/",
            expires: new Date(Date.now() + 1000 * 60 * 60 * 24), // 1 day expiration for session
          });
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Check visibility on initial render
    return () => window.removeEventListener("scroll", handleScroll);
  }, [comment, token, cookies, setCookie]);

  const fetchCommentDetails = async () => {
    try {
      const fetchedComment = await getComment(commentId, token);
      setComment(fetchedComment);
      fetchCommentInteractions(fetchedComment.id);
      fetchSubComments(fetchedComment.id, token);
    } catch (error) {
      console.error("Error fetching comment details:", error.message);
    }
  };

  const fetchCommentInteractions = async (id: string) => {
    try {
      const data = await getCommentInteractions(id, token);
      setInteractions({
        likes: data.filter((interaction) => interaction.type === "like").length,
        dislikes: data.filter((interaction) => interaction.type === "dislike")
          .length,
        views: data.filter((interaction) => interaction.type === "view").length,
      });
    } catch (error) {
      console.error("Error fetching interactions:", error.message);
    }
  };

  const fetchSubComments = async (parentId: string, token: string) => {
    try {
      const subComments = await getSubComments(parentId, token);
      const subCommentIdsArray = subComments.map((subComment) => subComment.id);
      setSubCommentIds(subCommentIdsArray);

      const subCommentDetailsPromises = subCommentIdsArray.map(
        async (subCommentId) => {
          const subCommentDetail = await getComment(subCommentId, token);
          if (subCommentDetail.media) {
            const mediaUrl = `${API_BASE_URL}:5003/media/${subCommentDetail.media}`;
            subCommentDetail.mediaUrl = mediaUrl;
          }
          return subCommentDetail;
        }
      );
      await Promise.all(subCommentDetailsPromises);
    } catch (error) {
      console.error("Error fetching subcomments:", error.message);
      setFetchError("Failed to fetch subcomments.");
    }
  };

  const handleSubmitSubComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (comment?.id && token) {
      try {
        await addSubComment(
          comment.postId,
          comment.id,
          subCommentContent,
          subCommentMedia,
          token
        );
        setSubCommentContent("");
        setSubCommentMedia(null);
        fetchSubComments(comment.id, token);
        setShowAddComment(false); // Close the form after submission
      } catch (error) {
        console.error("Error adding subcomment:", error.message);
        setFetchError("Failed to add subcomment.");
      }
    } else {
      console.error("Comment ID or token is missing.");
    }
  };

  const handleLike = async () => {
    if (comment?.id && token) {
      try {
        const current = await getCurrentUsercommentInteraction(
          comment.id,
          token
        );
        if (current && current.type === "like") {
          await removeInteraction(current.id, token);
          setInteractionType(null);
        } else {
          await likeComment(comment.id, token);
          setInteractionType("like");
        }
        fetchCommentInteractions(comment.id);
      } catch (error) {
        console.error("Error liking comment:", error.message);
      }
    }
  };

  const handleDislike = async () => {
    if (comment?.id && token) {
      try {
        const current = await getCurrentUsercommentInteraction(
          comment.id,
          token
        );
        if (current && current.type === "dislike") {
          await removeInteraction(current.id, token);
          setInteractionType(null);
        } else {
          await dislikeComment(comment.id, token);
          setInteractionType("dislike");
        }
        fetchCommentInteractions(comment.id);
      } catch (error) {
        console.error("Error disliking comment:", error.message);
      }
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment(commentId, token);
      setComment(null);
    } catch (error) {
      console.error("Error deleting comment:", error.message);
      setFetchError("Failed to delete comment.");
    }
  };

  const toggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  const handleNavigateToComment = () => {
    navigate(`/comment/${commentId}`);
  };

  const toggleAddComment = () => {
    setShowAddComment(!showAddComment);
  };

  // Handle reply button click - different behavior based on context
  const handleReplyClick = () => {
    if (isOnCommentPage) {
      // If on comment page, toggle the reply form
      toggleAddComment();
    } else {
      // If not on comment page, navigate to comment page
      navigate(`/comment/${commentId}`);
    }
  };

  // Handle profile picture error
  const handleProfilePictureError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const target = event.target as HTMLImageElement;
    if (target.src !== "/default_profile_pic.png") {
      target.src = "/default_profile_pic.png";
    }
  };

  // Handle media error
  const handleMediaError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const target = event.target as HTMLImageElement;
    if (target.src !== "/default_media.png") {
      target.src = "/default_media.png";
    }
  };

  if (!comment) return <p className="text-gray-300">Loading comment...</p>;

  const isVideo = (url: string) => {
    const videoExtensions = [".mp4", ".webm", ".ogg"];
    return videoExtensions.some((ext) => url.includes(ext));
  };

  const hasReplies = subCommentIds.length > 0;

  return (
    <div className={`relative ${depth > 0 ? 'ml-8 mt-2' : 'mt-4'}`}>
      {/* Clear threading lines - properly positioned */}
      {depth > 0 && (
        <div className="absolute -left-6 top-0 w-8 h-16 pointer-events-none">
          {/* Vertical line from parent - stops at this comment */}
          <div className="absolute left-3 top-0 w-0.5 h-8 bg-gray-500"></div>
          {/* Horizontal connector to this comment's profile */}
          <div className="absolute left-3 top-8 w-3 h-0.5 bg-gray-500"></div>
          {/* Small dot at connection point */}
          <div className="absolute left-2.5 top-7.5 w-1 h-1 bg-gray-500 rounded-full"></div>
        </div>
      )}

      {/* Comment content - streamlined design */}
      <div 
        ref={commentRef}
        className="w-full py-3 hover:bg-gray-800/20 transition-all duration-200 rounded-lg group"
      >
        {/* Header - more compact */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start space-x-3">
            <img
              src={comment.User?.profilePicture || "/default_profile_pic.png"}
              alt={comment.User?.username || "Anonymous"}
              className="w-10 h-10 rounded-full cursor-pointer border border-gray-600/50 hover:border-gray-500 transition-all"
              onClick={() => navigate(`/user/${comment.userId}`)}
              onError={handleProfilePictureError}
            />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 flex-wrap">
                <h2
                  className="text-base font-semibold cursor-pointer text-white hover:text-gray-300 transition-colors"
                  onClick={() => navigate(`/user/${comment.userId}`)}
                >
                  {comment.User?.name || "Anonymous"}
                </h2>
                <div className="flex items-center space-x-1 text-sm text-gray-400">
                  <span>@{comment.User?.username || "unknown"}</span>
                  <span>•</span>
                  <span>{new Date(comment.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Delete Button - more subtle */}
          {comment.userId === userId && (
            <button
              className="text-red-400 hover:text-red-300 p-2 rounded-full bg-red-500/10 hover:bg-red-500/20 transition-all opacity-0 group-hover:opacity-100"
              onClick={() => handleDeleteComment(comment.id)}
            >
              <img src={deleteIcon} alt="Delete" className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content - aligned with profile for clean look */}
        <div className="ml-13">
          <p
            className="text-white cursor-pointer mb-3 leading-relaxed text-base"
            onClick={handleNavigateToComment}
          >
            {comment.content}
          </p>

          {/* Media - more compact */}
          {comment.media &&
            (isVideo(comment.media) ? (
              <video
                controls
                className="rounded-lg border border-gray-600/50 w-full h-auto max-h-80 mb-3"
              >
                <source src={comment.media} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            ) : (
              <img
                src={comment.media}
                alt="Comment media"
                className="rounded-lg border border-gray-600/50 w-full h-auto max-h-80 object-contain mb-3"
                onError={handleMediaError}
              />
            ))}

          {/* Actions - more minimal, no border */}
          <div className="pt-2">
            <div className="flex items-center space-x-6">
              <button
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-full transition-all duration-200 ${
                  interactionType === "like"
                    ? "text-white bg-gray-700/50"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/30"
                }`}
                onClick={handleLike}
              >
                <img
                  src={interactionType === "like" ? likedIcon : likeIcon}
                  alt="Like"
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">{interactions.likes}</span>
              </button>
              
              <button
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-full transition-all duration-200 ${
                  interactionType === "dislike"
                    ? "text-white bg-gray-700/50"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/30"
                }`}
                onClick={handleDislike}
              >
                <img
                  src={interactionType === "dislike" ? dislikedIcon : dislikeIcon}
                  alt="Dislike"
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">{interactions.dislikes}</span>
              </button>
              
              <span className="flex items-center space-x-1 text-gray-400">
                <img src={viewIcon} alt="View" className="w-4 h-4" />
                <span className="text-sm font-medium">{interactions.views}</span>
              </span>
              
              {/* Updated Reply Button - behavior depends on context */}
              <button
                className="flex items-center space-x-1 text-gray-400 hover:text-white hover:bg-gray-800/30 px-3 py-1.5 rounded-full transition-all duration-200"
                onClick={handleReplyClick}
              >
                <img src={commentIcon} alt="Comment" className="w-4 h-4" />
                <span className="text-sm font-medium">Reply</span>
              </button>
            </div>
          </div>

          {/* Reply Form - only show when on comment page and showAddComment is true */}
          {isOnCommentPage && showAddComment && (
            <div className="mt-4 p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
              <div className="flex space-x-3">
                <img
                  src={comment.User?.profilePicture || "/default_profile_pic.png"}
                  alt="Your avatar"
                  className="w-10 h-10 rounded-full border border-gray-600/50 flex-shrink-0"
                  onError={handleProfilePictureError}
                />
                <div className="flex-1">
                  <textarea
                    value={subCommentContent}
                    onChange={(e) => {
                      setSubCommentContent(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = e.target.scrollHeight + "px";
                    }}
                    placeholder="Write a reply..."
                    className="w-full p-3 border border-gray-600/50 rounded-lg bg-gray-900/50 text-white placeholder-gray-400 focus:ring-1 focus:ring-gray-500 focus:border-gray-500 transition-all duration-200 resize-none text-base"
                    style={{ overflow: "hidden", fontSize: "16px" }}
                  />
                  
                  <div className="flex items-center justify-between mt-3">
                    <label className="cursor-pointer p-2 rounded-full bg-gray-700/50 hover:bg-gray-600/50 transition-colors">
                      <input
                        type="file"
                        onChange={(e) =>
                          setSubCommentMedia(e.target.files?.[0] || null)
                        }
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
                        className="w-4 h-4 text-gray-300"
                      >
                        <path d="M16 8l-7 7a3 3 0 01-4.243-4.243l7-7a5 5 0 017.071 7.071l-7.5 7.5a7 7 0 01-9.9-9.9l7.5-7.5" />
                      </svg>
                    </label>
                    
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowAddComment(false)}
                        className="px-4 py-2 rounded-full bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white transition-all text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmitSubComment}
                        className="bg-white text-black px-4 py-2 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-500 transition-all duration-200 font-medium text-sm"
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                  
                  {fetchError && (
                    <p className="text-red-400 text-sm mt-2">{fetchError}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Replies Section - clean tree connection */}
      {hasReplies && (
        <div className="mt-2 relative">
          {/* Collapse button - clean positioning */}
          <div className="flex items-center mb-2 ml-13 relative">          
            <button
              onClick={toggleCollapse}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-gray-800/30 hover:bg-gray-700/40 transition-all duration-200 text-gray-300 hover:text-white text-sm relative z-10"
            >
              <svg
                className={`w-4 h-4 transform transition-transform duration-200 ${collapsed ? 'rotate-0' : 'rotate-90'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="font-medium">
                {collapsed ? `Show ${subCommentIds.length} replies` : `Hide ${subCommentIds.length} replies`}
              </span>
            </button>
          </div>

          {/* Nested Comments - with proper vertical line continuation */}
          {!collapsed && (
            <div className="space-y-1 relative">
              {subCommentIds.map((subCommentId, index) => (
                <div key={subCommentId} className="relative">
                  {/* Vertical continuation line for nested comments */}
                  {index < subCommentIds.length - 1 && (
                    <div className="absolute left-5 top-8 w-0.5 h-full pointer-events-none bg-gray-500"></div>
                  )}
                  
                  <CommentComponent
                    commentId={subCommentId}
                    token={token}
                    depth={depth + 1}
                    userId={userId}
                    isOnCommentPage={isOnCommentPage}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentComponent;