// SocketContext.js
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io } from "socket.io-client";
import { API_BASE_URL } from "~/utils/api";

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ token, children }) => {
  const socket = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    socket.current = io(`${API_BASE_URL}:5008`, {
      auth: { token },
    });

    socket.current.on("connect", () => {
      console.log("Socket.io connected!");
      setConnected(true);
      socket.current.emit("setup", { token });
    });

    socket.current.on("disconnect", () => {
      console.log("Socket.io disconnected!");
      setConnected(false);
    });

    return () => {
      console.log("Disconnecting from Socket.io...");
      socket.current.disconnect();
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket: socket.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
};
