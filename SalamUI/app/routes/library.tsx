// app/routes/books.tsx
import { json, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, Link, Form } from "@remix-run/react";
import { useState } from "react";
import { getSession } from "~/sessions";

type BookMeta = {
  id: string;
  fileId: string;
  title: string;
  author: string;
  description: string;
  genre?: string;
  summary?: string;
  isPublic: boolean;
  isOwner: boolean;
  createdAt: string;
  createdAtFormatted?: string;
  createdAtDate?: string;
  createdAtTime?: string;
  thumbnail?: string | null;
  thumbnailUrl?: string | null;
  uploaderUsername: string;
  uploaderName: string;
  totalPages: number;
  totalWords?: number;
  totalImages?: number;
  processingStatus?: string;
  extractionMethod?: string;
  confidence?: string | number;
};




export async function loader({ request }: LoaderFunctionArgs) {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:4000";
  
  try {
    // Get the session from the request
    const cookieHeader = request.headers.get("Cookie");
    const session = await getSession(cookieHeader);
    const token = session.get("token");
    const userId = session.get("userId");
    const username = session.get("username");

    console.log('Session data:', { 
      hasToken: !!token, 
      userId, 
      username,
      sessionKeys: Object.keys(session.data || {})
    });

    // Redirect to sign-in if no token
    if (!token || !userId) {
      return redirect("/sign-in");
    }

    // Initialize default values
    let userBooks: any[] = [];
    let publicBooks: any[] = [];

    // Fetch user's own books (both private and public) - handle errors gracefully
    try {
      const userBooksResponse = await fetch(`${backendUrl}/api/books`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      
      if (userBooksResponse.ok) {
        const userBooksData = await userBooksResponse.json();
        console.log('User books data received:', userBooksData);
        
        // Process user books - handle both array and object responses
        const userBooksArray = Array.isArray(userBooksData) ? userBooksData : (userBooksData.books || []);
        userBooks = userBooksArray.map((book: any) => ({
          ...book,
          isOwner: true,
          isPublic: book.isPublic || false,
          thumbnailUrl: book.thumbnail ? `${backendUrl}${book.thumbnail}` : null
        }));
      } else {
        console.warn(`Failed to fetch user books: ${userBooksResponse.status} ${userBooksResponse.statusText}`);
        if (userBooksResponse.status === 401) {
          return redirect("/sign-in");
        }
        // Continue with empty user books instead of throwing
      }
    } catch (error) {
      console.error('Error fetching user books:', error);
      // Continue with empty user books instead of throwing
    }

    // Fetch public books from all users - handle errors gracefully
    try {
      // Use excludeUser query parameter to filter on backend
      const publicBooksUrl = `${backendUrl}/api/publicbooks${username ? `?excludeUser=${encodeURIComponent(username)}` : ''}`;
      console.log('Fetching public books from:', publicBooksUrl);
      
      const publicBooksResponse = await fetch(publicBooksUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (publicBooksResponse.ok) {
        const publicBooksData = await publicBooksResponse.json();
        console.log('Public books data received:', publicBooksData);
        console.log('Public books raw response:', JSON.stringify(publicBooksData, null, 2));
        
        // Your backend returns { books: [], total: number, hasMore: boolean }
        const publicBooksArray = publicBooksData.books || [];
        
        console.log('Public books array length:', publicBooksArray.length);
        console.log('Current username:', username);
        
        // Process public books - backend already filtered by excludeUser
        publicBooks = publicBooksArray.map((book: any) => ({
          ...book,
          isOwner: false,
          isPublic: true,
          thumbnailUrl: book.thumbnail ? `${backendUrl}${book.thumbnail}` : null
        }));
        
        console.log('Public books after processing:', publicBooks.length);
      } else {
        console.error(`Failed to fetch public books: ${publicBooksResponse.status} ${publicBooksResponse.statusText}`);
        
        // Log response text to see the actual error
        const errorText = await publicBooksResponse.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Error fetching public books:', error);
      // Continue with empty public books
    }
    
    console.log('Final results:', {
      userBooks: userBooks.length,
      publicBooks: publicBooks.length,
      username
    });
    
    return json({ 
      userBooks: userBooks,
      publicBooks: publicBooks,
      backendUrl,
      userId,
      username
    });
  } catch (error) {
    console.error('Failed to load books:', error);
    return json({ 
      userBooks: [], 
      publicBooks: [], 
      backendUrl, 
      userId: null,
      username: null 
    });
  }
}

export default function BooksPage() {
  const { userBooks, publicBooks, backendUrl, userId, username } = useLoaderData<typeof loader>();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [displayMode, setDisplayMode] = useState<"grid" | "list">("grid");
  const [activeSection, setActiveSection] = useState<"my-books" | "public">("my-books");
  const [genreFilter, setGenreFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // Get current books based on active section
  const currentBooks = activeSection === "my-books" ? userBooks : publicBooks;

  // Get unique genres from current books
  const availableGenres = [...new Set(currentBooks.map(book => book.genre).filter(Boolean))];

  // Helper function to format dates consistently
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateString);
        return 'Invalid Date';
      }
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return 'Invalid Date';
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Replace the filteredBooks section with this fixed version:

const filteredBooks = currentBooks
  .filter((book) => {
    // Filter by genre
    if (genreFilter !== "all" && book.genre !== genreFilter) return false;
    
    // Filter by search term - safely handle undefined/null values
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      (book.title || '').toLowerCase().includes(searchLower) ||
      (book.author || '').toLowerCase().includes(searchLower) ||
      (book.description || '').toLowerCase().includes(searchLower) ||
      (book.genre || '').toLowerCase().includes(searchLower);
    
    return matchesSearch;
  })
  .sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "oldest":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case "title":
        return (a.title || '').localeCompare(b.title || '');
      case "author":
        return (a.author || '').localeCompare(b.author || '');
      case "genre":
        return (a.genre || '').localeCompare(b.genre || '');
      case "pages":
        return (b.totalPages || 0) - (a.totalPages || 0);
      default:
        return 0;
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            ✓ Completed
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            ⏳ Processing
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            ✗ Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  const getVisibilityBadge = (book: BookMeta) => {
    if (activeSection === "my-books") {
      return book.isPublic ? (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          📖 Public
        </span>
      ) : (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          🔒 Private
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          👥 Community
        </span>
      );
    }
  };

  const GridView = ({ books }: { books: BookMeta[] }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {books.map((book) => {
        const thumbnailUrl = book.thumbnailUrl;
        const formattedDate = formatDate(book.createdAt);
        
        return (
          <Link
            key={book.fileId}
            to={`/book/${book.fileId}`}
            className="group bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden border border-white/20 hover:border-white/40 transition-all duration-300 hover:shadow-xl hover:scale-105"
          >
            {/* Book Cover */}
            <div className="aspect-[2/3] relative overflow-hidden">
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={book.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  onError={(e) => {
                    console.log('Thumbnail failed to load:', thumbnailUrl);
                    e.currentTarget.style.display = 'none';
                    const fallbackDiv = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallbackDiv) {
                      fallbackDiv.classList.remove('hidden');
                    }
                  }}
                />
              ) : null}
              <div className={`w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center ${thumbnailUrl ? 'hidden' : ''}`}>
                <div className="text-center p-2">
                  <svg className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <p className="text-xs text-gray-400 hidden sm:block">No Preview</p>
                </div>
              </div>
              
              {/* Status and Visibility Badges */}
              <div className="absolute top-2 right-2 flex flex-col gap-1">
                {book.processingStatus && getStatusBadge(book.processingStatus)}
                {getVisibilityBadge(book)}
              </div>
            </div>

            {/* Book Info */}
            <div className="p-3">
              <h3 className="text-sm font-semibold text-white mb-1 line-clamp-2 group-hover:text-indigo-300 transition-colors">
                {book.title}
              </h3>
              
              <p className="text-xs text-gray-400 mb-1">
                by {book.author}
              </p>
              
              {book.genre && (
                <p className="text-xs text-indigo-300 mb-1">
                  {book.genre}
                </p>
              )}
              
              <p className="text-xs text-gray-400 mb-2">
                {book.totalPages || 0} {(book.totalPages || 0) === 1 ? "page" : "pages"}
              </p>
              
              <p className="text-xs text-gray-300 mb-2 line-clamp-2">
                {book.description}
              </p>
              
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="truncate">
                  {book.uploaderName}
                </span>
                <span className="ml-2 flex-shrink-0">
                  {formattedDate}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );

  const ListView = ({ books }: { books: BookMeta[] }) => (
    <div className="space-y-4">
      {books.map((book) => {
        const thumbnailUrl = book.thumbnailUrl;
        const formattedDateTime = formatDateTime(book.createdAt);
        
        return (
          <Link
            key={book.fileId}
            to={`/book/${book.fileId}`}
            className="group bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 hover:border-white/40 transition-all duration-300 hover:shadow-2xl overflow-hidden"
          >
            <div className="flex">
              {/* Thumbnail */}
              <div className="w-20 h-28 sm:w-24 sm:h-32 flex-shrink-0 relative overflow-hidden">
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt={book.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    onError={(e) => {
                      console.log('Thumbnail failed to load:', thumbnailUrl);
                      e.currentTarget.style.display = 'none';
                      const fallbackDiv = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallbackDiv) {
                        fallbackDiv.classList.remove('hidden');
                      }
                    }}
                  />
                ) : null}
                <div className={`w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center ${thumbnailUrl ? 'hidden' : ''}`}>
                  <div className="text-center">
                    <svg className="w-6 h-6 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <p className="text-xs text-gray-400 hidden sm:block">No Preview</p>
                  </div>
                </div>
              </div>

              {/* Book Details */}
              <div className="flex-1 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {book.processingStatus && getStatusBadge(book.processingStatus)}
                      {getVisibilityBadge(book)}
                    </div>
                    
                    <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-indigo-300 transition-colors">
                      {book.title}
                    </h3>
                    
                    <p className="text-sm text-gray-400 mb-2">
                      by {book.author}
                    </p>
                    
                    {book.genre && (
                      <p className="text-sm text-indigo-300 mb-2">
                        Genre: {book.genre}
                      </p>
                    )}
                    
                    <p className="text-sm text-gray-400 mb-2">
                      {book.totalPages || 0} {(book.totalPages || 0) === 1 ? "page" : "pages"}
                      {book.totalWords && ` • ${book.totalWords.toLocaleString()} words`}
                    </p>
                    
                    <p className="text-sm text-gray-300 mb-3 line-clamp-2">
                      {book.description}
                    </p>
                    
                    <div className="flex items-center justify-between text-sm text-gray-400">
                      <span>
                        {activeSection === "my-books" ? "Uploaded by you" : `Uploaded by ${book.uploaderName}`}
                      </span>
                      <span>
                        {formattedDateTime}
                      </span>
                    </div>
                  </div>
                  
                  <div className="ml-4 flex-shrink-0">
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );

  
  return (
    <div className="flex flex-col items-center justify-start min-h-screen text-white px-0.5 py-3 lg:p-3 pt-16 lg:pt-6 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Top spacing */}
        <div className="h-8 mb-8"></div>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Digital Library</h1>
            <p className="text-gray-300">
              Discover and manage your digital book collection
            </p>
          </div>
          
          <Link
            to="/upload-books"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Upload Book
          </Link>
        </div>

        {/* Section Navigation */}
        <div className="mb-8">
          <div className="flex bg-white/10 backdrop-blur-sm rounded-xl p-2 border border-white/20 max-w-md">
            <button
              onClick={() => setActiveSection("my-books")}
              className={`flex-1 flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeSection === "my-books"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-gray-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              My Books ({userBooks.length})
            </button>
            <button
              onClick={() => setActiveSection("public")}
              className={`flex-1 flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeSection === "public"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-gray-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Public Books ({publicBooks.length})
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-8">
          {/* Search Bar and Filter Toggle */}
          <div className="flex gap-4 items-center mb-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder={`Search ${activeSection === "my-books" ? "your" : "public"} books...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 pl-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-all duration-200"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
              </svg>
              Filters
              <svg className={`w-4 h-4 ml-2 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Collapsible Filters */}
          {showFilters && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 animate-in slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Genre Filter */}
                <div>
                  <label htmlFor="genre" className="block text-sm font-medium text-gray-300 mb-2">
                    Genre
                  </label>
                  <select
                    id="genre"
                    value={genreFilter}
                    onChange={(e) => setGenreFilter(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="all">All Genres</option>
                    {availableGenres.map((genre) => (
                      <option key={genre} value={genre}>
                        {genre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort */}
                <div>
                  <label htmlFor="sort" className="block text-sm font-medium text-gray-300 mb-2">
                    Sort By
                  </label>
                  <select
                    id="sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="title">Title A-Z</option>
                    <option value="author">Author A-Z</option>
                    <option value="genre">Genre A-Z</option>
                    <option value="pages">Most Pages</option>
                  </select>
                </div>

                {/* Display Mode */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    View Mode
                  </label>
                  <div className="flex bg-white/10 border border-white/20 rounded-lg p-1">
                    <button
                      onClick={() => setDisplayMode("grid")}
                      className={`flex-1 flex items-center justify-center px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                        displayMode === "grid"
                          ? "bg-indigo-600 text-white shadow-md"
                          : "text-gray-300 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                      Grid
                    </button>
                    <button
                      onClick={() => setDisplayMode("list")}
                      className={`flex-1 flex items-center justify-center px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                        displayMode === "list"
                          ? "bg-indigo-600 text-white shadow-md"
                          : "text-gray-300 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                      List
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Books Display */}
        {filteredBooks.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto bg-white/10 rounded-full flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-xl font-medium text-white mb-2">
              {searchTerm || genreFilter !== "all" ? "No matching books found" : 
               //filterBy === "my-books" ? "No books in your library yet" :
               //filterBy === "public" ? "No public books available" :
               "No books available"}
            </h3>
            <p className="text-gray-400 mb-6">
              {searchTerm || genreFilter !== "all" ? "Try adjusting your search criteria" : 
               //filterBy === "my-books" ? "Upload your first book to get started" :
               "Check back later for new books"}
            </p>




          </div>
        ) : (
          <>
            {displayMode === "grid" ? (
              <GridView books={filteredBooks} />
            ) : (
              <ListView books={filteredBooks} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
