// app/components/BookVisualView.tsx
import { useState, useRef, useEffect } from "react";

interface Page {
  pageNumber: number;
  text: string;
  wordCount: number;
  imageUrl?: string;
}

interface Book {
  id: string;
  fileId: string;
  title: string;
  author: string;
  description: string;
  thumbnail?: string;
  totalPages: number;
  totalWords: number;
  totalImages: number;
  createdAt: string;
  uploaderName: string;
  uploaderUsername: string;
}

interface BookVisualViewProps {
  book: Book;
  pagesWithImages: Page[];
  imageMap: Map<number, string>;
}

export function BookVisualView({ book, pagesWithImages, imageMap }: BookVisualViewProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const nextPage = () => {
    setCurrentPageIndex(prev => Math.min(prev + 1, pagesWithImages.length - 1));
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const prevPage = () => {
    setCurrentPageIndex(prev => Math.max(prev - 1, 0));
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const zoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3));
  };

  const zoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
    // Reset pan when zooming out to prevent image from being stuck off-screen
    if (zoomLevel <= 0.75) {
      setPanOffset({ x: 0, y: 0 });
    }
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Prevent context menu when dragging
  const handleContextMenu = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
    }
  };

  useEffect(() => {
    const handleMouseUpGlobal = () => setIsDragging(false);
    document.addEventListener('mouseup', handleMouseUpGlobal);
    return () => document.removeEventListener('mouseup', handleMouseUpGlobal);
  }, []);

  if (pagesWithImages.length === 0) {
    return (
      <div className="min-h-screen w-full p-8 text-center">
        <div className="w-24 h-24 mx-auto bg-white/10 rounded-full flex items-center justify-center mb-6">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-medium text-white mb-2">No Images Available</h3>
        <p className="text-gray-400">This book doesn't contain any images to display.</p>
      </div>
    );
  }

  const currentPage = pagesWithImages[currentPageIndex];
  if (!currentPage) return null;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header with controls */}
      <div className="sticky top-0 z-10 bg-black/20 backdrop-blur-sm border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Visual Mode</h2>
          
          <div className="flex items-center gap-4">
            {/* Zoom Controls */}
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-2">
              <button
                onClick={zoomOut}
                disabled={zoomLevel <= 0.5}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  zoomLevel <= 0.5
                    ? 'text-gray-500 cursor-not-allowed'
                    : 'text-white bg-slate-600 hover:bg-slate-700'
                }`}
                title="Zoom Out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10h-6" />
                </svg>
              </button>
              
              <span className="text-white text-sm font-medium min-w-[50px] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              
              <button
                onClick={resetZoom}
                className="p-2 rounded-lg text-white bg-slate-600 hover:bg-slate-700 transition-all duration-200"
                title="Reset Zoom"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              
              <button
                onClick={zoomIn}
                disabled={zoomLevel >= 3}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  zoomLevel >= 3
                    ? 'text-gray-500 cursor-not-allowed'
                    : 'text-white bg-slate-600 hover:bg-slate-700'
                }`}
                title="Zoom In"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </button>
            </div>

            <span className="bg-purple-500/30 text-purple-200 px-3 py-1 rounded-full text-sm">
              Page {currentPage.pageNumber}
            </span>
          </div>
        </div>
      </div>

      {/* Full-width image container */}
      <div 
        ref={imageContainerRef}
        className="relative w-full h-[calc(100vh-180px)] overflow-hidden bg-black/20"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        style={{ cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <img
          src={imageMap.get(currentPage.pageNumber)}
          alt={`Page ${currentPage.pageNumber}`}
          className="absolute inset-0 w-full h-full object-contain transition-transform duration-200"
          style={{
            transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
            transformOrigin: 'center'
          }}
          loading="lazy"
          draggable={false}
          onError={(e) => {
            console.error(`Failed to load image for page ${currentPage.pageNumber}`);
            e.currentTarget.style.display = 'none';
            if (e.currentTarget.nextElementSibling) {
              (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
            }
          }}
        />
        
        {/* Error fallback */}
        <div className="hidden absolute inset-0 items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm opacity-60">Failed to load image</p>
          </div>
        </div>
      </div>

      {/* Navigation Controls at Bottom */}
      <div className="sticky bottom-0 bg-black/20 backdrop-blur-sm border-t border-white/10 p-4">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <button
            onClick={prevPage}
            disabled={currentPageIndex === 0}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              currentPageIndex === 0
                ? 'text-gray-500 cursor-not-allowed'
                : 'text-white bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>
          
          <div className="text-center">
            <span className="text-white font-medium">
              {currentPageIndex + 1} of {pagesWithImages.length}
            </span>
          </div>
          
          <button
            onClick={nextPage}
            disabled={currentPageIndex >= pagesWithImages.length - 1}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              currentPageIndex >= pagesWithImages.length - 1
                ? 'text-gray-500 cursor-not-allowed'
                : 'text-white bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            Next
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}