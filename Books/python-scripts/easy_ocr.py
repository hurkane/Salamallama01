#!/usr/bin/env python3
# python-scripts/easy_ocr_improved.py
import sys
import warnings
import re
warnings.filterwarnings("ignore")

try:
    import easyocr
except ImportError as e:
    print(f"Error: Missing EasyOCR. Install with: pip install easyocr", file=sys.stderr)
    sys.exit(1)

# Try to import Arabic processing libraries
try:
    from bidi.algorithm import get_display
    import arabic_reshaper
    ARABIC_LIBS_AVAILABLE = True
except ImportError:
    ARABIC_LIBS_AVAILABLE = False
    print("Warning: Arabic processing libraries not available. Install with: pip install python-bidi arabic-reshaper", file=sys.stderr)

def is_arabic_text(text):
    """Check if text contains Arabic characters"""
    return bool(re.search(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]', text))

def clean_arabic_text(text):
    """Clean and normalize Arabic text"""
    if not text:
        return text
    
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text.strip())
    
    # Normalize Arabic characters
    text = text.replace('ي', 'ی')  # Normalize Yeh
    text = text.replace('ك', 'ک')  # Normalize Kaf
    
    return text

def fix_arabic_text_advanced(text):
    """Advanced Arabic text fixing with multiple fallback strategies"""
    if not text or not text.strip():
        return text
    
    original_text = text
    
    # Clean the text first
    text = clean_arabic_text(text)
    
    # Check if text contains Arabic characters
    if not is_arabic_text(text):
        return text
    
    # Strategy 1: Use proper Arabic reshaping and BiDi algorithm
    if ARABIC_LIBS_AVAILABLE:
        try:
            # First, reshape Arabic text (handles character joining)
            reshaped_text = arabic_reshaper.reshape(text)
            # Then apply bidirectional algorithm
            bidi_text = get_display(reshaped_text)
            return bidi_text
        except Exception as e:
            print(f"Warning: Arabic reshaping failed: {e}", file=sys.stderr)
    
    # Strategy 2: Manual word-level processing
    try:
        words = text.split()
        processed_words = []
        
        for word in words:
            if is_arabic_text(word):
                # For Arabic words, try different approaches
                
                # First try: simple character reversal
                reversed_word = word[::-1]
                processed_words.append(reversed_word)
            else:
                # Keep non-Arabic words as is
                processed_words.append(word)
        
        return ' '.join(processed_words)
    except Exception as e:
        print(f"Warning: Manual word processing failed: {e}", file=sys.stderr)
    
    # Strategy 3: Complete text reversal (last resort)
    try:
        if is_arabic_text(text):
            return text[::-1]
    except Exception:
        pass
    
    # Final fallback: return original text
    return original_text

def post_process_ocr_results(results):
    """Post-process OCR results to fix Arabic text issues"""
    processed_lines = []
    
    for (bbox, text, confidence) in results:
        if text and text.strip() and confidence > 0.1:  # Filter low confidence results
            # Process the text
            fixed_text = fix_arabic_text_advanced(text.strip())
            
            # Additional filtering for very short or suspicious text
            if len(fixed_text.strip()) > 1:
                processed_lines.append({
                    'text': fixed_text,
                    'confidence': confidence,
                    'bbox': bbox
                })
    
    return processed_lines

def main():
    if len(sys.argv) < 3:
        print("Usage: python easy_ocr_improved.py <image_path> <languages>")
        sys.exit(1)
    
    image_path = sys.argv[1]
    languages = sys.argv[2].split(',')
    
    try:
        # Initialize EasyOCR reader with optimized settings
        reader = easyocr.Reader(
            languages, 
            gpu=False,
            model_storage_directory='./models'  # Optional: specify model directory
        )
        
        # Perform OCR with additional parameters for better Arabic recognition
        results = reader.readtext(
            image_path,
            detail=1,  # Return bounding box info
            paragraph=False,  # Don't group into paragraphs
            width_ths=0.7,  # Text width threshold
            height_ths=0.7,  # Text height threshold
            decoder='greedy'  # Use greedy decoder
        )
        
        # Post-process results
        processed_results = post_process_ocr_results(results)
        
        # Sort results by vertical position (top to bottom)
        processed_results.sort(key=lambda x: x['bbox'][0][1])
        
        # Extract text and output
        text_lines = [result['text'] for result in processed_results]
        output = '\n'.join(text_lines)
        
        print(output)
        
        # Optional: Print debug info to stderr
        print(f"Processed {len(processed_results)} text regions", file=sys.stderr)
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()