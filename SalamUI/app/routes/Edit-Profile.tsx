import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState, useEffect } from "react";
import {
  updateUserInfo,
  updateProfilePicture,
  updateBanner,
  getUserInfo,
  getProfilePicture,
  getBanner,
} from "../utils/api";
import { json } from "@remix-run/node";
import { getSession } from "~/sessions";

export const loader = async ({ request }) => {
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("token");
  const userId = session.get("userId");

  if (!token || !userId) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const userInfo = await getUserInfo(userId, token);

  return json({ token, userInfo, userId });
};

export default function EditProfile() {
  const { token, userInfo, userId } = useLoaderData();
  const navigate = useNavigate();
  const [profilePicture, setProfilePicture] = useState(
    userInfo.profilePicture || "/default_profile_pic.png"
  );
  const [banner, setBanner] = useState(
    userInfo.banner || "/default_banner.png"
  );
  const [username, setUsername] = useState(userInfo.username);
  const [bio, setBio] = useState(userInfo.bio || "");
  const [name, setName] = useState(userInfo.name || "");
  const [email, setEmail] = useState(userInfo.email || "");
  const [profilePublic, setProfilePublic] = useState(userInfo.profilePublic);
  const [error, setError] = useState("");

  const fetchProfilePicture = async () => {
    try {
      const profilePicUrl = await getProfilePicture(userId, token);
      setProfilePicture(profilePicUrl);
    } catch (err) {
      setError("Failed to fetch profile picture.");
      console.error("Error fetching profile picture:", err.message);
    }
  };

  const fetchBanner = async () => {
    try {
      const bannerUrl = await getBanner(userId, token);
      setBanner(bannerUrl);
    } catch (err) {
      setError("Failed to fetch banner.");
      console.error("Error fetching banner:", err.message);
    }
  };

  useEffect(() => {
    fetchProfilePicture();
    fetchBanner();
  }, [userId, token]);

  const handleProfilePictureChange = async (event) => {
    const file = event.target.files[0];
    if (file && token) {
      const formData = new FormData();
      formData.append("profilePicture", file);
      try {
        await updateProfilePicture(formData, token);
        fetchProfilePicture();
      } catch (err) {
        setError("Failed to update profile picture.");
        console.error("Error updating profile picture:", err.message);
      }
    }
  };

  const handleBannerChange = async (event) => {
    const file = event.target.files[0];
    if (file && token) {
      const formData = new FormData();
      formData.append("Banner", file);
      try {
        await updateBanner(formData, token);
        fetchBanner();
      } catch (err) {
        setError("Failed to update banner.");
        console.error("Error updating banner:", err.message);
      }
    }
  };

  const handleSaveProfile = async () => {
    try {
      await updateUserInfo(
        { username, bio, name, email, profilePublic },
        token
      );
      navigate(`/user/${userId}`);
    } catch (err) {
      setError("Failed to update profile info.");
      console.error("Error updating profile info:", err.message);
    }
  };

  const handleCancel = async () => {
    navigate(`/user/${userId}`);
  };

  const handleToggleProfilePublic = () => {
    setProfilePublic(!profilePublic);
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen text-white px-0.5 py-3 lg:p-3 pt-16 lg:pt-6 relative">
      {/* Main Profile Edit Container */}
      <div className="w-full max-w-4xl">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-white/20">
            <h2 className="text-2xl font-semibold text-white flex items-center space-x-2">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Edit Profile</span>
            </h2>
            <p className="text-gray-300 text-sm mt-1">
              Customize your profile information and appearance
            </p>
          </div>

          {/* Profile Content */}
          <div className="p-6">
            {/* Banner Section */}
            <div className="relative w-full h-48 bg-white/5 rounded-xl mb-6 overflow-hidden">
              <img
                src={banner}
                alt="Banner"
                className="w-full h-48 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => document.getElementById("bannerInput").click()}
              />
              <input
                type="file"
                id="bannerInput"
                className="hidden"
                onChange={handleBannerChange}
              />
              
              {/* Banner Edit Button */}
              <button
                className="absolute top-4 right-4 p-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-colors"
                onClick={() => document.getElementById("bannerInput").click()}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>

            {/* Profile Picture Section - Separate from banner */}
            <div className="flex justify-center mb-8">
              <div
                className="relative cursor-pointer group"
                onClick={() => document.getElementById("profilePictureInput").click()}
              >
                <div className="relative">
                  <img
                    src={profilePicture}
                    alt="Profile Picture"
                    className="w-32 h-32 rounded-full border-4 border-white/20 object-cover backdrop-blur-sm shadow-lg"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="text-center">
                      <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      <span className="text-sm font-medium">Edit</span>
                    </div>
                  </div>
                </div>
                <input
                  type="file"
                  id="profilePictureInput"
                  className="hidden"
                  onChange={handleProfilePictureChange}
                />
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-6">
              {/* Username Field */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="Enter your username"
                />
              </div>

              {/* Name Field */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="Enter your display name"
                />
              </div>

              {/* Email Field */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="Enter your email"
                />
              </div>

              {/* Bio Field */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="w-full p-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                  placeholder="Tell us about yourself..."
                />
              </div>

              {/* Profile Visibility Toggle */}
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center space-x-3">
                  <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <div>
                    <span className="text-white font-medium">Profile Visibility</span>
                    <p className="text-gray-400 text-sm">
                      {profilePublic ? "Your profile is visible to everyone" : "Your profile is private"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleToggleProfilePublic}
                  className={`relative inline-flex w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    profilePublic ? "bg-gradient-to-r from-indigo-600 to-purple-600" : "bg-gray-600"
                  }`}
                >
                  <span
                    className={`inline-block w-5 h-5 bg-white rounded-full transition-transform duration-200 ${
                      profilePublic ? "translate-x-6" : "translate-x-0.5"
                    } mt-0.5`}
                  />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4 mt-8">
              <button
                onClick={handleSaveProfile}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Save Changes</span>
                </div>
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 px-6 py-3 bg-white/10 backdrop-blur-sm text-white rounded-xl font-medium hover:bg-white/20 transition-colors border border-white/20"
              >
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Cancel</span>
                </div>
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-300">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom spacing */}
      <div className="h-24 lg:h-8"></div>
    </div>
  );
}