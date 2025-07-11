// app/routes/upload-books.tsx
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { json, redirect, 
  type ActionFunction, 
  type ActionFunctionArgs,
 } from "@remix-run/node";
import { getSession } from "~/sessions";
import { useState } from "react";

export const action : ActionFunction = async ({ request }: ActionFunctionArgs) => {
  try {
    const backendUrl = process.env.API_BASE_URL || "http://books:4000";
    
    const cookieHeader = request.headers.get("Cookie");
    const session = await getSession(cookieHeader);
    const token = session.get("token");
    const userId = session.get("userId");

    if (!token || !userId) {
      return redirect("/sign-in");
    }

    const formData = await request.formData();
    const extractionMethod = formData.get("extractionMethod") as string;
    
    // Determine which endpoint to use based on extraction method
    let endpoint = "";
    switch (extractionMethod) {
      case "native":
        endpoint = "/api/upload-pdf-native";
        break;
      case "tesseract-latin":
        endpoint = "/api/ocr-english-latin";
        break;
      case "paddle-asian":
        endpoint = "/api/ocr-asian";
        break;
      case "easyocr-arabic":
        endpoint = "/api/ocr-arabic";
        break;
      default:
        return json({ error: "Invalid extraction method" }, { status: 400 });
    }

    // Create new FormData for the backend
    const backendFormData = new FormData();
    const pdfFile = formData.get("pdf") as File;
    if (pdfFile) {
      backendFormData.append("pdf", pdfFile);
    }

    // Add book metadata (existing fields)
    const bookName = formData.get("bookName") as string;
    const author = formData.get("author") as string;
    const description = formData.get("description") as string;
    
    // Add NEW fields
    const genre = formData.get("genre") as string;
    const summary = formData.get("summary") as string;
    const isPublic = formData.get("isPublic") as string;

    if (bookName) backendFormData.append("bookName", bookName);
    if (author) backendFormData.append("author", author);
    if (description) backendFormData.append("description", description);
    if (genre) backendFormData.append("genre", genre);
    if (summary) backendFormData.append("summary", summary);
    if (isPublic) backendFormData.append("isPublic", isPublic);

    // Handle languages for Asian OCR
    if (extractionMethod === "paddle-asian") {
      const selectedLanguages = formData.getAll("languages") as string[];
      const languagesString = selectedLanguages.length > 0 ? selectedLanguages.join(",") : "chi_sim,jpn,kor";
      backendFormData.append("languages", languagesString);
    }
    
    const response = await fetch(`${backendUrl}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: backendFormData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Upload failed" }));
      return json({ error: errorData.error || "Book upload failed" }, { status: response.status });
    }

    const result = await response.json();
    console.log("Upload successful:", result);
    
    return redirect("/books");
  } catch (error) {
    console.error("Upload error:", error);
    return json({ error: "Network error or server unavailable" }, { status: 500 });
  }
};

export default function UploadBooksPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  
  const [extractionMethod, setExtractionMethod] = useState("native");
  const [showLanguageOptions, setShowLanguageOptions] = useState(false);

  const handleExtractionMethodChange = (method: string) => {
    setExtractionMethod(method);
    setShowLanguageOptions(method === "paddle-asian");
  };

  // Genre options for the dropdown
  const genreOptions = [
    "Fiction", "Non-Fiction", "Mystery", "Romance", "Science Fiction", "Fantasy",
    "Biography", "History", "Self-Help", "Business", "Technology", "Health",
    "Travel", "Cooking", "Art", "Religion", "Philosophy", "Education", "Other"
  ];

  return (
    <div className="max-w-3xl mx-auto p-6 text-white bg-gray-800 min-h-screen">
      {/* Back Button */}
    <div className="w-full max-w-4xl mb-4 relative z-10">
      <button
        className="flex items-center space-x-2 px-4 py-2 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 text-gray-300 hover:text-white hover:bg-white/20 transition-all duration-200"
        onClick={() => window.history.back()}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <path d="M15 18l-6-6 6-6"></path>
        </svg>
        <span>Back</span>
      </button>
    </div>
      <h1 className="text-3xl font-bold mb-6 text-center">Upload & Extract Text from PDF</h1>
      
      {actionData?.error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded mb-6">
          <p>{actionData.error}</p>
        </div>
      )}

      <Form method="post" encType="multipart/form-data" className="space-y-8">
        {/* Book Metadata Section */}
        <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg border border-gray-600">
          <h2 className="text-lg font-medium text-white mb-4">📚 Book Information</h2>
          
          {/* Book Name */}
          <div className="space-y-2">
            <label htmlFor="bookName" className="block text-sm font-medium text-gray-300">
              Book Name
            </label>
            <input
              id="bookName"
              type="text"
              name="bookName"
              placeholder="Enter the book title..."
              className="w-full p-3 rounded-lg bg-gray-900 border border-gray-600 text-white placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Author */}
          <div className="space-y-2">
            <label htmlFor="author" className="block text-sm font-medium text-gray-300">
              Author
            </label>
            <input
              id="author"
              type="text"
              name="author"
              placeholder="Enter the author's name..."
              className="w-full p-3 rounded-lg bg-gray-900 border border-gray-600 text-white placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Genre - NEW FIELD */}
          <div className="space-y-2">
            <label htmlFor="genre" className="block text-sm font-medium text-gray-300">
              Genre
            </label>
            <select
              id="genre"
              name="genre"
              defaultValue="Other"
              className="w-full p-3 rounded-lg bg-gray-900 border border-gray-600 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              {genreOptions.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-300">
              Description (Optional)
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Brief description of the book..."
              className="w-full p-3 rounded-lg bg-gray-900 border border-gray-600 text-white placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Summary - NEW FIELD */}
          <div className="space-y-2">
            <label htmlFor="summary" className="block text-sm font-medium text-gray-300">
              Summary (Optional)
            </label>
            <textarea
              id="summary"
              name="summary"
              rows={4}
              placeholder="Detailed summary or overview of the book content..."
              className="w-full p-3 rounded-lg bg-gray-900 border border-gray-600 text-white placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Privacy Setting - NEW FIELD */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">
              Privacy Settings
            </label>
            <div className="space-y-2">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="isPublic"
                  value="false"
                  defaultChecked
                  className="w-4 h-4 text-indigo-600 bg-gray-900 border-gray-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-white font-medium">🔒 Private</span>
                  <p className="text-sm text-gray-400">Only you can see this book</p>
                </div>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="isPublic"
                  value="true"
                  className="w-4 h-4 text-indigo-600 bg-gray-900 border-gray-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-white font-medium">🌐 Public</span>
                  <p className="text-sm text-gray-400">Anyone can view this book</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* PDF File Upload */}
        <div className="space-y-2">
          <label htmlFor="pdf" className="block text-sm font-medium text-gray-300">
            PDF File *
          </label>
          <input
            id="pdf"
            type="file"
            name="pdf"
            accept=".pdf"
            required
            className="w-full p-3 rounded-lg bg-gray-900 border border-gray-600 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 file:cursor-pointer"
          />
          <p className="text-sm text-gray-400">Select a PDF file to extract text from</p>
        </div>

        {/* Extraction Method Selection */}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-300">
            Text Extraction Method *
          </label>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Native Text Extraction */}
            <div 
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                extractionMethod === "native" 
                  ? "border-indigo-500 bg-indigo-500/10" 
                  : "border-gray-600 bg-gray-900 hover:border-gray-500"
              }`}
              onClick={() => handleExtractionMethodChange("native")}
            >
              <input
                type="radio"
                name="extractionMethod"
                value="native"
                checked={extractionMethod === "native"}
                onChange={() => handleExtractionMethodChange("native")}
                className="sr-only"
              />
              <div className="flex items-start space-x-3">
                <div className={`w-4 h-4 rounded-full border-2 mt-1 ${
                  extractionMethod === "native" ? "border-indigo-500 bg-indigo-500" : "border-gray-400"
                }`}>
                  {extractionMethod === "native" && (
                    <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-white">Native Text Extraction</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Extract text directly from PDF (fastest, works for text-based PDFs)
                  </p>
                  <div className="flex items-center mt-2 text-xs">
                    <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded">Fastest</span>
                    <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded ml-2">Best Quality</span>
                  </div>
                </div>
              </div>
            </div>

            {/* English/Latin OCR */}
            <div 
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                extractionMethod === "tesseract-latin" 
                  ? "border-indigo-500 bg-indigo-500/10" 
                  : "border-gray-600 bg-gray-900 hover:border-gray-500"
              }`}
              onClick={() => handleExtractionMethodChange("tesseract-latin")}
            >
              <input
                type="radio"
                name="extractionMethod"
                value="tesseract-latin"
                checked={extractionMethod === "tesseract-latin"}
                onChange={() => handleExtractionMethodChange("tesseract-latin")}
                className="sr-only"
              />
              <div className="flex items-start space-x-3">
                <div className={`w-4 h-4 rounded-full border-2 mt-1 ${
                  extractionMethod === "tesseract-latin" ? "border-indigo-500 bg-indigo-500" : "border-gray-400"
                }`}>
                  {extractionMethod === "tesseract-latin" && (
                    <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-white">Latin Languages OCR</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    For scanned PDFs in English, French, German, Spanish, Italian, Portuguese
                  </p>
                  <div className="flex items-center mt-2 text-xs">
                    <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">Medium Speed</span>
                    <span className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded ml-2">Tesseract</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Asian Languages OCR */}
            <div 
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                extractionMethod === "paddle-asian" 
                  ? "border-indigo-500 bg-indigo-500/10" 
                  : "border-gray-600 bg-gray-900 hover:border-gray-500"
              }`}
              onClick={() => handleExtractionMethodChange("paddle-asian")}
            >
              <input
                type="radio"
                name="extractionMethod"
                value="paddle-asian"
                checked={extractionMethod === "paddle-asian"}
                onChange={() => handleExtractionMethodChange("paddle-asian")}
                className="sr-only"
              />
              <div className="flex items-start space-x-3">
                <div className={`w-4 h-4 rounded-full border-2 mt-1 ${
                  extractionMethod === "paddle-asian" ? "border-indigo-500 bg-indigo-500" : "border-gray-400"
                }`}>
                  {extractionMethod === "paddle-asian" && (
                    <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-white">Asian Languages OCR</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    For Chinese (Simplified/Traditional), Japanese, Korean documents
                  </p>
                  <div className="flex items-center mt-2 text-xs">
                    <span className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded">Slower</span>
                    <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded ml-2">PaddleOCR</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Arabic OCR */}
            <div 
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                extractionMethod === "easyocr-arabic" 
                  ? "border-indigo-500 bg-indigo-500/10" 
                  : "border-gray-600 bg-gray-900 hover:border-gray-500"
              }`}
              onClick={() => handleExtractionMethodChange("easyocr-arabic")}
            >
              <input
                type="radio"
                name="extractionMethod"
                value="easyocr-arabic"
                checked={extractionMethod === "easyocr-arabic"}
                onChange={() => handleExtractionMethodChange("easyocr-arabic")}
                className="sr-only"
              />
              <div className="flex items-start space-x-3">
                <div className={`w-4 h-4 rounded-full border-2 mt-1 ${
                  extractionMethod === "easyocr-arabic" ? "border-indigo-500 bg-indigo-500" : "border-gray-400"
                }`}>
                  {extractionMethod === "easyocr-arabic" && (
                    <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-white">Arabic OCR</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    For Arabic documents and mixed Arabic-English text
                  </p>
                  <div className="flex items-center mt-2 text-xs">
                    <span className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded">Slower</span>
                    <span className="bg-teal-500/20 text-teal-400 px-2 py-1 rounded ml-2">EasyOCR</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Language Selection for Asian OCR */}
        {showLanguageOptions && (
          <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg border border-gray-600">
            <label className="block text-sm font-medium text-gray-300">
              Select Asian Languages
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="languages"
                  value="chi_sim"
                  defaultChecked
                  className="w-4 h-4 text-indigo-600 bg-gray-900 border-gray-600 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-300">Chinese (Simplified)</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="languages"
                  value="chi_tra"
                  className="w-4 h-4 text-indigo-600 bg-gray-900 border-gray-600 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-300">Chinese (Traditional)</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="languages"
                  value="jpn"
                  defaultChecked
                  className="w-4 h-4 text-indigo-600 bg-gray-900 border-gray-600 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-300">Japanese</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="languages"
                  value="kor"
                  defaultChecked
                  className="w-4 h-4 text-indigo-600 bg-gray-900 border-gray-600 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-300">Korean</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="languages"
                  value="en"
                  className="w-4 h-4 text-indigo-600 bg-gray-900 border-gray-600 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-300">English</span>
              </label>
            </div>
            <p className="text-xs text-gray-400">
              Select the languages present in your document for better OCR accuracy
            </p>
          </div>
        )}

        {/* Method Information */}
        <div className="bg-blue-500/10 border border-blue-500 rounded-lg p-4">
          <h3 className="text-blue-400 font-medium mb-2">💡 Extraction Method Guide</h3>
          <div className="text-sm text-blue-300 space-y-1">
            {extractionMethod === "native" && (
              <p><strong>Native:</strong> Use this for PDFs with selectable text. Fastest and most accurate for text-based documents.</p>
            )}
            {extractionMethod === "tesseract-latin" && (
              <p><strong>Latin OCR:</strong> Use this for scanned PDFs or images containing Latin-based languages. Supports English, French, German, Spanish, Italian, and Portuguese.</p>
            )}
            {extractionMethod === "paddle-asian" && (
              <p><strong>Asian OCR:</strong> Use this for documents containing Chinese, Japanese, or Korean text. Powered by PaddleOCR for high accuracy with Asian scripts.</p>
            )}
            {extractionMethod === "easyocr-arabic" && (
              <p><strong>Arabic OCR:</strong> Use this for Arabic documents or mixed Arabic-English text. Handles right-to-left text properly.</p>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-4 rounded-lg text-white font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Processing PDF...</span>
              </>
            ) : (
              <>
                <span>🚀 Extract Text from PDF</span>
              </>
            )}
          </button>
        </div>

        {/* Processing Information */}
        {isSubmitting && (
          <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-400 p-4 rounded">
            <div className="flex items-start space-x-2">
              <div className="animate-pulse">⚡</div>
              <div className="text-sm">
                <p className="font-medium mb-1">Processing your PDF...</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  {extractionMethod === "native" && <li>Extracting native text - usually takes 10-30 seconds</li>}
                  {extractionMethod === "tesseract-latin" && (
                    <>
                      <li>Converting PDF pages to images</li>
                      <li>Running Tesseract OCR - may take 1-5 minutes</li>
                    </>
                  )}
                  {extractionMethod === "paddle-asian" && (
                    <>
                      <li>Converting PDF pages to images</li>
                      <li>Running PaddleOCR for Asian languages - may take 2-10 minutes</li>
                    </>
                  )}
                  {extractionMethod === "easyocr-arabic" && (
                    <>
                      <li>Converting PDF pages to images</li>
                      <li>Running EasyOCR for Arabic text - may take 2-8 minutes</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}
      </Form>
    </div>
  );
}