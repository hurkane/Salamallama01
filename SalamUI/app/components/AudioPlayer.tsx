import React, { useEffect, useState, useRef } from "react";
import WaveSurfer from "wavesurfer.js";

const AudioPlayer = ({ audioPreview, handleRemoveMedia }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const waveSurferRef = useRef(null);
  const waveformContainerRef = useRef(null);

  useEffect(() => {
    if (waveformContainerRef.current) {
      waveSurferRef.current = WaveSurfer.create({
        container: waveformContainerRef.current,
        waveColor: "violet",
        progressColor: "purple",
        cursorColor: "navy",
        responsive: true,
        height: 40, // Reduced the height to make it thinner
      });

      waveSurferRef.current.on("play", () => setIsPlaying(true));
      waveSurferRef.current.on("pause", () => setIsPlaying(false));
    }

    return () => {
      if (waveSurferRef.current) {
        waveSurferRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (audioPreview && waveSurferRef.current) {
      waveSurferRef.current.load(audioPreview);
    }
  }, [audioPreview]);

  const handlePlayPause = () => {
    if (waveSurferRef.current.isPlaying()) {
      waveSurferRef.current.pause();
    } else {
      waveSurferRef.current.play();
    }
  };

  const handleMuteUnmute = () => {
    setIsMuted((prevState) => {
      const newState = !prevState;
      waveSurferRef.current.setVolume(newState ? 0 : 1);
      return newState;
    });
  };

  return (
    <div className="w-full bg-gray-800 p-2 rounded-lg flex items-center h-12">
      {" "}
      {/* Adjusted height */}
      <button
        type="button"
        onClick={handlePlayPause}
        className="play-button text-white mr-2 flex-shrink-0"
      >
        {isPlaying ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-4 h-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 9v6m4-6v6"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-4 h-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 3v18l15-9L5 3z"
            />
          </svg>
        )}
      </button>
      <div ref={waveformContainerRef} className="w-full h-12"></div>
      <button
        type="button"
        onClick={handleMuteUnmute}
        className="mute-button text-white ml-2 flex-shrink-0"
      >
        {isMuted ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-4 h-4"
          >
            {" "}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11 5L6 9H2v6h4l5 4V5z"
            />{" "}
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-4 h-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11 5L6 9H2v6h4l5 4V5z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 9v6M19 9v6"
            />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={handleRemoveMedia}
        className="bg-gray-700 text-white rounded-full p-1 ml-2 flex-shrink-0"
      >
        X
      </button>
    </div>
  );
};

export default AudioPlayer;
