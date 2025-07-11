import React, { useState, useEffect } from "react";
import { fetchMetadata } from "~/utils/api";
import ReactPlayer from "react-player";

function UrlPreview({ url }) {
  const [metadata, setMetadata] = useState(null);

  useEffect(() => {
    async function getMetadata() {
      const data = await fetchMetadata(url);
      setMetadata(data);
    }
    getMetadata();
  }, [url]);

  if (!metadata) return null;

  return (
    <>
      <style jsx>{`
        .preview-container {
          border: 1px solid #2d2d2d;
          background-color: #1f1f1f;
          border-radius: 8px;
          padding: 16px;
          margin-top: 16px;
        }
        .preview-container a {
          color: #1e90ff;
          text-decoration: none;
        }
        .preview-container a:hover {
          text-decoration: underline;
        }
        .preview-container img {
          width: 100%;
          max-height: 400px;
          object-fit: contain;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        .preview-container h4 {
          color: #ffffff;
          font-weight: bold;
        }
        .preview-container p {
          color: #a9a9a9;
        }
      `}</style>
      <div className="preview-container">
        <a href={metadata.url} target="_blank" rel="noopener noreferrer">
          {metadata.image && !ReactPlayer.canPlay(metadata.url) && (
            <img
              src={metadata.image}
              alt={metadata.title}
              className="preview-image"
            />
          )}
          <h4>{metadata.title}</h4>
          <p>{metadata.description}</p>
        </a>
        {ReactPlayer.canPlay(metadata.url) && (
          <div className="preview-video mt-2">
            <ReactPlayer
              url={metadata.url}
              width="100%"
              height="auto"
              controls
            />
          </div>
        )}
      </div>
    </>
  );
}

export default UrlPreview;
