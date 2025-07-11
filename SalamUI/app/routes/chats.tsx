// routes/chat.tsx
import { chatLoader } from "~/Loaders/ChatLoader";
import ChatPage from "~/components/ChatsPage"; // Adjust the path if necessary

export const loader = chatLoader;

export default function Chat() {
  return <ChatPage />;
}
