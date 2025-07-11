import likeIcon from "~/icons/like.svg";
import likedIcon from "~/icons/liked.svg";
import dislikeIcon from "~/icons/dislike.svg";
import dislikedIcon from "~/icons/disliked.svg";
import commentIcon from "~/icons/comment.svg";
import viewIcon from "~/icons/view.svg";
import shareIcon from "~/icons/share.svg";
import deleteIcon from "~/icons/delete.svg";
import "@fortawesome/fontawesome-free/css/all.min.css";
import UrlPreview from "~/components/UrlPreview";
import ReactPlayer from "react-player";
import { fetchMetadata } from "~/utils/api";

import {
  LoaderFunction,
  ActionFunction,
  json,
  redirect,
} from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState, useEffect, useRef } from "react";
import {
  getPost,
  getProfilePicture,
  getInteractions,
  sendViewInteraction,
  likePost,
  dislikePost,
  getCommentsForPost,
  addComment,
  deletePost,
  deleteComment,
  getCurrentUserInteraction, // Import the new function
  removeInteraction, // Import the new function
} from "~/utils/api";
import { getSession } from "~/sessions";

import CommentComponent from "~/components/CommentComponent";

import { useCookies } from "react-cookie";

interface PostData {
  id: string;
  userId: string;
  content: string;
  media?: string;
  createdAt: string;
  User: {
    name: string; // Add name here
    username: string;
  };
}

interface InteractionData {
  id: number;
  userId: string;
  postId: string;
  type: string;
}

interface CommentData {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  media?: string;
  User: {
    username: string;
    profilePicture?: string;
  };
}

interface LoaderData {
  post?: PostData;
  profilePicture?: string;
  interactions?: InteractionData[];
  comments?: CommentData[];
  totalPages?: number;
  error?: string;
  token?: string;
  userId?: string;
  currentInteraction?: InteractionData; // Include currentInteraction
}

interface ActionData {
  error?: string;
  success?: boolean;
}

export const loader: LoaderFunction = async ({ params, request }) => {
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("token");
  
  if (!token) return redirect("/sign-in");
  
  const postId = params.postId as string;
  if (!postId) {
    return json<LoaderData>({ error: "Invalid post ID." }, { status: 400 });
  }

  try {
    const postResponse = await getPost(postId, token);
    const profilePictureResponse = await getProfilePicture(postResponse.userId, token);
    const interactionsResponse = await getInteractions(postId, token);
    const commentsResponse = await getCommentsForPost(postId, token);
    const currentInteractionResponse = await getCurrentUserInteraction(postId, token);

    // Clean up post data - only include serializable fields
    const post = {
      id: postResponse.id || postResponse._id,
      userId: postResponse.userId,
      content: postResponse.content,
      media: postResponse.media,
      createdAt: postResponse.createdAt,
      User: {
        name: postResponse.User.name,
        username: postResponse.User.username,
      }
    };

    // Clean up interactions data
    const interactions = Array.isArray(interactionsResponse) 
      ? interactionsResponse.map(interaction => ({
          id: interaction.id || interaction._id,
          userId: interaction.userId,
          postId: interaction.postId,
          type: interaction.type
        }))
      : [];

    // Clean up comments data
    const comments = Array.isArray(commentsResponse.comments)
      ? commentsResponse.comments.map(comment => ({
          id: comment.id || comment._id,
          userId: comment.userId,
          content: comment.content,
          createdAt: comment.createdAt,
          media: comment.media,
          User: {
            username: comment.User.username,
            profilePicture: comment.User.profilePicture,
          }
        }))
      : [];

    // Clean up current interaction data
    const currentInteraction = currentInteractionResponse ? {
      id: currentInteractionResponse.id || currentInteractionResponse._id,
      userId: currentInteractionResponse.userId,
      postId: currentInteractionResponse.postId,
      type: currentInteractionResponse.type
    } : null;

    // Ensure profilePicture is a string or null
    const profilePicture = typeof profilePictureResponse === 'string' 
      ? profilePictureResponse 
      : profilePictureResponse?.url || null;

    return json<LoaderData>({
      post,
      profilePicture,
      interactions,
      comments,
      totalPages: commentsResponse.totalPages || 0,
      token,
      userId: session.get("userId"),
      currentInteraction,
    });
  } catch (error) {
    console.error("Error fetching post or interactions:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return json<LoaderData>(
      { error: "Failed to retrieve post or interactions." },
      { status: 500 }
    );
  }
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const interactionType = formData.get("interactionType") as string;
  const postId = formData.get("postId") as string;

  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("token");

  if (!token) {
    return json<ActionData>(
      { error: "User is not authenticated" },
      { status: 401 }
    );
  }
  if (!interactionType || !postId) {
    return json<ActionData>({ error: "Invalid form data" }, { status: 400 });
  }

  try {
    switch (interactionType) {
      case "like":
        await likePost(postId, token);
        break;
      case "dislike":
        await dislikePost(postId, token);
        break;
      case "view":
        await sendViewInteraction(postId, token);
        break;
      default:
        return json<ActionData>(
          { error: "Invalid interaction type" },
          { status: 400 }
        );
    }
    return json<ActionData>({ success: true });
  } catch {
    return json<ActionData>(
      { error: "Failed to send interaction" },
      { status: 500 }
    );
  }
};

export default function PostPage() {
  const {
    post,
    profilePicture,
    interactions: initialInteractions,
    comments,
    error,
    token,
    userId,
    totalPages,
    currentInteraction, // Destructure currentInteraction from loader data
  } = useLoaderData<LoaderData>();

  const [currentComments, setCurrentComments] = useState(comments || []);
  const [currentPage, setCurrentPage] = useState(1);
  const [showComments, setShowComments] = useState(false);
  const [interactionType, setInteractionType] = useState(
    currentInteraction?.type || null
  ); // State to store the current interaction type
  const [interactions, setInteractions] = useState(initialInteractions || []); // Initialize interactions state
  const navigate = useNavigate();
  const postRef = useRef(null);
  const [cookies, setCookie] = useCookies(["viewedPosts"]);
  const [isClient, setIsClient] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);

  const toggleComments = () => {
    setShowComments(!showComments);
  };
  useEffect(() => {
    setIsClient(true);
  }, []);
  useEffect(() => {
    const isInViewport = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.bottom <=
          (window.innerHeight || document.documentElement.clientHeight)
      );
    };

    const handleScroll = () => {
      if (post && isInViewport(postRef.current)) {
        const hasViewed = cookies.viewedPosts?.includes(post.id);
        if (!hasViewed) {
          sendViewInteraction(post.id, token).catch((error) =>
            console.error("Error viewing post:", error.message)
          );
          setCookie("viewedPosts", [...(cookies.viewedPosts || []), post.id], {
            path: "/",
            expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
          });
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [post, token, cookies, setCookie]);

  const handleInteraction = async (type) => {
    if (token && post?.id) {
      try {
        const updatedInteractions = await getInteractions(post.id, token);

        // Check if there is an existing interaction of the same type
        const existingInteraction = updatedInteractions.find(
          (interaction) =>
            interaction.type === type && interaction.userId === userId
        );

        if (existingInteraction) {
          // Remove the existing interaction
          await removeInteraction(existingInteraction.id, token);
          setInteractionType(null);
        } else {
          // Add a new interaction
          if (type === "like") await likePost(post.id, token);
          else if (type === "dislike") await dislikePost(post.id, token);
          setInteractionType(type);
        }

        // Refetch interactions after update
        const newInteractions = await getInteractions(post.id, token);
        setInteractions(newInteractions);
      } catch (error) {
        console.error("Failed to update interactions:", error.message);
      }
    }
  };

  const handleSubmitComment = async (event) => {
    event.preventDefault();
    const content = event.target.elements.content.value;
    const media = event.target.elements.media.files[0];

    if (post.id && token) {
      try {
        await addComment(post.id, content, media, token);
        const commentsResponse = await getCommentsForPost(post.id, token);
        setCurrentComments(commentsResponse.comments);
        event.target.reset();
      } catch (error) {
        console.error("Error adding comment:", error.message);
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

  const loadMoreComments = async () => {
    if (token && post?.id && currentPage < totalPages) {
      try {
        const nextPage = currentPage + 1;
        const response = await getCommentsForPost(post.id, token, nextPage);
        setCurrentComments((prevComments) => [
          ...prevComments,
          ...response.comments,
        ]);
        setCurrentPage(nextPage);
      } catch (error) {
        console.error("Error loading more comments:", error.message);
      }
    }
  };

  const handleDeletePost = async () => {
    if (post?.id && token) {
      try {
        await deletePost(post.id, token);
        navigate("/home");
      } catch (error) {
        console.error("Error deleting post:", error.message);
      }
    }
  };

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-gray-500">Post not found.</p>
      </div>
    );
  }
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
    const urlWithoutParams = url.split(/[?#]/)[0];
    return audioExtensions.some((ext) => urlWithoutParams.endsWith(ext));
  };

  const [showFullContent, setShowFullContent] = useState(false);

  const handleReadMore = () => setShowFullContent(true);

  const handleMediaClick = (url) => {
    setSelectedMedia(url);
    setIsModalOpen(true);
  };
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedMedia(null);
  };

  const contentPreview = post?.content?.slice(0, 300);

  const navigateToUserPage = (userId) => {
    navigate(`/user/${userId}`);
  };

  function UrlPreview({ url }) {
    const [metadata, setMetadata] = useState(null);

    useEffect(() => {
      async function getMetadata() {
        const data = await fetchMetadata(url);
        setMetadata(data);
      }
      getMetadata();
    }, [url]);

    if (!metadata) return null;

    return (
      <div className="border rounded p-2 mt-2 bg-gray-800">
        <a
          href={metadata.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500"
        >
          {metadata.image && (
            <img
              src={metadata.image}
              alt={metadata.title}
              className="w-full h-32 object-cover rounded mb-2"
            />
          )}
          <h4 className="text-white font-bold">{metadata.title}</h4>
          <p className="text-gray-400">{metadata.description}</p>
        </a>
      </div>
    );
  }

  function makeUrlsClickable(text) {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    return text.split(urlPattern).map((part, index) => {
      if (urlPattern.test(part)) {
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
            <UrlPreview url={part} />
          </span>
        );
      }
      return part;
    });
  }

return (
  <div className="flex flex-col items-center justify-start min-h-screen text-white px-0.5 py-3 lg:p-3 pt-16 lg:pt-6 relative">
    {/* Post Container */}
    <div className="w-full max-w-4xl mb-8 relative z-10">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg overflow-hidden">
        {/* Post Header */}
        <div className="p-6 border-b border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                className="p-2 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 text-gray-300 hover:text-white hover:bg-white/20 transition-all duration-200"
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
              </button>
              <img
                src={profilePicture || "/default_profile_pic.png"}
                alt={post?.User?.username || "Anonymous"}
                className="w-12 h-12 rounded-full cursor-pointer border-2 border-white/20 hover:border-white/40 transition-all duration-200"
                onClick={() => navigateToUserPage(post.userId)}
                onError={(e) =>
                  (e.currentTarget.src = "/default_profile_pic.png")
                }
              />
              <div>
                <h2
                  className="text-xl font-semibold cursor-pointer hover:text-indigo-300 transition-colors duration-200"
                  onClick={() => navigateToUserPage(post.userId)}
                >
                  {post?.User?.name || "Anonymous"}
                </h2>
                <p className="text-gray-400">
                  @{post?.User?.username || "unknown"}
                </p>
              </div>
            </div>
            {post?.userId === userId && (
              <button
                className="flex items-center space-x-2 px-4 py-2 bg-red-500/20 backdrop-blur-lg rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/30 hover:text-red-200 transition-all duration-200"
                onClick={handleDeletePost}
              >
                <img
                  src={deleteIcon}
                  alt="Delete"
                  className="w-5 h-5"
                />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>

        {/* Post Content */}
        <div className="p-6">
          <div
            className="text-lg cursor-pointer break-words whitespace-pre-wrap leading-relaxed"
            onClick={() => setShowFullContent(!showFullContent)}
          >
            {showFullContent
              ? makeUrlsClickable(post?.content)
              : makeUrlsClickable(contentPreview)}
            {post?.content?.length > 300 && !showFullContent && (
              <button
                onClick={handleReadMore}
                className="text-indigo-400 hover:text-indigo-300 ml-2 font-medium"
              >
                Read More
              </button>
            )}
          </div>

          {post?.mediaUrl && (
            <div className="mt-6 rounded-2xl overflow-hidden bg-white/5 backdrop-blur-lg border border-white/10" onClick={() => handleMediaClick(post.mediaUrl)}>
              {isVideo(post.mediaUrl) ? (
                <ReactPlayer
                  url={post.mediaUrl}
                  controls
                  width="100%"
                  height="auto"
                  config={{
                    file: { attributes: { controlsList: "nodownload" } },
                  }}
                />
              ) : isAudio(post.mediaUrl) ? (
                <audio
                  controls
                  src={post.mediaUrl}
                  className="w-full rounded-2xl"
                  style={{ maxWidth: "400px" }}
                />
              ) : (
                <img
                  src={post.mediaUrl}
                  alt="Post Media"
                  className="w-full rounded-2xl"
                  loading="lazy"
                />
              )}
            </div>
          )}

          {isClient && post?.content && ReactPlayer.canPlay(post.content) && (
            <div className="mt-6 rounded-2xl overflow-hidden bg-white/5 backdrop-blur-lg border border-white/10">
              <ReactPlayer
                url={post.content}
                width="100%"
                height="auto"
                controls
              />
            </div>
          )}

         {isModalOpen && (
  <div
    className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]"
    onClick={handleCloseModal}
  >
    <button
      onClick={handleCloseModal}
      className="absolute top-4 right-4 text-white hover:text-gray-300 text-xl sm:text-2xl bg-black/50 rounded-full w-10 h-10 flex items-center justify-center backdrop-blur-sm"
    >
      ×
    </button>
    <div onClick={(e) => e.stopPropagation()}>
      {isVideo(selectedMedia) ? (
        <video
          src={selectedMedia}
          controls
          className="max-w-[90vw] max-h-[90vh] rounded-xl"
          style={{ objectFit: "contain" }}
        />
      ) : isAudio(selectedMedia) ? (
        <audio
          controls
          src={selectedMedia}
          className="w-full max-w-md rounded-xl"
        />
      ) : (
        <img
          src={selectedMedia}
          alt="Media"
          className="max-w-[90vw] max-h-[90vh] rounded-xl"
          style={{ objectFit: "contain" }}
        />
      )}
    </div>
  </div>
)}


          <p className="text-gray-400 mt-6 text-sm">
            {new Date(post?.createdAt || "").toLocaleString()}
          </p>
        </div>

        {/* Updated Facebook-style Interactions Bar */}
        <div className="px-6 py-4 border-t border-white/20 bg-white/5 backdrop-blur-lg">
          <div className="flex items-center justify-around">
            <button
              className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-all duration-200 hover:bg-white/10 flex-1 ${
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
              <span className="font-medium">{interactions.filter((i) => i.type === "like").length || 0}</span>
            </button>
            
            <button
              className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-all duration-200 hover:bg-white/10 flex-1 ${
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
              <span className="font-medium">{interactions.filter((i) => i.type === "dislike").length || 0}</span>
            </button>
            
            <div className="flex items-center justify-center space-x-2 px-4 py-3 text-gray-400 flex-1">
              <img
                src={viewIcon}
                alt="View"
                className="w-6 h-6"
              />
              <span className="font-medium">{interactions.filter((i) => i.type === "view").length || 0}</span>
            </div>
            
            <button
              className="flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-all duration-200 hover:bg-white/10 text-gray-300 hover:text-white flex-1"
              onClick={toggleComments}
            >
              <img
                src={commentIcon}
                alt="Comment"
                className="w-6 h-6"
              />
              <span className="font-medium">{comments.length}</span>
            </button>
            
            <button
              className="flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-all duration-200 hover:bg-white/10 text-gray-300 hover:text-white flex-1"
              onClick={handleShare}
            >
              <img
                src={shareIcon}
                alt="Share"
                className="w-6 h-6"
              />
              <span className="font-medium">Share</span>
            </button>
          </div>
        </div>

        {/* Full-width Comments Section */}
        <div className="p-6 border-t border-white/20">
          <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>Comments</span>
          </h3>
          
          <form
            onSubmit={handleSubmitComment}
            className="mb-6"
          >
            <div className="relative">
              <textarea
                name="content"
                placeholder="Write a comment..."
                className="w-full p-4 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 text-white placeholder-gray-400 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200 resize-none min-h-[100px]"
                onChange={(e) => {
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                  setCommentContent(e.target.value);
                }}
                style={{ fontSize: "16px" }}
              />
              <div className="absolute bottom-4 right-4 flex items-center space-x-3">
                <label className="cursor-pointer p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-all duration-200">
                  <input
                    type="file"
                    name="media"
                    onChange={(e) => setCommentMedia(e.target.files[0] || null)}
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
                    className="w-5 h-5 text-gray-400 hover:text-gray-200"
                  >
                    <path d="M16 8l-7 7a3 3 0 01-4.243-4.243l7-7a5 5 0 017.071 7.071l-7.5 7.5a7 7 0 01-9.9-9.9l7.5-7.5" />
                  </svg>
                </label>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-2 rounded-xl hover:from-indigo-500 hover:to-purple-500 transition-all duration-200 shadow-lg"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </form>

          <div className="space-y-4">
            {Array.isArray(currentComments) && currentComments.length > 0 ? (
              currentComments.map((comment) => (
                <div key={comment.id} className="w-full">
                  <CommentComponent
                    commentId={comment.id}
                    token={token}
                    userId={userId}
                  />
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-center py-8">No comments yet. Be the first to comment!</p>
            )}
            {totalPages > currentPage && (
              <button
                onClick={loadMoreComments}
                className="w-full py-3 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 text-white hover:bg-white/20 transition-all duration-200"
              >
                Load More Comments
              </button>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Bottom spacing */}
    <div className="h-24 lg:h-8"></div>
  </div>
);
}
