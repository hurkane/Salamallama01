// app/routes/book.$bookId.tsx
import { LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { useState } from "react";
import { getSession } from "~/sessions";
import { BookDefaultView } from "~/components/BookDefaultView";
import { BookVisualView } from "~/components/BookVisualView";

interface Page {
  pageNumber: number;
  text: string;
  wordCount: number;
  imageUrl?: string;
}

interface Image {
  pageNumber: number;
  imageData?: string | null;
  url?: string;
  width?: number;
  height?: number;
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
  genre?: string;
}

interface LoaderData {
  book: Book;
  pages: Page[];
  images: Image[];
  backendUrl: string;
}

type ViewMode = 'default' | 'reading' | 'visual';

export async function loader({ params, request }: LoaderFunctionArgs): Promise<Response> {
  const backendUrl = process.env.API_BASE_URL || "http://192.168.12.242";
  
  try {
    const cookieHeader = request.headers.get("Cookie");
    const session = await getSession(cookieHeader);
    const token = session.get("token");
    const userId = session.get("userId");

    if (!token || !userId) {
      throw new Response("Authentication required", { status: 401 });
    }

    const response = await fetch(`${backendUrl}/api/books/${params.bookId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Response("Book not found", { status: 404 });
      }
      if (response.status === 401) {
        throw new Response("Authentication failed", { status: 401 });
      }
      throw new Response("Failed to fetch book", { status: response.status });
    }

    const data = await response.json();
    
    const transformedData = {
      book: {
        ...data.book,
        thumbnail: data.book.thumbnail ? `${backendUrl}${data.book.thumbnail}` : null
      },
      pages: data.pages || [],
      images: data.images || [],
      backendUrl
    };
    
    return json(transformedData);
  } catch (error) {
    console.error("Error loading book:", error);
    if (error instanceof Response) {
      throw error;
    }
    throw new Response("Failed to load book", { status: 500 });
  }
}

// Quick Reading Component (inline) - simplified version for quick preview
function QuickReadingView({ book, sortedPages }: { book: Book; sortedPages: Page[] }) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  
  const currentPage = sortedPages[currentPageIndex];

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white">Quick Reading Mode</h3>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
            disabled={currentPageIndex === 0}
            className="flex items-center px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>
          
          <span className="text-white font-medium">
            Page {currentPageIndex + 1} of {sortedPages.length}
          </span>
          
          <button
            onClick={() => setCurrentPageIndex(Math.min(sortedPages.length - 1, currentPageIndex + 1))}
            disabled={currentPageIndex === sortedPages.length - 1}
            className="flex items-center px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            Next
            <svg className="w-4 h-4 text-white ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="bg-white/5 rounded-xl p-6 max-h-96 overflow-y-auto">
        <div className="prose prose-invert max-w-none">
          <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">
            {currentPage?.text?.trim() || 'No text content available for this page.'}
          </p>
        </div>
      </div>
      
      {/* Page slider */}
      <div className="mt-6">
        <input
          type="range"
          min="0"
          max={sortedPages.length - 1}
          value={currentPageIndex}
          onChange={(e) => setCurrentPageIndex(parseInt(e.target.value))}
          className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  );
}

export default function BookDetailPage() {
  const { book, pages, images, backendUrl } = useLoaderData<LoaderData>();
  const [viewMode, setViewMode] = useState<ViewMode>('default');

  // Calculate total words from pages
  const calculatedTotalWords = pages.reduce((total, page) => total + (page.wordCount || 0), 0);
  
  // Create a map of images by page number for quick lookup
  const imageMap = new Map<number, string>();
  
  pages.forEach(page => {
    const imageUrl = `${backendUrl}/api/book/${book.id}/page/${page.pageNumber}/image`;
    imageMap.set(page.pageNumber, imageUrl);
  });

  images.forEach(img => {
    if (!imageMap.has(img.pageNumber)) {
      const imageUrl = `${backendUrl}/api/book/${book.id}/page/${img.pageNumber}/image`;
      imageMap.set(img.pageNumber, imageUrl);
    }
  });

  // Sort pages by page number
  const sortedPages = pages.sort((a, b) => a.pageNumber - b.pageNumber);
  
  // Get pages that have images
  const pagesWithImages = sortedPages.filter(page => imageMap.has(page.pageNumber));

return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-900 text-white px-1 sm:px-4 lg:px-8 py-3 lg:py-6 pt-16 lg:pt-6 relative overflow-hidden">
      {/* Background decorative elements matching navigation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-2xl opacity-10 animate-pulse"></div>
      </div>

      <div className="w-full max-w-7xl mx-auto relative z-10">
        
        {/* Top spacing */}
        <div className="h-4 sm:h-8 mb-4 sm:mb-8"></div>
        
        {/* Back Navigation */}
        <Link 
          to="/books" 
          className="inline-flex items-center text-indigo-400 hover:text-indigo-300 transition-all duration-200 mb-4 sm:mb-8 group"
        >
          <svg className="w-4 h-4 mr-2 transition-transform duration-200 group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Library
        </Link>

        {/* Compact Book Header */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-4 sm:p-6 mb-4 sm:mb-8 shadow-2xl">
          <div className="flex gap-4 sm:gap-6">
            {/* Book Cover - Smaller on mobile */}
            <div className="flex-shrink-0">
              {book.thumbnail ? (
                <img 
                  src={book.thumbnail} 
                  alt={`${book.title} cover`}
                  className="w-20 h-28 sm:w-32 sm:h-48 object-cover rounded-xl shadow-2xl"
                  onError={(e) => {
                    console.error('Thumbnail failed to load:', book.thumbnail);
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <div 
                className="w-20 h-28 sm:w-32 sm:h-48 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl shadow-2xl flex items-center justify-center"
                style={{ display: book.thumbnail ? 'none' : 'flex' }}
              >
                <div className="text-center">
                  <svg className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <p className="text-xs text-gray-400">No Preview</p>
                </div>
              </div>
            </div>

            {/* Book Info - Compact */}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2 text-white leading-tight truncate">{book.title}</h1>
              <p className="text-sm sm:text-lg text-gray-300 mb-2 sm:mb-3 truncate">by {book.author}</p>
              
              <div className="flex flex-wrap gap-1 sm:gap-2 mb-2 sm:mb-3">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  📚 {book.genre || 'Fiction'}
                </span>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 sm:p-4 border border-white/20 mb-3 sm:mb-4">
                <p className="text-gray-300 leading-relaxed text-sm sm:text-base line-clamp-2 sm:line-clamp-3">{book.description}</p>
              </div>
              
              {/* Book Stats - Compact Grid */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="bg-gradient-to-r from-blue-500/20 to-blue-600/20 backdrop-blur-lg rounded-lg p-2 sm:p-3 border border-blue-500/30">
                  <div className="text-sm sm:text-xl font-bold text-blue-300">{book.totalPages || 0}</div>
                  <div className="text-xs text-gray-400">Pages</div>
                </div>
                <div className="bg-gradient-to-r from-green-500/20 to-green-600/20 backdrop-blur-lg rounded-lg p-2 sm:p-3 border border-green-500/30">
                  <div className="text-sm sm:text-xl font-bold text-green-300">{calculatedTotalWords.toLocaleString()}</div>
                  <div className="text-xs text-gray-400">Words</div>
                </div>
                <div className="bg-gradient-to-r from-purple-500/20 to-purple-600/20 backdrop-blur-lg rounded-lg p-2 sm:p-3 border border-purple-500/30">
                  <div className="text-sm sm:text-xl font-bold text-purple-300">{book.totalImages || 0}</div>
                  <div className="text-xs text-gray-400">Images</div>
                </div>
              </div>

              {/* Upload Info - Compact */}
              <div className="flex items-center justify-between text-xs sm:text-sm text-gray-400 pt-2 sm:pt-3 border-t border-white/20">
                <span className="truncate">By {book.uploaderName}</span>
                <span className="ml-2 flex-shrink-0">{new Date(book.createdAt).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric' 
                })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 sm:gap-4 mb-4 sm:mb-8">
          <Link 
            to={`/bookread/${book.id}`}
            className="flex items-center px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 font-medium"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            <span className="text-sm sm:text-base">Start Immersive Reading</span>
          </Link>
          
          <button 
            onClick={() => setViewMode(viewMode === 'reading' ? 'default' : 'reading')}
            className={`flex items-center px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105 font-medium ${
              viewMode === 'reading'
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
                : 'bg-white/10 backdrop-blur-lg border border-white/20 text-gray-300 hover:text-white hover:bg-white/20'
            }`}
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="text-sm sm:text-base">
              {viewMode === 'reading' ? 'Exit Quick Read' : 'Quick Read'}
            </span>
          </button>
          
          <button 
            onClick={() => setViewMode(viewMode === 'visual' ? 'default' : 'visual')}
            disabled={pagesWithImages.length === 0}
            className={`flex items-center px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105 font-medium ${
              viewMode === 'visual'
                ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white'
                : pagesWithImages.length === 0
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-white/10 backdrop-blur-lg border border-white/20 text-gray-300 hover:text-white hover:bg-white/20'
            }`}
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm sm:text-base">
              {viewMode === 'visual' ? 'Exit Visual Mode' : 'Visual Mode'}
            </span>
          </button>
        </div>

        {/* Content Section */}
        <div className="w-full">
          {viewMode === 'default' && (
            <BookDefaultView 
              book={book}
              sortedPages={sortedPages}
              imageMap={imageMap}
            />
          )}
          
          {viewMode === 'reading' && (
            <QuickReadingView 
              book={book}
              sortedPages={sortedPages}
            />
          )}
          
          {viewMode === 'visual' && (
            <BookVisualView 
              book={book}
              pagesWithImages={pagesWithImages}
              imageMap={imageMap}
            />
          )}
        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .line-clamp-4 {
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}