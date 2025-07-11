import React, { useState, useRef, useEffect } from "react";
import AudioPlayer from "./AudioPlayer";
import { createPost } from "../utils/api";
import "@fortawesome/fontawesome-free/css/all.min.css";

const CreatePost = ({ token, onPostCreated }) => {
  const [content, setContent] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioPreview, setAudioPreview] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);
  const recordingIntervalRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    if (selectedFile) {
      const preview = URL.createObjectURL(selectedFile);
      setPreviewUrl(preview);
    }
  };

  const handleRemoveMedia = () => {
    setFile(null);
    setPreviewUrl("");
    setAudioPreview("");
    setIsRecording(false);
  };

  const handleAudioRecord = async () => {
    if (isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
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
          setFile(
            new File([audioBlob], "recording.wav", { type: "audio/wav" })
          );

          audioChunks.current = [];
        };

        mediaRecorder.start();
        setIsRecording(true);
        setRecordingTime(0);

        recordingIntervalRef.current = setInterval(() => {
          setRecordingTime((prevTime) => prevTime + 1);
        }, 1000);
      } catch (err) {
        setError(
          "Failed to access microphone. Please allow microphone access."
        );
      }
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const newPost = await createPost(content, file, token);
      setContent("");
      setFile(null);
      setPreviewUrl("");
      setAudioPreview("");
      onPostCreated(newPost);
      window.location.reload();
    } catch (err) {
      setError("Failed to create post.");
      console.error("Error creating post:", err.message);
    }
  };

return (
  <form
    onSubmit={handleSubmit}
    className="w-full p-4"
  >
    <div className="flex flex-col space-y-3">
      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          // Auto-expand textarea
          e.target.style.height = 'auto';
          e.target.style.height = e.target.scrollHeight + 'px';
        }}
        placeholder="What's on your mind?"
        className="w-full p-3 border border-white/20 bg-white/5 backdrop-blur-sm text-white placeholder-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm"
        required
        rows={2}
        style={{ overflow: "hidden", resize: "none", minHeight: "60px", maxHeight: "200px" }}
      />

      {previewUrl && !audioPreview && !isRecording && (
        <div className="preview-container relative inline-block">
          {file.type.startsWith("image") ? (
            <img
              src={previewUrl}
              alt="Media Preview"
              className="w-12 h-12 object-cover border border-white/20 rounded"
            />
          ) : (
            <video
              src={previewUrl}
              controls
              className="w-12 h-12 object-cover border border-white/20 rounded"
            />
          )}
          <button
            type="button"
            onClick={handleRemoveMedia}
            className="absolute -top-1 -right-1 bg-red-500/80 backdrop-blur-sm text-white w-4 h-4 text-xs flex items-center justify-center hover:bg-red-500 transition-colors rounded-full"
          >
            ×
          </button>
        </div>
      )}

      {(audioPreview || isRecording) && (
        <AudioPlayer
          audioPreview={audioPreview}
          handleRemoveMedia={handleRemoveMedia}
        />
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <label className="cursor-pointer p-1.5 bg-white/10 hover:bg-white/20 transition-colors rounded">
            <input type="file" onChange={handleFileChange} className="hidden" />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4 text-gray-300"
            >
              <path d="M16 8l-7 7a3 3 0 01-4.243-4.243l7-7a5 5 0 017.071 7.071l-7.5 7.5a7 7 0 01-9.9-9.9l7.5-7.5" />
            </svg>
          </label>
          <button
            type="button"
            onClick={handleAudioRecord}
            className={`p-1.5 transition-colors rounded ${
              isRecording ? "bg-red-500/80 hover:bg-red-500" : "bg-white/10 hover:bg-white/20"
            } text-white`}
          >
            {isRecording ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <path d="M12 14a4 4 0 004-4V6a4 4 0 00-8 0v4a4 4 0 004 4z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>
        </div>
        <button
          type="submit"
          className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-1.5 text-sm hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200 rounded"
        >
          Post
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  </form>
);
};

export default CreatePost;
