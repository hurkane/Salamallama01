// app/routes/book.$bookId.read.tsx
import { LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { useState, useRef, useEffect } from "react";
import { getSession } from "~/sessions";

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
  genre?: string;
}

interface LoaderData {
  book: Book;
  pages: Page[];
  backendUrl: string;
}

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

export default function BookReadingPage() {
  const { book, pages, backendUrl } = useLoaderData<LoaderData>();
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isReading, setIsReading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [highlightedWord, setHighlightedWord] = useState<number>(-1);
  const [currentWords, setCurrentWords] = useState<string[]>([]);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const recognitionRef = useRef<any>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);

  // Sort pages by page number
  const sortedPages = pages.sort((a, b) => a.pageNumber - b.pageNumber);

  // Zoom functions
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.2, 3)); // Max zoom 3x
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.2, 0.5)); // Min zoom 0.5x
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  // Auto-scroll to top function
  const scrollToTop = () => {
    if (textContainerRef.current) {
      textContainerRef.current.scrollTop = 0;
    }
  };

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        
        if (transcript.trim()) {
          highlightSpokenWord(transcript.trim().toLowerCase());
        }
      };
      
      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
        if (isListening) {
          recognitionRef.current.start();
        }
      };
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (speechSynthesisRef.current) {
        speechSynthesis.cancel();
      }
    };
  }, [isListening]);

  const highlightSpokenWord = (spokenText: string) => {
    const words = currentWords;
    const spokenWords = spokenText.split(' ');
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase().replace(/[.,!?;:"']/g, '');
      if (spokenWords.some(spokenWord => 
        spokenWord.includes(word) || word.includes(spokenWord)
      )) {
        setHighlightedWord(i);
        break;
      }
    }
  };

  const handleSpeak = () => {
    const currentPage = sortedPages[currentPageIndex];
    if (!currentPage?.text) return;

    if (isReading) {
      speechSynthesis.cancel();
      setIsReading(false);
      setHighlightedWord(-1);
      return;
    }

    const text = currentPage.text.trim();
    const words = text.split(/\s+/);
    setCurrentWords(words);
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.8;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    let wordIndex = 0;
    
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        setHighlightedWord(wordIndex);
        wordIndex++;
      }
    };
    
    utterance.onend = () => {
      setIsReading(false);
      setHighlightedWord(-1);
    };
    
    utterance.onerror = () => {
      setIsReading(false);
      setHighlightedWord(-1);
    };
    
    speechSynthesisRef.current = utterance;
    speechSynthesis.speak(utterance);
    setIsReading(true);
  };

  const handleTrack = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    const currentPage = sortedPages[currentPageIndex];
    if (!currentPage?.text) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setHighlightedWord(-1);
    } else {
      const words = currentPage.text.trim().split(/\s+/);
      setCurrentWords(words);
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleChatWithBook = () => {
    setShowChatModal(true);
  };

  const handleGenerateSummary = () => {
    alert('Summary generation feature coming soon!');
  };

  const handleVisualizePage = () => {
    alert('Page visualization feature coming soon!');
  };

  const handlePreviousPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
      scrollToTop();
    }
  };

  const handleNextPage = () => {
    if (currentPageIndex < sortedPages.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
      scrollToTop();
    }
  };

  const renderTextWithHighlight = (text: string) => {
    if (highlightedWord === -1) {
      return text;
    }
    
    const words = text.split(/\s+/);
    return words.map((word, index) => (
      <span
        key={index}
        className={`${
          index === highlightedWord 
            ? 'bg-yellow-400 text-gray-900 px-1 rounded transition-all duration-300' 
            : ''
        }`}
      >
        {word}{index < words.length - 1 ? ' ' : ''}
      </span>
    ));
  };

  const ChatModal = () => (
    showChatModal && (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
          <div className="p-6 border-b border-white/20">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Chat with Book</h3>
              <button
                onClick={() => setShowChatModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="p-6 text-center">
            <p className="text-gray-300 mb-4">Chat functionality coming soon!</p>
            <p className="text-gray-400 text-sm">You'll be able to ask questions about the book content here.</p>
          </div>
        </div>
      </div>
    )
  );

  const currentPage = sortedPages[currentPageIndex];
  if (!currentPage) return null;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Fixed Header - Glassy Modern Look */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-black/20 backdrop-blur-xl border-b border-white/10 shadow-lg">
        <div className="p-4">
          <div className="flex items-center justify-between">
            {/* Back Button */}
            <Link 
              to={`/book/${book.id}`}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 backdrop-blur-sm border border-white/10"
              title="Back to Book Details"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Link>

            {/* Desktop Controls */}
            <div className="hidden md:flex items-center gap-2">
              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1 border border-white/10">
                <button
                  onClick={handleZoomOut}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200 text-white"
                  title="Zoom out"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <button
                  onClick={handleResetZoom}
                  className="px-2 py-1 text-xs font-medium text-white hover:bg-white/10 rounded transition-all duration-200"
                  title="Reset zoom"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                <button
                  onClick={handleZoomIn}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200 text-white"
                  title="Zoom in"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              <button
                onClick={handleSpeak}
                className={`flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 backdrop-blur-sm border border-white/10 ${
                  isReading 
                    ? 'bg-red-500/20 hover:bg-red-500/30 text-red-100 border-red-500/30' 
                    : 'bg-green-500/20 hover:bg-green-500/30 text-green-100 border-green-500/30'
                }`}
                title={isReading ? 'Stop speaking' : 'Read aloud'}
              >
                {isReading ? (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
                    </svg>
                    Stop
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                    Speak
                  </>
                )}
              </button>
              
              <button
                onClick={handleTrack}
                className={`flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 backdrop-blur-sm border border-white/10 ${
                  isListening 
                    ? 'bg-red-500/20 hover:bg-red-500/30 text-red-100 border-red-500/30 animate-pulse' 
                    : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-100 border-blue-500/30'
                }`}
                title={isListening ? 'Stop tracking' : 'Track reading'}
              >
                {isListening ? (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
                    </svg>
                    Stop
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    Track
                  </>
                )}
              </button>

              <button
                onClick={handleChatWithBook}
                className="flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 bg-purple-500/20 hover:bg-purple-500/30 text-purple-100 border border-purple-500/30 backdrop-blur-sm"
                title="Chat with book"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Chat
              </button>

              <button
                onClick={handleGenerateSummary}
                className="flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 bg-orange-500/20 hover:bg-orange-500/30 text-orange-100 border border-orange-500/30 backdrop-blur-sm"
                title="Generate summary"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Summary
              </button>

              <button
                onClick={handleVisualizePage}
                className="flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 bg-teal-500/20 hover:bg-teal-500/30 text-teal-100 border border-teal-500/30 backdrop-blur-sm"
                title="Visualize page"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Visualize
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 backdrop-blur-sm border border-white/10"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Mobile Menu */}
          {showMobileMenu && (
            <div className="md:hidden mt-4 p-4 bg-black/20 backdrop-blur-xl border border-white/10 rounded-xl">
              {/* Mobile Zoom Controls */}
              <div className="flex items-center justify-center gap-2 mb-4 p-2 bg-white/10 rounded-xl">
                <button
                  onClick={handleZoomOut}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200 text-white"
                  title="Zoom out"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <button
                  onClick={handleResetZoom}
                  className="px-3 py-1 text-sm font-medium text-white hover:bg-white/10 rounded transition-all duration-200"
                  title="Reset zoom"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                <button
                  onClick={handleZoomIn}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200 text-white"
                  title="Zoom in"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { handleSpeak(); setShowMobileMenu(false); }}
                  className={`flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isReading 
                      ? 'bg-red-500/20 text-red-100 border border-red-500/30' 
                      : 'bg-green-500/20 text-green-100 border border-green-500/30'
                  }`}
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                  {isReading ? 'Stop' : 'Speak'}
                </button>
                
                <button
                  onClick={() => { handleTrack(); setShowMobileMenu(false); }}
                  className={`flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isListening 
                      ? 'bg-red-500/20 text-red-100 border border-red-500/30' 
                      : 'bg-blue-500/20 text-blue-100 border border-blue-500/30'
                  }`}
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  {isListening ? 'Stop' : 'Track'}
                </button>

                <button
                  onClick={() => { handleChatWithBook(); setShowMobileMenu(false); }}
                  className="flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-purple-500/20 text-purple-100 border border-purple-500/30"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Chat
                </button>

                <button
                  onClick={() => { handleGenerateSummary(); setShowMobileMenu(false); }}
                  className="flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-orange-500/20 text-orange-100 border border-orange-500/30"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Summary
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="pt-20 pb-32 min-h-screen flex items-center justify-center px-4">
        <div className="max-w-4xl w-full">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8 md:p-12 shadow-2xl">
            <div className="prose prose-invert max-w-none">
              <div 
                ref={textContainerRef}
                className="text-gray-200 leading-relaxed whitespace-pre-wrap font-serif max-h-[60vh] overflow-y-auto pr-4 transition-all duration-300"
                style={{ 
                  fontSize: `${zoomLevel * 1.25}rem`,
                  lineHeight: `${zoomLevel * 1.7}rem`,
                  scrollbarWidth: 'thin', 
                  scrollbarColor: '#4F46E5 rgba(255,255,255,0.1)',
                }}
              >
                {currentPage.text?.trim() ? renderTextWithHighlight(currentPage.text.trim()) : 'No text content available for this page.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Navigation - Modern Glass Design */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/20 backdrop-blur-xl border-t border-white/10 shadow-2xl">
        <div className="p-4 md:p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
              {/* Previous Button */}
              <button
                onClick={handlePreviousPage}
                disabled={currentPageIndex === 0}
                className={`flex items-center px-4 py-3 rounded-xl font-medium transition-all duration-200 backdrop-blur-sm border ${
                  currentPageIndex === 0
                    ? 'bg-gray-500/10 text-gray-500 border-gray-500/20 cursor-not-allowed'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/20 hover:border-white/30'
                }`}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">Previous</span>
              </button>

              {/* Page Info */}
              <div className="flex items-center space-x-4">
                <div className="text-center">
                  <div className="text-white font-bold text-lg">
                    {currentPageIndex + 1}
                  </div>
                  <div className="text-gray-400 text-sm">
                    of {sortedPages.length}
                  </div>
                </div>
                <div className="hidden md:block h-8 w-px bg-white/20"></div>
                <div className="hidden md:block text-gray-300 text-sm">
                  {Math.round(((currentPageIndex + 1) / sortedPages.length) * 100)}% complete
                </div>
              </div>

              {/* Next Button */}
              <button
                onClick={handleNextPage}
                disabled={currentPageIndex === sortedPages.length - 1}
                className={`flex items-center px-4 py-3 rounded-xl font-medium transition-all duration-200 backdrop-blur-sm border ${
                  currentPageIndex === sortedPages.length - 1
                    ? 'bg-gray-500/10 text-gray-500 border-gray-500/20 cursor-not-allowed'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/20 hover:border-white/30'
                }`}
              >
                <span className="hidden sm:inline">Next</span>
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Modal */}
      <ChatModal />

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .prose::-webkit-scrollbar {
          width: 8px;
        }
        .prose::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .prose::-webkit-scrollbar-thumb {
          background: #4F46E5;
          border-radius: 4px;
        }
        .prose::-webkit-scrollbar-thumb:hover {
          background: #6366F1;
        }
      `}</style>
    </div>
  );
}