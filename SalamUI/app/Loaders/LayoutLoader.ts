// app/Loaders/LayoutLoader.ts
import { LoaderFunction, json } from "@remix-run/node";
import { getSession } from "~/sessions";
import { getUserInfo } from "../utils/api";

export const layoutLoader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Skip token validation for sign-in and sign-up pages
  if (path === "/sign-in" || path === "/sign-up") {
    return json({});
  }
  
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("token");
  const userId = session.get("userId");
  
  if (!token || !userId) {
    // Return unauthenticated state instead of redirecting
    return json({ 
      isAuthenticated: false, 
      requiresAuth: true,
      userId: null, 
      username: null, 
      name: null, 
      profilePicture: null, 
      token: null 
    });
  }
  
  try {
    const userInfo = await getUserInfo(userId, token);
    const username = userInfo.username;
    const name = userInfo.name;
    const profilePicture = userInfo.profilePicture || "/default_profile_pic.png";
    
    return json({ 
      isAuthenticated: true,
      requiresAuth: false,
      userId, 
      username, 
      name, 
      profilePicture, 
      token 
    });
  } catch (error) {
    // Handle errors such as 401 Unauthorized
    if (error.response && error.response.status === 401) {
      return json({ 
        isAuthenticated: false, 
        requiresAuth: true,
        userId: null, 
        username: null, 
        name: null, 
        profilePicture: null, 
        token: null 
      });
    }
    
    // For other errors, still return unauthenticated state
    console.error('Layout loader error:', error);
    return json({ 
      isAuthenticated: false, 
      requiresAuth: true,
      userId: null, 
      username: null, 
      name: null, 
      profilePicture: null, 
      token: null 
    });
  }
};