// app/components/BookReadingView.tsx
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

interface BookReadingViewProps {
  book: Book;
  sortedPages: Page[];
}

export function BookReadingView({ book, sortedPages }: BookReadingViewProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isReading, setIsReading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [highlightedWord, setHighlightedWord] = useState<number>(-1);
  const [currentWords, setCurrentWords] = useState<string[]>([]);
  const [showChatModal, setShowChatModal] = useState(false);
  
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const recognitionRef = useRef<any>(null);

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

  // New dummy functions for future features
  const handleChatWithBook = () => {
    setShowChatModal(true);
    // TODO: Implement chat with book functionality
    console.log('Chat with book feature - to be implemented');
  };

  const handleGenerateSummary = () => {
    // TODO: Implement summary generation
    console.log('Generate summary feature - to be implemented');
    alert('Summary generation feature coming soon!');
  };

  const handleVisualizePage = () => {
    // TODO: Implement page visualization
    console.log('Visualize page feature - to be implemented');
    alert('Page visualization feature coming soon!');
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

  const nextPage = () => {
    setCurrentPageIndex(prev => Math.min(prev + 1, sortedPages.length - 1));
  };

  const prevPage = () => {
    setCurrentPageIndex(prev => Math.max(prev - 1, 0));
  };

  const NavigationControls = () => (
    <div className="flex items-center justify-between bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4">
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
          Page {currentPageIndex + 1} of {sortedPages.length}
        </span>
      </div>
      
      <button
        onClick={nextPage}
        disabled={currentPageIndex >= sortedPages.length - 1}
        className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          currentPageIndex >= sortedPages.length - 1
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
  );

  const ChatModal = () => (
    showChatModal && (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
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
    <div className="min-h-screen w-full">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-sm border-b border-white/20">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Immersive Reading Mode</h2>
            <span className="bg-indigo-500/30 text-indigo-200 px-3 py-1 rounded-full text-sm">
              Page {currentPage.pageNumber}
            </span>
          </div>
          
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Reading Controls */}
            <button
              onClick={handleSpeak}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                isReading 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
              title={isReading ? 'Stop speaking' : 'Read aloud'}
            >
              {isReading ? (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
                  </svg>
                  Stop
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                  Speak
                </>
              )}
            </button>
            
            <button
              onClick={handleTrack}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                isListening 
                  ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              title={isListening ? 'Stop tracking' : 'Track reading'}
            >
              {isListening ? (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
                  </svg>
                  Stop
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Track
                </>
              )}
            </button>

            {/* New Feature Buttons */}
            <button
              onClick={handleChatWithBook}
              className="flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-purple-600 hover:bg-purple-700 text-white"
              title="Chat with book"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Chat
            </button>

            <button
              onClick={handleGenerateSummary}
              className="flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-orange-600 hover:bg-orange-700 text-white"
              title="Generate summary"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Summary
            </button>

            <button
              onClick={handleVisualizePage}
              className="flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-teal-600 hover:bg-teal-700 text-white"
              title="Visualize page"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Visualize
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="pt-32 pb-24 min-h-screen">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 md:p-8">
            <div className="prose prose-invert max-w-none">
              <div 
                className="text-gray-200 leading-relaxed whitespace-pre-wrap font-serif text-lg max-h-[60vh] overflow-y-auto pr-4"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#4F46E5 transparent' }}
              >
                {currentPage.text?.trim() ? renderTextWithHighlight(currentPage.text.trim()) : 'No text content available for this page.'}
              </div>
            </div>
            
            {currentPage.wordCount && (
              <div className="mt-6 pt-4 border-t border-white/10">
                <span className="text-sm text-gray-400">
                  {currentPage.wordCount.toLocaleString()} words on this page
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-sm border-t border-white/20">
        <div className="p-4">
          <NavigationControls />
        </div>
      </div>

      {/* Chat Modal */}
      <ChatModal />
    </div>
  );
}