import { LoaderFunction, json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useParams } from "@remix-run/react";
import { useState, useEffect } from "react";
import { getComment, deleteComment } from "~/utils/api";
import { getSession } from "~/sessions";
import Layout from "~/components/Layout";
import CommentComponent from "~/components/CommentComponent";

interface CommentData {
  id: string;
  userId: string;
  postId: string;
  parentId: string | null;
  content: string;
  createdAt: string;
  User: { username: string; profilePicture?: string };
}

interface LoaderData {
  comment?: CommentData;
  error?: string;
  token?: string;
  userId?: string;
}

export const loader: LoaderFunction = async ({ params, request }) => {
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("token");
  const userId = session.get("userId");
  if (!token) return redirect("/sign-in");

  const commentId = params.commentId as string;
  if (!commentId)
    return json<LoaderData>({ error: "Invalid comment ID." }, { status: 400 });

  try {
    const comment = await getComment(commentId, token);
    return json<LoaderData>({ comment, token, userId });
  } catch (error) {
    console.error("Error fetching comment:", error.message);
    return json<LoaderData>(
      { error: "Failed to retrieve comment." },
      { status: 500 }
    );
  }
};

export default function CommentPage() {
  const { comment: initialComment, error, token, userId } = useLoaderData<LoaderData>();
  const [comment, setComment] = useState(initialComment);
  const [comments, setComments] = useState([initialComment]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const params = useParams();

  // Watch for URL parameter changes and refetch comment data
  useEffect(() => {
    const fetchNewComment = async () => {
      if (params.commentId && params.commentId !== comment?.id && token) {
        setLoading(true);
        try {
          const newComment = await getComment(params.commentId, token);
          setComment(newComment);
          setComments([newComment]);
        } catch (error) {
          console.error("Error fetching new comment:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchNewComment();
  }, [params.commentId, token, comment?.id]);

  if (error) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-screen">
          <p className="text-red-500">{error}</p>
        </div>
      </Layout>
    );
  }

  if (!comment || loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-screen">
          <p className="text-gray-500">
            {loading ? "Loading comment..." : "Comment not found."}
          </p>
        </div>
      </Layout>
    );
  }

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoToPost = () => {
    navigate(`/posts/${comment.postId}`);
  };

  const handleGoToParentComment = () => {
    if (comment.parentId) {
      navigate(`/comment/${comment.parentId}`);
    }
  };



  return (
    <div className="flex flex-col items-center justify-start min-h-screen text-white px-0.5 py-3 lg:p-3 pt-16 lg:pt-6 relative">
      
      {/* Navigation Section */}
      <div className="w-full max-w-4xl mb-6">
        <div className="flex justify-between items-center gap-2 sm:gap-4">
          
          {/* Back Button - Left Side */}
          <button
            className="flex items-center justify-center p-2 sm:px-3 sm:py-2 rounded-xl bg-white/10 text-gray-300 hover:text-white hover:bg-white/20 transition-all duration-200 border border-white/20"
            onClick={handleGoBack}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          {/* Navigation Buttons - Right Side */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-md text-sm sm:text-base"
              onClick={handleGoToPost}
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="hidden sm:inline">Go to Post</span>
              <span className="sm:hidden">Post</span>
            </button>
            
            {comment.parentId && (
              <button
                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 rounded-xl bg-white/10 text-gray-300 hover:text-white hover:bg-white/20 transition-all duration-200 border border-white/20 text-sm sm:text-base"
                onClick={handleGoToParentComment}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                <span className="hidden sm:inline">Go to Parent</span>
                <span className="sm:hidden">Parent</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Comment Display */}
      <div className="w-full max-w-4xl">
        {comments.map((c) => (
          <div key={c.id} className="relative">
            {/* Comment Content */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg p-6">
              <CommentComponent 
                commentId={c.id} 
                token={token} 
                userId={userId} 
                isOnCommentPage={true}
                key={c.id} // Force re-render when comment changes
              />
            </div>
          </div>
        ))}
      </div>

      {/* Bottom spacing for mobile navigation */}
      <div className="h-24 lg:h-8"></div>
    </div>
  );
}