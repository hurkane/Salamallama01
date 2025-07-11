import React, { useState, useEffect, useRef } from "react";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link, useNavigate } from "@remix-run/react";
import AudioPlayer from "~/components/AudioPlayer";
import axios from "axios";
import { getSession } from "~/sessions";
import {
  getChatById,
  getUserInfo,
  getProfilePicture,
  API_BASE_URL,
} from "~/utils/api";
import format from "date-fns/format";
import isToday from "date-fns/isToday";
import isThisWeek from "date-fns/isThisWeek";
import parseISO from "date-fns/parseISO";
import io from "socket.io-client";
import ReactPlayer from "react-player";
import ChatLayout from "~/components/ChatLayout";

import UrlPreview from "~/components/UrlPreview";
import ChatAudioPlayer from "~/components/ChatAudioPlayer";

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
    return <span key={index}>{part}</span>;
  });
}

const ENDPOINT = API_BASE_URL.replace(/^http/, "ws");
let socket, selectedChatCompare;

export const loader = async ({ request, params }) => {
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("token");
  const userId = session.get("userId");
  const { chatId } = params;

  if (!token || !userId || !chatId) {
    return redirect("/sign-in");
  }

  try {
    const chat = await getChatById(chatId, token);
    return json({ userId, chat, token });
  } catch (error) {
    console.error("Error loading chat data:", error);
    return json({ error: error.message }, { status: 404 });
  }
};

const ChatPage = () => {
  const { userId, chat, token, error } = useLoaderData();
  const [chatDetails, setChatDetails] = useState(chat || {});
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [fetchError, setFetchError] = useState("");
  const [typing, setTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [mediaFile, setMediaFile] = useState(null);
  const lastTypingTime = useRef(new Date().getTime());
  const typingTimeout = useRef(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const messagesEndRef = useRef(null);
  const [isClient, setIsClient] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [expandedMessages, setExpandedMessages] = useState({});
  const [isRecording, setIsRecording] = useState(false);
  const [audioPreview, setAudioPreview] = useState("");
  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);
  const textareaRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userDetails, setUserDetails] = useState({});
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);

  const isMessageReadByAll = (msg) => {
    return msg.readBy.length === users.length;
  };
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const messageContainerRef = useRef(null);
  const threshold = 20;

  const toggleReadMore = (id) => {
    setExpandedMessages((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const scrollToBottom = () => {
    const messageContainer = messageContainerRef.current;
    if (messageContainer) {
      messageContainer.scrollTo({
        top: messageContainer.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const fetchChatData = async (page = 1, maintainPosition = false) => {
    try {
      setLoadingMessages(true);
      const response = await axios.get(
        `${API_BASE_URL}/api/message/chat/${chat._id}?page=${page}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const fetchedMessages = response.data.messages.reverse() || [];
      const usersToFetch = [
        ...new Set(fetchedMessages.map((msg) => msg.sender)),
        userId,
      ];
      const updatedUserDetails = { ...userDetails };

      for (const userId of usersToFetch) {
        if (!updatedUserDetails[userId]) {
          const userDetails = await getUserInfo(userId, token);
          const profilePicture = await getProfilePicture(userId, token);
          updatedUserDetails[userId] = {
            username: userDetails.username,
            name: userDetails.name,
            profilePicture,
          };
        }
      }

      setUserDetails(updatedUserDetails);

      const updatedMessages = fetchedMessages.map((msg) => ({
        ...msg,
        senderDetails: updatedUserDetails[msg.sender],
      }));

      if (page === 1) {
        setMessages(updatedMessages);
      } else {
        setMessages((prevMessages) => [...updatedMessages, ...prevMessages]);
      }

      setChatDetails(response.data.chat || {});
      setUsers(response.data.users || []);
      setPage(response.data.page);
      setTotalPages(response.data.totalPages);

      socket.emit("mark as read", { chatId: chat._id, userId });
    } catch (error) {
      console.error("Error fetching chat data:", error);
      setFetchError("Error fetching chat data.");
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (!chat || !chat._id || !userId || !token) {
      console.error("Required properties are missing: ", {
        chat,
        userId,
        token,
      });
      return;
    }

    fetchChatData();

    socket = io(ENDPOINT);
    socket.emit("setup", { _id: userId });
    socket.emit("join chat", chat._id);
    socket.emit("mark as read", { chatId: chat._id, userId });

    socket.on("message received", async (newMessageReceived) => {
      if (selectedChatCompare === newMessageReceived.chat._id) {
        const senderId = newMessageReceived.sender;
        if (!userDetails[senderId]) {
          const userDetails = await getUserInfo(senderId, token);
          const profilePicture = await getProfilePicture(senderId, token);
          setUserDetails((prevDetails) => ({
            ...prevDetails,
            [senderId]: {
              username: userDetails.username,
              name: userDetails.name,
              profilePicture,
            },
          }));
          newMessageReceived.senderDetails = {
            username: userDetails.username,
            name: userDetails.name,
            profilePicture,
          };
        } else {
          newMessageReceived.senderDetails = userDetails[senderId];
        }

        setMessages((prevMessages) => [...prevMessages, newMessageReceived]);

        socket.emit("mark as read", {
          chatId: newMessageReceived.chat._id,
          userId,
        });

        if (isAtBottom) {
          scrollToBottom();
        } else {
          setShowNewMessageIndicator(true);
        }
      }
    });

    socket.on("message read", (updatedMessages) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) => {
          const updatedMsg = updatedMessages.find(
            (updated) => updated._id === msg._id
          );
          return updatedMsg ? { ...msg, readBy: updatedMsg.readBy } : msg;
        })
      );
    });

    socket.on("typing", (userId) => {
      setIsTyping(true);
      setTypingUser(userId);
    });

    socket.on("stop typing", () => {
      setIsTyping(false);
      setTypingUser(null);
    });

    socket.on("user online", (userId) => {
      setOnlineUsers((prevOnlineUsers) => [...prevOnlineUsers, userId]);
    });

    socket.on("user offline", (userId) => {
      setOnlineUsers((prevOnlineUsers) =>
        prevOnlineUsers.filter((id) => id !== userId)
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [chat._id, userId, token]);

  // Function to handle marking messages as read
  const markMessageAsRead = () => {
    socket.emit("mark as read", { chatId: chat._id, userId });
  };

  // Ensure messages are marked as read when the user views them
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        messages.forEach((msg) => {
          if (!msg.readBy.includes(userId)) {
            markMessageAsRead();
          }
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [messages]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    selectedChatCompare = chat._id;
  }, [chat._id]);

  useEffect(() => {
    if (isAtBottom && !loadingMore && !loadingMessages) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAtBottom, loadingMore, loadingMessages]);

  useEffect(() => {
    const messageContainer = messageContainerRef.current;

    // Function to check if user is at the bottom
    const checkIfUserIsAtBottom = () => {
      const isUserAtBottom =
        messageContainer.scrollHeight - messageContainer.scrollTop <=
        messageContainer.clientHeight + threshold;
      setIsAtBottom(isUserAtBottom);
    };

    const handleScroll = () => {
      checkIfUserIsAtBottom();
    };

    messageContainer.addEventListener("scroll", handleScroll);
    checkIfUserIsAtBottom();

    return () => {
      messageContainer.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    if (page < totalPages) {
      const messageContainer = messageContainerRef.current;

      await fetchChatData(page + 1, false);

      // Wait for a short period before scrolling to the top
      setTimeout(() => {
        // Temporarily disable auto-scroll to avoid conflicts
        setIsAtBottom(false);
        messageContainer.scrollTo({
          top: 0,
          behavior: "auto",
        });

        // Re-enable auto-scroll after a delay
        setTimeout(() => {
          setLoadingMore(false);
        }, 100); // Adjust this delay if needed
      }, 200); // Adjust this delay as needed
    } else {
      setLoadingMore(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && !mediaFile) {
      console.error("Invalid data: content or file is required");
      return;
    }

    const formData = new FormData();
    formData.append("content", newMessage || "");
    formData.append("chatId", chat._id);
    if (mediaFile) {
      formData.append("file", mediaFile);
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/message/`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const fullMessage = response.data;

      // Fetch user details for the logged-in user if not already available
      if (!userDetails[userId]) {
        const userDetails = await getUserInfo(userId, token);
        const profilePicture = await getProfilePicture(userId, token);
        setUserDetails((prevDetails) => ({
          ...prevDetails,
          [userId]: {
            username: userDetails.username,
            name: userDetails.name,
            profilePicture,
          },
        }));
        fullMessage.senderDetails = {
          username: userDetails.username,
          name: userDetails.name,
          profilePicture,
        };
      } else {
        fullMessage.senderDetails = userDetails[userId];
      }

      socket.emit("new message", fullMessage);
      setMessages([...messages, fullMessage]);
      setNewMessage("");
      setMediaFile(null);
      setPreviewUrl("");
      setAudioPreview("");
      socket.emit("stop typing", chat._id);
      socket.emit("mark as read", { chatId: chat._id, userId });
    } catch (error) {
      console.error("Error sending message:", error);
      setFetchError("Error sending message.");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setMediaFile(file);
    if (file) {
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);
    }
  };

  const handleRemoveMedia = () => {
    setMediaFile(null);
    setPreviewUrl("");
    setAudioPreview("");
  };

  // Listen for typing
  useEffect(() => {
    socket.on("typing", (userId) => {
      setIsTyping(true);
      setTypingUser(userId);
    });

    socket.on("stop typing", () => {
      setIsTyping(false);
      setTypingUser(null);
    });

    return () => {
      socket.off("typing");
      socket.off("stop typing");
    };
  }, []);

  const handleNewMessageChange = (e) => {
    setNewMessage(e.target.value);
    const el = e.target;
    el.style.height = "auto"; // reset
    el.style.height = `${el.scrollHeight}px`; // expand
    if (!typing) {
      setTyping(true);
      socket.emit("typing", chat._id);
    }

    lastTypingTime.current = new Date().getTime();

    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    typingTimeout.current = setTimeout(() => {
      const timeNow = new Date().getTime();
      const timeDiff = timeNow - lastTypingTime.current;

      if (timeDiff >= 3000 && typing) {
        socket.emit("stop typing", chat._id);
        setTyping(false);
      }
    }, 3000);
  };

  const getUserDetails = (userId) => {
    return (
      userDetails[userId] || {
        username: "Unknown User",
        profilePicture: "/default_profile_pic.png",
        name: "",
      }
    );
  };

  const formatTimestamp = (timestamp) => {
    const date = parseISO(timestamp);
    if (isToday(date)) {
      return format(date, "h:mm a");
    } else if (isThisWeek(date)) {
      return format(date, "EEEE h:mm a");
    } else if (date.getFullYear() === new Date().getFullYear()) {
      return format(date, "MMM d h:mm a");
    } else {
      return format(date, "MMM d, yyyy h:mm a");
    }
  };

  const getTypingUserName = () => {
    const user = getUserDetails(typingUser);
    return user.username !== "Unknown User"
      ? `${user.username}`
      : "Someone is typing...";
  };

  const getChatTitle = (chat) => {
    if (chat.isGroupChat) {
      return chat.chatName;
    } else {
      const chatParticipant = users.find((user) => user._id !== userId);
      return chatParticipant?.usernames || "Chat Details";
    }
  };

  const handleMediaClick = (mediaUrl) => {
    if (isAudio(mediaUrl)) {
      // Skip opening the modal for audio files
      return;
    }
    setSelectedMedia(mediaUrl);
    setIsModalOpen(true);
  };
  const getFileExtension = (url) => {
    const path = url.split("?")[0];
    return path.substring(path.lastIndexOf(".")).toLowerCase();
  };
  const isVideo = (url) => {
    if (!url) return false;
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
    if (!url) return false;
    const audioExtensions = [".mp3", ".wav", ".ogg", ".m4a"];
    const urlWithoutParams = url.split("?")[0];
    return audioExtensions.some((ext) => urlWithoutParams.endsWith(ext));
  };

  const handleAudioRecord = async () => {
    if (isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (e) => {
          audioChunks.current.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks.current, {
            type: "audio/wav",
          });
          const audioUrl = URL.createObjectURL(audioBlob);
          setAudioPreview(audioUrl);
          setMediaFile(
            new File([audioBlob], "recording.wav", { type: "audio/wav" })
          );
          audioChunks.current = [];
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Failed to access microphone", err);
      }
    }
  };

  const shouldGroupWithPreviousMessage = (currentMessage, previousMessage) => {
    if (!previousMessage) return false;
    const currentTime = new Date(currentMessage.createdAt);
    const previousTime = new Date(previousMessage.createdAt);
    const sameUser = currentMessage.sender === previousMessage.sender;
    const withinSameMinute = Math.abs(currentTime - previousTime) < 60000;
    return sameUser && withinSameMinute;
  };

  const handleCloseMedia = () => {
    setSelectedMedia(null);
  };

  if (error) {
    return <p>Error: {error}</p>;
  }

return (
  <div className="relative h-screen flex flex-col">
    <ChatLayout userId={userId} token={token}>
<div className="chat-page flex flex-col w-full min-h-screen text-white relative pt-[23px] pb-[23px]">
        {/* Background with blur effect - Fixed for mobile */}
        <div
          className="fixed inset-0 bg-center bg-repeat opacity-20 pointer-events-none"
          style={{
            backgroundImage: "url('/default_chat.png')",
            backgroundSize: "contain",
            backgroundPosition: "center",
            filter: "blur(8px)",
          }}
        ></div>

        <div className="relative z-10 w-full h-full flex flex-col">
          {fetchError && (
            <div className="p-2 sm:p-4">
              <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 sm:p-4">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-300 text-sm sm:text-base">{fetchError}</p>
                </div>
              </div>
            </div>
          )}

          {!fetchError && (
            <>
              {/* Top Bar - Fixed positioning */}
              <div className="w-full fixed top-0 left-0 right-0 z-50">
                <div className="bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50 p-4">
                  <div className="flex items-center justify-between max-w-full mx-auto px-4">
                    {/* Back Button */}
    
      <button
        className="flex items-center space-x-2 px-4 py-2 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 text-gray-300 hover:text-white hover:bg-white/20 transition-all duration-200"
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
        <span>Back</span>
      </button>
    

                    
                    <h1
                      onClick={() => navigate(`/ChatDetails/${chat._id}`)}
                      className="cursor-pointer text-center text-white font-medium hover:text-blue-400 transition-colors flex-1 mx-4"
                    >
                      {getChatTitle(chatDetails)}
                    </h1>

                    {/* Call Button */}
                    <div className="flex items-center">
                    <button
                        onClick={() => navigate(`/call/${chat._id}`)}
                        className="flex items-center space-x-2 text-white hover:text-green-400 transition-colors"
                        style={{ marginRight: '10px' }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span>Call</span>
                      </button>
                  </div>
                  </div>
                </div>
              </div>

              {/* Messages Container - Adjusted padding */}
              <div className="flex-1 overflow-hidden pt-14 sm:pt-16 pb-20 sm:pb-24">
                <div className="h-full max-w-4xl mx-auto px-2 sm:px-4">
                  <div ref={messageContainerRef} className="h-full overflow-y-auto">
                    {/* Load More Button */}
                    {page < totalPages && (
                      <div className="flex justify-center my-4 sm:my-6">
                        <button
                          onClick={handleLoadMore}
                          className="px-4 py-2 sm:px-6 sm:py-3 bg-slate-800/80 backdrop-blur-sm text-white rounded-xl border border-slate-600/50 hover:bg-slate-700/80 transition-colors shadow-lg text-sm sm:text-base"
                        >
                          Load More Messages
                        </button>
                      </div>
                    )}

                    {/* Messages List */}
                    <div className="space-y-3 sm:space-y-4 pb-4">
                      {messages.length > 0 ? (
                        messages.map((msg, index) => {
                          const isLink = isClient && ReactPlayer.canPlay(msg.content);
                          const allUsersRead = msg.readBy.length === users.length;
                          const isExpanded = expandedMessages[msg._id];
                          const showFullMessage = isExpanded || msg.content.length <= 300;
                          const messagePreview = msg.content.substring(0, 300);
                          const previousMessage = messages[index - 1];
                          const groupWithPrevious = shouldGroupWithPreviousMessage(msg, previousMessage);
                          const isOwnMessage = msg.sender === userId;

                          return (
                            <div
                              key={msg._id}
                              className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                            >
                              <div className={`max-w-[280px] sm:max-w-xs lg:max-w-md ${isOwnMessage ? "order-2" : "order-1"}`}>
                                {/* User Info */}
                                {!groupWithPrevious && (
                                  <div className={`flex items-center mb-1 sm:mb-2 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                                    <Link
                                      to={`/user/${msg.sender}`}
                                      className="flex items-center space-x-1 sm:space-x-2 hover:opacity-80 transition-opacity"
                                    >
                                      <img
                                        src={getUserDetails(msg.sender).profilePicture || "/default_profile_pic.png"}
                                        alt={getUserDetails(msg.sender).username}
                                        className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-slate-600/50"
                                      />
                                      <div className="flex items-center space-x-1">
                                        <span className="font-medium text-white text-sm sm:text-base">
                                          @{getUserDetails(msg.sender).username}
                                        </span>
                                        {onlineUsers.includes(msg.sender) && (
                                          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></span>
                                        )}
                                      </div>
                                    </Link>
                                  </div>
                                )}

                                {/* Message Content */}
                                <div
                                  className={`p-2 sm:p-3 rounded-2xl backdrop-blur-sm ${
                                    isOwnMessage
                                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                                      : "bg-slate-800/60 border border-slate-600/50 text-white"
                                  }`}
                                >
                                  <div className="whitespace-pre-wrap break-words text-sm sm:text-base">
                                    {makeUrlsClickable(
                                      showFullMessage ? msg.content : `${messagePreview}...`
                                    )}
                                  </div>
                                  
                                  {!showFullMessage && (
                                    <button
                                      onClick={() => toggleReadMore(msg._id)}
                                      className="text-blue-300 hover:text-blue-200 mt-1 text-xs sm:text-sm font-medium"
                                    >
                                      Read More
                                    </button>
                                  )}

                                  {/* Media Content */}
                                  {msg.mediaUrl && (
                                    <div className="mt-2 rounded-xl overflow-hidden">
                                      {isVideo(msg.mediaUrl) ? (
                                        <ReactPlayer
                                          url={msg.mediaUrl}
                                          controls
                                          width="100%"
                                          height="auto"
                                          config={{
                                            file: {
                                              attributes: {
                                                controlsList: "nodownload",
                                              },
                                            },
                                          }}
                                        />
                                      ) : isAudio(msg.mediaUrl) ? (
                                        <audio controls src={msg.mediaUrl} className="w-full" />
                                      ) : (
                                        <img
                                          src={msg.mediaUrl}
                                          alt="Media"
                                          className="w-full rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                                          onClick={() => handleMediaClick(msg.mediaUrl)}
                                          loading="lazy"
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Message Footer */}
                                <div className={`flex items-center mt-1 text-xs text-gray-400 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                                  <span>{formatTimestamp(msg.createdAt)}</span>
                                  {isOwnMessage && (
                                    <span className="ml-2">
                                      {allUsersRead ? (
                                        <span className="text-blue-400">✓✓</span>
                                      ) : (
                                        <span className="text-gray-500">✓</span>
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-8 sm:py-12">
                          <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-600/50 p-6 sm:p-8">
                            <svg className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <p className="text-gray-300 text-sm sm:text-base">Start conversation by sending a message.</p>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Typing Indicator */}
                    {isTyping && typingUser && (
                      <div className="text-gray-400 text-xs sm:text-sm mb-4 px-2 sm:px-0">
                        {getTypingUserName()} is typing...
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Message Input - Optimized for mobile */}
<div className="fixed bottom-0 left-0 right-0 z-40 px-2 sm:px-4 pb-[env(safe-area-inset-bottom)]" style={{ paddingRight: '25px' }}>
<div className="bg-slate-900/95 backdrop-blur-lg border-t border-slate-700/50 px-3 py-3 sm:py-4 rounded-t-xl pb-[27px]">
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSendMessage} className="flex items-end space-x-2 sm:space-x-3">
        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={handleNewMessageChange}
 className="w-full min-h-[40px] max-h-[200px] p-3 sm:p-4 bg-slate-800/60 backdrop-blur-sm border border-slate-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none text-base sm:text-lg overflow-y-auto"
            placeholder="Type a message..."
            rows="1"
style={{
  maxHeight: `${4 * 24}px`, // allow 4 lines at most (adjust as needed)
  overflowY: "auto",
}}
                        />
                        
                        {/* Media Preview */}
                        {previewUrl && (
                          <div className="absolute -top-16 sm:-top-20 left-0 bg-slate-800/80 backdrop-blur-sm rounded-lg p-2 border border-slate-600/50">
                            <div className="relative">
                              {mediaFile?.type.startsWith("image") ? (
                                <img src={previewUrl} alt="Preview" className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded" />
                              ) : (
                                <video src={previewUrl} controls className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded" />
                              )}
                              <button
                                type="button"
                                onClick={handleRemoveMedia}
                                className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-red-500 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        )}

                        {audioPreview && (
                          <AudioPlayer
                            audioPreview={audioPreview}
                            handleRemoveMedia={handleRemoveMedia}
                          />
                        )}
                      </div>

                      {/* Action Buttons - Compact for mobile */}
                      <div className="flex space-x-1 sm:space-x-2">
                        {/* File Upload */}
                        <label htmlFor="file-input" className="p-2 sm:p-3 bg-slate-800/60 backdrop-blur-sm border border-slate-600/50 rounded-xl text-gray-400 hover:text-white hover:bg-slate-700/60 cursor-pointer transition-colors">
                          <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                        </label>
                        <input
                          id="file-input"
                          type="file"
                          onChange={handleFileChange}
                          className="hidden"
                        />

                        {/* Audio Record */}
                        <button
                          type="button"
                          onClick={handleAudioRecord}
                          className={`p-2 sm:p-3 rounded-xl transition-colors ${
                            isRecording
                              ? "bg-red-500 text-white"
                              : "bg-slate-800/60 backdrop-blur-sm border border-slate-600/50 text-gray-400 hover:text-white hover:bg-slate-700/60"
                          }`}
                        >
                          {isRecording ? (
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                          )}
                        </button>

                        {/* Send Button */}
                        <button
                          type="submit"
                          className="p-4 sm:p-5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Fullscreen Media Modal */}
        {isModalOpen && selectedMedia && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
            <button
              onClick={handleCloseMedia}
              className="absolute top-4 right-4 text-white hover:text-gray-300 text-xl sm:text-2xl bg-black/50 rounded-full w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center backdrop-blur-sm"
            >
              ×
            </button>
            {selectedMedia.includes(".mp4") ? (
              <video
                src={selectedMedia}
                controls
                className="max-w-[90%] max-h-[90%] rounded-xl"
              />
            ) : (
              <img
                src={selectedMedia}
                alt="Media"
                className="max-w-[90%] max-h-[90%] rounded-xl"
              />
            )}
          </div>
        )}
      </div>
    </ChatLayout>
  </div>
);
};

export default ChatPage;
