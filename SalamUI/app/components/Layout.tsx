import { Form, Link, useLoaderData, useLocation } from "@remix-run/react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "@remix-run/react";
import { LoaderData } from "~/types"; // Define your type here
import PopularUsers from "~/components/PopularUsers";


import {
  HomeIcon,
  BellIcon,
  ChatIcon,
  SearchIcon,
  UserIcon,
  LogoutIcon,
  XIcon,
  MenuIcon,
  BookOpenIcon,
} from "@heroicons/react/outline"; // Import icons from v1
import {
  getUnseenNotifications,
  getFollowRequests,
  API_BASE_URL,
} from "~/utils/api"; // Adjust the path
import io from "socket.io-client";

const ENDPOINT = `${API_BASE_URL}:5008`;
let socket;

type LayoutProps = {
  children: React.ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  const { userId, username, name, profilePicture, token } =
    useLoaderData<LoaderData>();
  const [showTopBar, setShowTopBar] = useState(true);
  const [showBottomBar, setShowBottomBar] = useState(true);
  const [unseenNotifications, setUnseenNotifications] = useState(0);
  const [followRequests, setFollowRequests] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const location = useLocation();
  const [leftOpen, setLeftOpen]   = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const navigate = useNavigate(); 
  const defaultPfp = "/default_profile_pic.png";


  // refs for the two panels
  const leftRef  = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLeftOpen(false);
    setRightOpen(false);
  }, [location.pathname]);

    useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setLeftOpen(false);
        setRightOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    // also run on mount in case user loaded small
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // close on click outside either panel
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const tgt = e.target as Node;
      if (leftOpen && leftRef.current && !leftRef.current.contains(tgt)) {
        setLeftOpen(false);
      }
      if (rightOpen && rightRef.current && !rightRef.current.contains(tgt)) {
        setRightOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [leftOpen, rightOpen]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;

      setShowTopBar(scrollTop > 0);
      setShowBottomBar(scrollTop + clientHeight < scrollHeight);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const fetchNotificationsAndRequests = async () => {
    if (!token || !userId) {
      console.warn("Missing token or userId, skipping fetch.");
      return;
    }

    console.log("Token:", token); // Log the token to ensure it's available
    console.log("UserId:", userId); // Log the userId to ensure it's available

    console.log("Fetching notifications and follow requests...");
    try {
      const [notifications, requests] = await Promise.all([
        getUnseenNotifications(userId, token, 10, 0).catch((err) => {
          console.error("Error fetching unseen notifications:", err);
          return []; // Return an empty array on error
        }),
        getFollowRequests(token).catch((err) => {
          console.error("Error fetching follow requests:", err);
          return []; // Return an empty array on error
        }),
      ]);

      // Ensure valid results before updating state
      if (Array.isArray(notifications)) {
        console.log("Unseen Notifications:", notifications);
        setUnseenNotifications(notifications.length);
      } else {
        console.warn("Invalid response for notifications:", notifications);
        setUnseenNotifications(0);
      }

      if (Array.isArray(requests)) {
        console.log("Follow Requests:", requests);
        setFollowRequests(requests.length);
      } else {
        console.warn("Invalid response for follow requests:", requests);
        setFollowRequests(0);
      }
    } catch (error) {
      console.error("Unexpected error fetching data:", error);
    }
  };

  useEffect(() => {
    fetchNotificationsAndRequests();
  }, [userId, token, location.pathname]);
  useEffect(() => {
    socket = io(ENDPOINT);
    socket.emit("setup", { _id: userId });

    socket.on("message received", (newMessage) => {
      console.log("Received new message:", newMessage);

      // Update unread messages count
      setUnreadMessagesCount((prev) => {
        const newCount = prev + 1;
        console.log("Updated unread messages count:", newCount);
        return newCount;
      });
    });

    socket.on("unread messages", (unreadMessages) => {
      console.log("Fetched unread messages:", unreadMessages);
      const count = unreadMessages.length;
      console.log("Unread messages count:", count);
      setUnreadMessagesCount(count);
    });

    return () => {
      socket.disconnect();
    };
  }, [userId]);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-900 text-white relative overflow-hidden">
      {/* Background decorative elements matching sign-in page */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-2xl opacity-10 animate-pulse"></div>
      </div>

      {/* MINI VERTICAL STRIP (right desktop only) */}
      {!rightOpen && (
        <nav
          className="
            hidden lg:flex flex-col items-center justify-center
            fixed top-0 right-0 h-full w-12
            bg-white/10 backdrop-blur-lg border-l border-white/20
            z-40 py-4 shadow-2xl
          "
        >
          <button
            onClick={() => setRightOpen(true)}
            className="p-2 hover:bg-white/10 rounded-lg transition-all duration-200 hover:scale-110"
          >
            <MenuIcon className="h-6 w-6 text-white rotate-180" />
          </button>
        </nav>
      )}

      {/* MINI VERTICAL STRIP (left desktop only) */}
      {!leftOpen && (
        <nav
          className="
            hidden lg:flex flex-col items-center justify-between
            fixed top-0 left-0 h-full w-12
            bg-white/10 backdrop-blur-lg border-r border-white/20
            z-40 py-4 space-y-6 shadow-2xl
          "
        >
          {/* burger opens full sidebar */}
          <button
            onClick={() => setLeftOpen(true)}
            className="p-2 hover:bg-white/10 rounded-lg transition-all duration-200 hover:scale-110"
          >
            <MenuIcon className="h-6 w-6 text-white" />
          </button>

          {/* nav icons: navigate + open */}
          <div className="flex-1 flex flex-col items-center space-y-4">
            {[
             { icon: HomeIcon,   to: "/home",          label: "Home" },
             { icon: BellIcon,   to: "/notifications", label: "Notifications" },
             { icon: UserIcon,   to: "/follow",        label: "Followers" },
             { icon: BookOpenIcon,to: "/library",         label: "Library" },
             { icon: SearchIcon, to: "/discover",      label: "Discover" },
             { icon: ChatIcon,   to: "/chats",         label: "Chat" },
           ].map(({ icon: Icon, to, label }) => (
             <button
                key={to}
                onClick={() => navigate(to)}
                className="group relative p-2 hover:text-indigo-400 text-gray-300 hover:bg-white/10 rounded-lg transition-all duration-200 hover:scale-110"
              >
                <Icon className="h-6 w-6" />
              <span
                 className="
                   absolute left-full top-1/2 -translate-y-1/2
                   ml-3 whitespace-nowrap bg-white/10 backdrop-blur-lg text-white text-xs
                   px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100
                   transition-all duration-200 border border-white/20 shadow-lg
                 "
               >
                 {label}
               </span>
              </button>
            ))}
          </div>

          {/* profile pic also opens full sidebar */}
          <button
            onClick={() => setLeftOpen(true)}
            className="p-1 hover:bg-white/10 rounded-lg transition-all duration-200 hover:scale-110"
          >
<img
  src={profilePicture || defaultPfp}
  onError={(e) => {
    const target = e.currentTarget;
    if (target.src !== window.location.origin + defaultPfp) {
      target.src = defaultPfp;
    }
  }}
  alt={username}
  className="w-10 h-10 rounded-full border-2 border-white/20 shadow-lg"
/>

          </button>
        </nav>
      )}

      {/* LEFT SIDEBAR (Full) */}
      <aside ref={leftRef}
        className={`
          fixed inset-y-0 left-0 w-64 bg-white/10 backdrop-blur-lg z-50 p-6
          border-r border-white/20 shadow-2xl
          transform transition-all duration-300
          ${leftOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      > 
        <button
          onClick={() => setLeftOpen(false)}
          className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-all duration-200"
        >
          <XIcon className="h-5 w-5" />
        </button>

        {/* Header with logo */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full mb-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Salama LLama</h2>
        </div>

        {userId && (
          <Link to={`/user/${userId}`} className="flex items-center mb-8 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200">
<img
  src={profilePicture || defaultPfp}
  onError={(e) => {
    const target = e.currentTarget;
    if (target.src !== window.location.origin + defaultPfp) {
      target.src = defaultPfp;
    }
  }}
  alt={username}
  className="w-10 h-10 rounded-full border-2 border-white/20 shadow-lg"
/>

            <div className="ml-3">
              <h3 className="text-lg font-semibold text-white">{name}</h3>
              <p className="text-gray-300 text-sm">@{username}</p>
            </div>
          </Link>
        )}
        
        <nav className="flex-grow space-y-3 border-t border-white/20 pt-6">
          {[
            { icon: HomeIcon, to: "/home", label: "Home", count: 0 },
            { icon: BellIcon, to: "/notifications", label: "Notifications", count: unseenNotifications },
            { icon: UserIcon, to: "/follow", label: "Followers", count: followRequests },
            { icon: BookOpenIcon, to: "/books", label: "Library", count: 0 },
            { icon: SearchIcon, to: "/discover", label: "Discover", count: 0 },
            { icon: ChatIcon, to: "/chats", label: "Chat", count: unreadMessagesCount },
          ].map(({ icon: Icon, to, label, count }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center justify-between p-3 rounded-xl text-lg font-medium transition-all duration-200 hover:scale-105 ${
                location.pathname === to
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                  : "hover:bg-white/10 text-gray-300 hover:text-white"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className="h-6 w-6" />
                <span>{label}</span>
              </div>
              {count > 0 && (
                <span className="bg-red-500 text-white rounded-full text-xs px-2 py-1 min-w-[20px] text-center">
                  {count}
                </span>
              )}
            </Link>
          ))}
        </nav>
        
        <Form
          method="post"
          action="/logout"
          className="border-t border-white/20 pt-6 mt-6"
        >
          <button
            type="submit"
            className="flex items-center space-x-3 text-left text-lg font-medium hover:text-red-400 transition-all duration-200 w-full p-3 rounded-xl hover:bg-red-500/10"
            onClick={(e) => {
              if (!window.confirm("Are you sure you want to log out?")) {
                e.preventDefault();
              }
            }}
          >
            <LogoutIcon className="h-6 w-6" />
            <span>Log Out</span>
          </button>
        </Form>
      </aside>

      {/* Main content */}
      <main className="flex-grow p-4 lg:ml-12 lg:mr-12 lg:p-8 relative z-10">
        {children}
      </main>

      {/* Right Sidebar */}
      <aside ref={rightRef}
        className={`
          fixed inset-y-0 right-0 w-64 bg-white/10 backdrop-blur-lg p-6
          border-l border-white/20 shadow-2xl z-50
          transform transition-all duration-300
          ${rightOpen ? "translate-x-0" : "translate-x-full"}
        `}
      > 
        <button
          onClick={() => setRightOpen(false)}
          className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-all duration-200"
        >
          <XIcon className="h-5 w-5" />
        </button>

        <div className="mt-12">
          <PopularUsers token={token} />
        </div>
      </aside>

<nav
  className={`fixed top-0 left-0 w-full bg-gray-800/70 backdrop-blur-xl p-4 lg:hidden flex items-center justify-between border-b border-white/25 shadow-2xl z-40 transform transition-transform duration-300 ${
    showTopBar ? "translate-y-0" : "-translate-y-full"
  }`}
>
  {userId && (
    <Link to={`/user/${userId}`} className="flex items-center space-x-3">
      <img
        src={profilePicture || defaultPfp}
        onError={(e) => {
          const target = e.currentTarget;
          if (target.src !== window.location.origin + defaultPfp) {
            target.src = defaultPfp;
          }
        }}
        alt={username}
        className="w-10 h-10 rounded-full border-2 border-white/30 shadow-lg"
      />
      <div className="flex flex-col">
        <span className="text-base font-semibold text-white drop-shadow-md">{name}</span>
        <span className="text-sm text-gray-100 drop-shadow-md">@{username}</span>
      </div>
    </Link>
  )}
  <Form method="post" action="/logout">
    <button
      type="submit"
      className="flex items-center space-x-2 text-base font-medium text-white hover:text-red-400 transition-all duration-200 p-2 rounded-lg hover:bg-white/15 drop-shadow-md"
      onClick={(e) => {
        if (!window.confirm("Are you sure you want to log out?")) {
          e.preventDefault();
        }
      }}
    >
      <LogoutIcon className="h-6 w-6" />
      <span>Log Out</span>
    </button>
  </Form>
</nav>


<nav
  className={`fixed bottom-0 left-0 w-full bg-gray-800/70 backdrop-blur-xl p-4 lg:hidden flex justify-around border-t border-white/25 shadow-2xl z-40 transform transition-transform duration-300 ${
    showBottomBar ? "translate-y-0" : "translate-y-full"
  }`}
>
  {[
    { icon: HomeIcon, to: "/home", label: "Home", count: 0 },
    { icon: UserIcon, to: "/follow", label: "Followers", count: followRequests },
    { icon: BookOpenIcon, to: "/library", label: "Library", count: 0 },
    { icon: SearchIcon, to: "/discover", label: "Discover", count: 0 },
    { icon: BellIcon, to: "/notifications", label: "Notifications", count: unseenNotifications },
    { icon: ChatIcon, to: "/chats", label: "Chat", count: unreadMessagesCount },
  ].map(({ icon: Icon, to, label, count }) => (
    <Link
      key={to}
      to={to}
      className={`text-sm font-medium hover:text-indigo-400 flex flex-col items-center relative transition-all duration-200 p-2 rounded-lg ${
        location.pathname === to ? "text-indigo-400 bg-white/15" : "text-gray-100 hover:text-white"
      }`}
    >
      <Icon className="h-6 w-6 mb-1 drop-shadow-md" />
      <span className="text-xs drop-shadow-md">{label}</span>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs px-1.5 py-0.5 min-w-[18px] text-center leading-none shadow-lg">
          {count}
        </span>
      )}
    </Link>
  ))}
</nav>
    </div>
  );
}