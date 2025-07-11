// app/components/BookDefaultView.tsx
import { Link } from "@remix-run/react";
import { useState } from "react";

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

interface BookDefaultViewProps {
  book: Book;
  sortedPages: Page[];
  imageMap: Map<number, string>;
}

export function BookDefaultView({ book, sortedPages, imageMap }: BookDefaultViewProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const goToPrevious = () => {
    setCurrentPageIndex((prev) => Math.max(0, prev - 1));
  };

  const goToNext = () => {
    setCurrentPageIndex((prev) => Math.min(sortedPages.length - 1, prev + 1));
  };

  const currentPage = sortedPages[currentPageIndex];

  return (
    <div className="min-h-screen w-full">
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-white">Book Content</h2>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-400">
              {sortedPages.length} {sortedPages.length === 1 ? 'page' : 'pages'}
            </span>
          </div>
        </div>
        
        {sortedPages.length > 0 ? (
          <div className="space-y-6">
            {/* Navigation Controls */}
            <div className="flex items-center justify-between">
              <button
                onClick={goToPrevious}
                disabled={currentPageIndex === 0}
                className="flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>

              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-400">
                  Page {currentPageIndex + 1} of {sortedPages.length}
                </span>
                {/* Page number input for quick navigation */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-400">Go to:</span>
                  <input
                    type="number"
                    min="1"
                    max={sortedPages.length}
                    value={currentPageIndex + 1}
                    onChange={(e) => {
                      const pageNum = parseInt(e.target.value);
                      if (pageNum >= 1 && pageNum <= sortedPages.length) {
                        setCurrentPageIndex(pageNum - 1);
                      }
                    }}
                    className="w-16 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm text-center focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                onClick={goToNext}
                disabled={currentPageIndex === sortedPages.length - 1}
                className="flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200"
              >
                Next
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Current Page Display */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden hover:border-white/20 transition-all duration-300">
              {/* Page Header */}
              <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 px-6 py-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white flex items-center">
                    <span className="bg-indigo-500/30 text-indigo-200 px-3 py-1 rounded-full text-sm mr-3">
                      Page {currentPage.pageNumber}
                    </span>
                    {currentPage.wordCount && (
                      <span className="text-sm text-gray-400">
                        {currentPage.wordCount.toLocaleString()} words
                      </span>
                    )}
                  </h3>
                  <div className="text-sm text-gray-400">
                    {currentPageIndex + 1} of {sortedPages.length}
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-5 gap-0">
                {/* Text Content */}
                <div className="lg:col-span-3 p-6">
                  <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                    <div className="p-6 max-h-96 overflow-y-auto custom-scrollbar">
                      {currentPage.text?.trim() ? (
                        <div className="prose prose-invert max-w-none">
                          <div className="text-gray-200 leading-relaxed whitespace-pre-wrap font-serif text-base">
                            {currentPage.text.trim()}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12 text-gray-400">
                          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="text-sm">No text content available for this page.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Image Content */}
                <div className="lg:col-span-2 p-6">
                  <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 h-full">
                    {imageMap.has(currentPage.pageNumber) ? (
                      <div className="p-4">
                        <img
                          src={imageMap.get(currentPage.pageNumber)}
                          alt={`Page ${currentPage.pageNumber}`}
                          className="w-full h-auto rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300"
                          loading="lazy"
                          onLoad={() => {
                            console.log(`✅ Image loaded successfully for page ${currentPage.pageNumber}`);
                          }}
                          onError={(e) => {
                            console.error(`❌ Image failed to load for page ${currentPage.pageNumber}:`, imageMap.get(currentPage.pageNumber));
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent && parent.nextElementSibling) {
                              (parent.nextElementSibling as HTMLElement).style.display = 'flex';
                            }
                          }}
                        />
                        <div className="h-full min-h-[200px] hidden items-center justify-center text-gray-400">
                          <div className="text-center p-6">
                            <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-sm opacity-60">Failed to load image</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full min-h-[200px] flex items-center justify-center text-gray-400">
                        <div className="text-center p-6">
                          <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-sm opacity-60">No image available</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Navigation (Optional - for easier navigation) */}
            <div className="flex justify-center">
              <div className="flex items-center space-x-2">
                <button
                  onClick={goToPrevious}
                  disabled={currentPageIndex === 0}
                  className="p-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <span className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm">
                  {currentPageIndex + 1} / {sortedPages.length}
                </span>
                
                <button
                  onClick={goToNext}
                  disabled={currentPageIndex === sortedPages.length - 1}
                  className="p-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto bg-white/10 rounded-full flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-medium text-white mb-2">No content available</h3>
            <p className="text-gray-400 mb-4">The book may still be processing or there was an error during upload.</p>
            <Link
              to="/books"
              className="inline-flex items-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              Return to Library
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}