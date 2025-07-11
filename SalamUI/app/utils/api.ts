import axios from "axios";
//export const API_BASE_URL = process.env.API_BASE_URL || "http://192.168.12.242";

export const API_BASE_URL = "http://192.168.12.242";
//export const API_BASE_URL = "https://salamallama.com";

export const register = async (name, username, email, password) => {
  const response = await axios.post(`${API_BASE_URL}/api/auth/register`, {
    name,
    username,
    email,
    password,
  });
  return response.data;
};

export const requestPasswordReset = async (email) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/auth/requestPasswordReset`,
      { email }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      // Server responded with a status other than 200 range
      console.error("Server Error:", error.response.data);
      throw new Error(error.response.data.error || "Server Error");
    } else if (error.request) {
      // Request was made but no response was received
      console.error("Network Error:", error.request);
      throw new Error("Network Error");
    } else {
      // Something else happened while setting up the request
      console.error("Error:", error.message);
      throw new Error(error.message);
    }
  }
};

export const resetPassword = async (token, id, newPassword) => {
  const response = await axios.post(`${API_BASE_URL}/api/auth/resetPassword`, {
    token,
    id,
    newPassword,
  });
  return response.data;
};

export const login = async (emailOrUsername: string, password: string) => {
  const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
    emailOrUsername,
    password,
  });
  return {
    token: response.data.token,
    userId: response.data.userId, // Make sure this matches the updated backend response
  };
};

export const getPost = async (postId, token) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/post/${postId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const post = response.data;

    // Assume the backend API provides the complete media URL in `post.media`
    if (post.media) {
      post.mediaUrl = post.media; // Use the media URL directly provided by the backend
    }

    return post;
  } catch (error) {
    console.error("Failed to retrieve post:", error.message);
    throw error;
  }
};

// Updated function to reduce network requests (if you have server-side capabilities)
export async function getComment(commentId, token) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/comments/${commentId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const comment = response.data;

    // Combine fetching user data with comment retrieval if your backend supports it
    if (comment?.userId) {
      const userResponse = await axios.get(
        `${API_BASE_URL}/api/user/${comment.userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      comment.User = userResponse.data;
    }

    // Fetch media URL if media exists
    if (comment.media) {
      const mediaResponse = await axios.get(`${comment.media}`);
      comment.mediaUrl = mediaResponse.data.fileUrl;
    }

    return comment;
  } catch (error) {
    console.error("Failed to retrieve comment or user data:", error.message);
    throw error;
  }
}

export async function getSubComments(parentId, token) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/comments/${parentId}/subcomments`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const subComments = response.data;

    // Fetch media URLs for each subcomment
    for (const subComment of subComments) {
      if (subComment.media) {
        const mediaUrl = `${API_BASE_URL}/media/${subComment.media}`;
        subComment.mediaUrl = mediaUrl;
      }
    }

    return subComments;
  } catch (error) {
    console.error("Error in getSubComments:", error.message);
    if (error.response) {
      console.error("Error response data:", error.response.data);
    }
    throw error;
  }
}

export const createPost = async (content, file, token) => {
  console.log("createPost called with:", { content, file, token });

  const formData = new FormData();
  formData.append("content", content);
  if (file) {
    console.log("Appending file:", file);
    formData.append("file", file);
  }

  try {
    const response = await axios.post(`${API_BASE_URL}/api/post`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    });

    console.log("Post created successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error creating post:", error.message);
    throw error; // Rethrow the error for further handling
  }
};

// Function to check if the URL is valid
const validateURL = async (url) => {
  try {
    const response = await axios.head(url);
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

export const getProfilePicture = async (userId: string, token: string) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/user/${userId}/profilePicture`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const profilePicture = response.data.profilePicture;

    // Validate the generated profile picture URL
    if (
      profilePicture &&
      typeof profilePicture === "string" &&
      profilePicture !== "undefined"
    ) {
      const isValid = await validateURL(profilePicture);
      if (isValid) {
        return profilePicture;
      }
    }
    return "/default_profile_pic.png";
  } catch (error) {
    console.error(
      `Error fetching profile picture for user ${userId}: ${error.message}`
    );
    // Return default profile picture if there's an error
    return "/default_profile_pic.png";
  }
};

// Get User Info
export const getUserInfo = async (userId: string, token: string) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/user/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error(
      "Error fetching user info:",
      error.response ? error.response.data : error.message
    );
    throw error;
  }
};

// get popular users
export const getPopularUsers = async (token: string) => {
  const response = await axios.get(`${API_BASE_URL}/api/users/popular`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

// Update User Info
export const updateUserInfo = async (data: any, token: string) => {
  const response = await axios.put(`${API_BASE_URL}/api/user`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Update Profile Picture
export const updateProfilePicture = async (
  formData: FormData,
  token: string
) => {
  const response = await axios.put(
    `${API_BASE_URL}/api/user/profilePicture`,
    formData,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

export const getBanner = async (userId, token) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/user/${userId}/banner`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data.Banner; // Return the Banner property
  } catch (error) {
    console.error("Failed to fetch banner:", error.message);
    throw new Error("Failed to fetch banner.");
  }
};

export const updateBanner = async (formData, token) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/api/user/Banner`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Failed to update banner:", error.message);
    throw new Error("Failed to update banner.");
  }
};

export const getInteractions = async (postId, token) => {
  try {
    console.log(`Fetching interactions for post ${postId}`);
    const response = await axios.get(
      `${API_BASE_URL}/api/interactions/post/${postId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log("Fetched interactions:", response.data);
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log("No interactions found for this post.");
      return []; // Return an empty array for no interactions
    } else {
      console.error("Error fetching interactions:", error);
      throw error; // Re-throw other errors
    }
  }
};

export const getCurrentUserInteraction = async (postId, token) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/interactions/post/${postId}/current`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.status === 404) {
      console.log("No interaction found for this user on this post.");
      return null; // No interaction found
    }

    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log("No interaction found for this user on this post.");
      return null; // No interaction found
    } else {
      console.error("Error fetching current interaction:", error);
      throw error; // Re-throw other errors
    }
  }
};

export const getCommentInteractions = async (commentId, token) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/interactions/comment/${commentId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.status === 404) {
      console.log("No interactions found for this comment.");
      return []; // Return an empty array for no interactions
    }

    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log("No interactions found for this comment.");
      return []; // Return an empty array for no interactions
    } else if (error.response && error.response.status === 403) {
      console.error(
        "Access forbidden. Please check your token and permissions."
      );
    } else {
      console.error("Error fetching interactions:", error.message);
    }
    throw error;
  }
};

export const getCurrentUsercommentInteraction = async (commentId, token) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/interactions/comment/${commentId}/current`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.status === 404) {
      console.log("No interaction found for this user on this comment.");
      return null; // No interaction found
    }

    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log("No interaction found for this user on this comment.");
      return null; // No interaction found
    } else {
      console.error("Error fetching current interaction:", error);
      throw error; // Re-throw other errors
    }
  }
};

// Remove an interaction by ID
export const removeInteraction = async (interactionId, token) => {
  await axios.delete(
    `${API_BASE_URL}/api/interactions/remove/${interactionId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
};

export const likePost = async (postId: string, token: string) => {
  try {
    console.log(`Sending like interaction for post ${postId}`);
    const response = await axios.post(
      `${API_BASE_URL}/api/interactions/like/post/${postId}`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log("Liked post:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error liking post:", error);
  }
};

export const dislikePost = async (postId: string, token: string) => {
  try {
    console.log(`Sending dislike interaction for post ${postId}`);
    const response = await axios.post(
      `${API_BASE_URL}/api/interactions/dislike/post/${postId}`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log("Disliked post:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error disliking post:", error);
  }
};

export const sendViewInteraction = async (postId: string, token: string) => {
  try {
    console.log(`Sending view interaction for post ${postId}`);
    const response = await axios.post(
      `${API_BASE_URL}/api/interactions/view/post/${postId}`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log("viewed post:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error viewing post:", error);
  }
};

export const getCommentsForPost = async (
  postId: string,
  token: string,
  page: number = 1
) => {
  const response = await axios.get(
    `${API_BASE_URL}/api/comments/posts/${postId}/comments?page=${page}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return response.data;
};

export const addComment = async (
  postId: string,
  content: string,
  media: File | null,
  token: string
) => {
  const formData = new FormData();
  formData.append("content", content);
  formData.append("postId", postId);
  if (media) {
    formData.append("file", media);
  }

  const response = await axios.post(`${API_BASE_URL}/api/comments`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const addSubComment = async (
  postId: string,
  parentId: string,
  content: string,
  media: File | null,
  token: string
) => {
  const formData = new FormData();
  formData.append("content", content);
  formData.append("parentId", parentId);
  formData.append("postId", postId); // Added postId
  if (media) {
    formData.append("file", media);
  }

  console.log("Form data being sent:", {
    content,
    parentId,
    postId,
    media: media ? media.name : "No media",
  });

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/comments`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );
    console.log("Response from server:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error in addSubComment:", error.message);
    if (error.response) {
      console.error("Error response data:", error.response.data);
    }
    throw error;
  }
};

export const likeComment = async (commentId: string, token: string) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/interactions/like/comment/${commentId}`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    console.error("Error liking comment:", error);
  }
};

export const dislikeComment = async (commentId: string, token: string) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/interactions/dislike/comment/${commentId}`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    console.error("Error disliking comment:", error);
  }
};
export const viewComment = async (commentId: string, token: string) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/interactions/view/comment/${commentId}`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    console.error("Error viewing comment:", error.message);
    if (error.response && error.response.status === 403) {
      console.error(
        "Access forbidden. Please check your token and permissions."
      );
    }
    throw error;
  }
};

export const getFeed = async (page, token) => {
  const response = await axios.get(
    `${API_BASE_URL}/api/feed/all?page=${page}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
};

export const getFollowingFeed = async (page, token) => {
  const response = await axios.get(`${API_BASE_URL}/api/feed/following`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  return response.data;
};

export const getPopularFeed = async (page, token) => {
  const response = await axios.get(`${API_BASE_URL}/api/feed/popularity`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  return response.data;
};

export const getUserPosts = async (userId, page, token) => {
  const response = await axios.get(
    `${API_BASE_URL}/api/userposts/${userId}/posts?page=${page}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

export const deletePost = async (postId, token) => {
  const response = await axios.delete(`${API_BASE_URL}/api/post/${postId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const deleteComment = async (commentId, token) => {
  const response = await axios.delete(
    `${API_BASE_URL}/api/comments/${commentId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

// Follow functions
export const followUser = async (followedId: string, token: string) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/follow`,
    { followedId },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};
//  unfollowUser function
export const unfollowUser = async (followedId: string, token: string) => {
  const response = await axios.delete(`${API_BASE_URL}/api/follow/unfollow`, {
    data: { followedId },
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const getFollowStatus = async (
  followerId: string,
  followedId: string,
  token: string
) => {
  const url = `${API_BASE_URL}/api/follow/status?followerId=${followerId}&followedId=${followedId}`;
  console.log(`Calling URL: ${url}`); // Add logging

  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`Response: ${JSON.stringify(response.data)}`); // Add logging
    return {
      status: response.data.status,
      id: response.data.id,
    };
  } catch (error) {
    console.error("Error in getFollowStatus:", error.message);
    throw error;
  }
};

// Get Followers
export const getFollowers = async (userId: string, token: string) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/user/${userId}/followers`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 403) {
      return { error: "Unauthorized to view followers." };
    } else {
      throw error;
    }
  }
};

// Get Following
export const getFollowing = async (userId: string, token: string) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/user/${userId}/following`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 403) {
      return { error: "Unauthorized to view following." };
    } else {
      throw error;
    }
  }
};

// Remove a follower
export const removeFollower = async (followId: string, token: string) => {
  const response = await axios.delete(
    `${API_BASE_URL}/api/follow/remove/${followId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

export const getNotifications = async (
  userId,
  token,
  limit = 20,
  offset = 0
) => {
  const response = await fetch(
    `${API_BASE_URL}/api/notifications/user/${userId}?limit=${limit}&offset=${offset}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const data = await response.json();
  return data;
};

export const getUnseenNotifications = async (userId, token, limit, offset) => {
  const response = await axios.get(
    `${API_BASE_URL}/api/notifications/unseen/${userId}?limit=${limit}&offset=${offset}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

export const markNotificationAsSeen = async (notificationId, token) => {
  const response = await axios.put(
    `${API_BASE_URL}/api/notifications/${notificationId}/seen`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

export const getFollowRequests = async (token) => {
  const response = await axios.get(`${API_BASE_URL}/api/follow/requests`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const acceptFollowRequest = async (id, token) => {
  const response = await axios.put(
    `${API_BASE_URL}/api/follow/accept/${id}`,
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return response.data;
};

export const rejectFollowRequest = async (id, token) => {
  const response = await axios.put(
    `${API_BASE_URL}/api/follow/reject/${id}`,
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return response.data;
};

export const getTopSentences = async (page, limit, token) => {
  const response = await axios.get(
    `${API_BASE_URL}/api/allpost/top-sentences`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params: { page, limit },
    }
  );
  return response.data;
};

export const searchPostsByKeyword = async (keyword, page, limit, token) => {
  const response = await axios.get(`${API_BASE_URL}/api/allpost/search`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { keyword, page, limit },
  });
  return response.data;
};

export const searchUsersByKeyword = async (keyword, page, limit, token) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/users/search`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { keyword, page, limit },
    });

    const users = response.data.users;
    const usersWithProfilePics = await Promise.all(
      users.map(async (user) => {
        try {
          const profilePicture = await getProfilePicture(user.id, token);
          return { ...user, profilePicture };
        } catch (error) {
          console.error(
            "Error fetching profile picture for user:",
            user.id,
            error
          );
          return { ...user, profilePicture: null };
        }
      })
    );

    return { users: usersWithProfilePics };
  } catch (error) {
    console.error(
      "Error searching users:",
      error.response ? error.response.data : error.message
    );
    throw new Error("Error searching users");
  }
};

export const getChats = async (userId, token, page = 1, limit = 10) => {
  console.log("Fetching chats for user:", userId); // Log user ID
  try {
    const response = await axios.get(`${API_BASE_URL}/api/chat`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page, limit }, // Add pagination parameters
    });
    console.log("Fetched chats:", response.data); // Log response data

    const chats = response.data.chats; // Adjust to access chats array from response
    const chatsWithUserDetails = await Promise.all(
      chats.map(async (chat) => {
        const usersWithDetails = await Promise.all(
          chat.users.map(async (user) => {
            try {
              const profilePicture = await getProfilePicture(user, token);
              const userInfo = await getUserInfo(user, token);
              return { _id: user, profilePicture, username: userInfo.username };
            } catch (error) {
              console.error("Error fetching details for user:", user, error);
              return {
                _id: user,
                profilePicture: "/default_profile_pic.png",
                username: "Unknown",
              };
            }
          })
        );
        return { ...chat, users: usersWithDetails };
      })
    );

    return {
      chats: chatsWithUserDetails,
      currentPage: response.data.currentPage,
      totalPages: response.data.totalPages,
      totalChats: response.data.totalChats,
    };
  } catch (error) {
    console.error(
      "Error fetching chats:",
      error.response ? error.response.data : error.message
    );
    throw error;
  }
};

export const getChatById = async (chatId, token) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/chat/chat/${chatId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data;
  } catch (error) {
    console.error(
      "Error fetching chat by ID:",
      error.response ? error.response.data : error.message
    );
    throw new Error("Error fetching chat by ID");
  }
};

export const createOneToOneChat = async (userId, token) => {
  console.log("Creating one-to-one chat with userId:", userId);
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/chat/`,
      { userId }, // Correctly send user ID in the request body
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    console.log("One-to-one chat response:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Error accessing chat:",
      error.response ? error.response.data : error.message
    );
    throw new Error("Error accessing chat");
  }
};

export const createGroupChat = async ({ name, users, token }) => {
  console.log("Creating group chat with name and users:", name, users);
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/chat/group`,
      { name, users: JSON.stringify(users) }, // Ensure users array is properly formatted
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    console.log("Group chat response:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Error creating group chat:",
      error.response ? error.response.data : error.message
    );
    console.error("Request data:", { name, users });
    throw new Error("Error creating group chat");
  }
};

export const renameGroupChat = async (chatId, newName, token) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/api/chat/rename`,
      { chatId, chatName: newName },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error renaming group chat:", error);
    throw error;
  }
};

export const addToGroupChat = async (chatId, userId, token) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/api/chat/groupadd`,
      { chatId, userId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error adding user to group chat:", error);
    throw error;
  }
};

export const removeFromGroupChat = async (chatId, userId, token) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/api/chat/groupremove`,
      { chatId, userId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error removing user from group chat:", error);
    throw error;
  }
};

export const addAdminToGroupChat = async (chatId, userId, token) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/api/chat/addadmin`,
      { chatId, userId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error adding admin to group chat:", error);
    throw error;
  }
};

const fetchAzureBlobMetadata = async (url) => {
  try {
    // Fetch file headers
    const response = await axios.head(url);
    const contentType = response.headers["content-type"];
    const contentLength = response.headers["content-length"];

    // Return metadata
    return {
      title: url.split("/").pop().split("?")[0], // Extract file name
      description: `File type: ${contentType}, Size: ${contentLength} bytes`,
      image: url, // Use the URL itself as the image preview
      url,
    };
  } catch (error) {
    console.error("Failed to fetch Azure Blob metadata:", error);
    return null;
  }
};

const isAzureBlobUrl = (url) => url.includes("blob.core.windows.net");
export const fetchMetadata = async (url) => {
  try {
    // Handle Azure Blob Storage URLs
    if (isAzureBlobUrl(url)) {
      console.log("Recognized as Azure Blob URL. Fetching metadata...");
      return await fetchAzureBlobMetadata(url);
    }

    // Attempt to fetch metadata from your backend
    const response = await axios.get(
      `${API_BASE_URL}/api/preview?url=${encodeURIComponent(url)}`
    );
    if (response.data && Object.keys(response.data).length > 0) {
      return response.data;
    } else {
      console.warn("Backend returned no metadata, falling back...");
    }
  } catch (error) {
    console.error("Failed to fetch metadata from backend:", error);
  }

  // Fallback to alternative source if needed
  return {
    title: "Unknown",
    description: "No metadata available",
    image: "",
    url,
  };
};
