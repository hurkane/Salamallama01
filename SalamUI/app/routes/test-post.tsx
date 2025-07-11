import { LoaderFunction, json, ActionFunction } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import { useState, useEffect } from "react";
import {
  likePost,
  dislikePost,
  sendViewInteraction,
  getInteractions,
} from "~/utils/api";
import { getSession } from "~/sessions";

type InteractionData = {
  id: number;
  userId: string;
  postId: string;
  type: string;
  postOwnerId: string;
};

type LoaderData = {
  interactions: InteractionData[];
  token: string;
};

type ActionData = {
  error?: string;
  success?: boolean;
};

export let loader: LoaderFunction = async ({ request }) => {
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("token");
  const postId = "9864f47a-b03c-4fac-8dc1-fee68b61b275"; // Specific post ID for testing

  if (!token) {
    return json({ interactions: [] }, { status: 401 });
  }

  const data = await getInteractions(postId, token);
  return json<LoaderData>({ interactions: data.interactions, token });
};

export let action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const interactionType = formData.get("interactionType");
  const postId = "9864f47a-b03c-4fac-8dc1-fee68b61b275"; // Specific post ID for testing

  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("token");

  if (!token) {
    return json({ error: "User is not authenticated" }, { status: 401 });
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
        return json({ error: "Invalid interaction type" }, { status: 400 });
    }
    return json({ success: true });
  } catch (error) {
    return json({ error: "Failed to send interaction" }, { status: 500 });
  }
};

export default function TestPost() {
  const loaderData = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const [interactionError, setInteractionError] = useState(
    actionData?.error || ""
  );
  const [interactions, setInteractions] = useState<InteractionData[]>(
    loaderData.interactions || []
  );

  useEffect(() => {
    setInteractions(loaderData.interactions);
  }, [loaderData.interactions]);

  const postId = "9864f47a-b03c-4fac-8dc1-fee68b61b275";

  const fetchInteractions = async () => {
    const token = loaderData.token;
    if (token) {
      console.log(`Fetching interactions for post ${postId}`);
      const data = await getInteractions(postId, token);
      console.log("Fetched interactions:", data.interactions);
      setInteractions(data.interactions || []);
    }
  };

  const handleLike = async () => {
    const token = loaderData.token;
    if (token) {
      await likePost(postId, token);
      fetchInteractions();
    }
  };

  const handleDislike = async () => {
    const token = loaderData.token;
    if (token) {
      await dislikePost(postId, token);
      fetchInteractions();
    }
  };

  const handleView = async () => {
    const token = loaderData.token;
    if (token) {
      await sendViewInteraction(postId, token);
      fetchInteractions();
    }
  };

  const likes =
    interactions?.filter((interaction) => interaction.type === "like")
      ?.length || 0;
  const dislikes =
    interactions?.filter((interaction) => interaction.type === "dislike")
      ?.length || 0;
  const views =
    interactions?.filter((interaction) => interaction.type === "view")
      ?.length || 0;

  useEffect(() => {
    console.log("Updated interactions:", interactions);
  }, [interactions]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-primary-dark text-white">
      <h1 className="text-4xl font-bold">Test Post Interactions</h1>
      <div className="bg-gray-800 p-4 rounded-lg w-full max-w-2xl">
        <div>
          <span>Likes: {likes}</span> | <span>Dislikes: {dislikes}</span> |{" "}
          <span>Views: {views}</span>
        </div>
        <Form method="post">
          <div className="flex space-x-6">
            <button
              type="submit"
              name="interactionType"
              value="like"
              className="px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-700"
            >
              Like
            </button>
            <button
              type="submit"
              name="interactionType"
              value="dislike"
              className="px-4 py-2 bg-red-600 rounded hover:bg-red-700"
            >
              Dislike
            </button>
            <button
              type="submit"
              name="interactionType"
              value="view"
              className="px-4 py-2 bg-green-600 rounded hover:bg-green-700"
            >
              View
            </button>
          </div>
        </Form>
        {interactionError && (
          <p className="text-red-500 mt-4">{interactionError}</p>
        )}
        {actionData?.success && (
          <p className="text-green-500 mt-4">Interaction sent successfully!</p>
        )}
      </div>
    </div>
  );
}
