import React, { useState, useEffect } from "react";
import ChatNavBar from "~/components/ChatNavBar"; // Adjust the path as needed

const ChatLayout = ({ children, userId, token }) => {
  const [isNavCollapsed, setIsNavCollapsed] = useState(true); // State for collapse set to true by default
  const [isMobile, setIsMobile] = useState(false);

  // Check if screen is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleNav = () => setIsNavCollapsed(!isNavCollapsed);

  // Use the collapse state for both mobile and desktop
  const actualCollapsed = isNavCollapsed;

  // Responsive dimensions - different sizes for mobile vs desktop
  const collapsedWidth = isMobile ? "w-8" : "w-12"; // Smaller collapsed width on mobile
  const expandedWidth = "w-80"; // Keep same expanded width
  const collapsedPadding = isMobile ? "pr-8" : "pr-12"; // Matching padding for collapsed
  const expandedPadding = "pr-80"; // Keep same expanded padding

  return (
    <div className="chat-layout flex h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <div
        className={`chat-content flex-grow h-full overflow-y-auto transition-all duration-300 ${
          actualCollapsed ? collapsedPadding : expandedPadding
        }`}
      >
        {React.cloneElement(children, { isNavCollapsed: actualCollapsed })}
      </div>
      <div
        className={`fixed top-0 right-0 h-full overflow-y-auto z-50 transition-all duration-300 ${
          actualCollapsed ? collapsedWidth : expandedWidth
        }`}
      >
        <ChatNavBar
          userId={userId}
          token={token}
          isCollapsed={actualCollapsed}
          toggleNav={toggleNav}
          isMobile={isMobile} // Pass mobile state to navbar
        />
      </div>
    </div>
  );
};

export default ChatLayout;
