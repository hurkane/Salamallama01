import { LoaderFunction, json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState } from "react";
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
  userId?: string; // Include userId in the loader data
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
  const { comment, error, token, userId } = useLoaderData<LoaderData>();
  const [comments, setComments] = useState([comment]);
  const navigate = useNavigate();

  if (error) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-screen">
          <p className="text-red-500">{error}</p>
        </div>
      </Layout>
    );
  }

  if (!comment) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-screen">
          <p className="text-gray-500">Comment not found.</p>
        </div>
      </Layout>
    );
  }

  const handleNavigateToPost = () => {
    navigate(`/posts/${comment.postId}`);
  };

  const handleNavigateToParentComment = () => {
    if (comment.parentId) {
      navigate(`/comment/${comment.parentId}`);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await deleteComment(commentId, token);
      setComments((prevComments) =>
        prevComments.filter((c) => c.id !== commentId)
      );
    } catch (error) {
      console.error("Error deleting comment:", error.message);
    }
  };

  return (
    <div>
      <div className="bg-gray-800 p-4 rounded-lg w-full max-w-2xl mx-auto my-4 flex justify-between items-center">
        <button
          className="text-blue-500 hover:text-blue-300"
          onClick={handleNavigateToPost}
        >
          Back to Post
        </button>
        {comment.parentId && (
          <button
            className="text-blue-500 hover:text-blue-300"
            onClick={handleNavigateToParentComment}
          >
            Back to Parent Comment
          </button>
        )}
      </div>
      <div className="bg-gray-800 p-4 rounded-lg w-full max-w-2xl mx-auto my-4">
        {comments.map((c) => (
          <div key={c.id} className="flex items-center space-x-4">
            <CommentComponent commentId={c.id} token={token} />
            {c.userId === userId && (
              <button
                className="text-red-500 hover:text-red-300 ml-auto"
                onClick={() => handleDeleteComment(c.id)}
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
