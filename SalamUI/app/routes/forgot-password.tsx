import { useState } from "react";
import { ActionFunction, json } from "@remix-run/node";
import { useActionData, Link } from "@remix-run/react";
import { API_BASE_URL, requestPasswordReset } from "~/utils/api";

type ActionData = {
  message?: string;
  error?: string;
};

export let action: ActionFunction = async ({ request }) => {
  let formData = await request.formData();
  let email = formData.get("email") as string | null;

  if (!email) {
    return json<ActionData>({ error: "Email is required" });
  }

  try {
    const data = await requestPasswordReset(email);
    if (data.error) {
      return json<ActionData>({ error: data.error });
    }

    return json<ActionData>({
      message: "Password reset link has been sent to your email",
    });
  } catch (error) {
    console.error("Request password reset error:", error);
    return json<ActionData>({
      error:
        error.message ||
        "Failed to request password reset. Please try again later.",
    });
  }
};

export default function ForgotPassword() {
  const actionData = useActionData<ActionData>();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(actionData?.message || "");
  const [error, setError] = useState(actionData?.error || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/requestPasswordReset`,
        {
          // Update the URL to the full API endpoint
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      );

      const contentType = response.headers.get("content-type");
      let data;

      if (!response.ok) {
        // If the response is not OK, treat it as an error
        const errorData = await response.text(); // Read response as text
        console.error("Error response text:", errorData); // Log the error response
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        // Log unexpected content type and response
        const unexpectedResponse = await response.text();
        console.error("Unexpected response:", unexpectedResponse);
        data = { error: "Unexpected response format" };
      }

      if (data.message) {
        setMessage(data.message);
        setError("");
      } else if (data.error) {
        setError(data.error);
        setMessage("");
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message || "Failed to request password reset");
      setMessage("");
    }
  };

return (
  <div className="flex flex-col items-center justify-center min-h-screen text-white p-4 relative">
    <div className="w-full max-w-md relative z-10">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8 shadow-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-white">Forgot Password</h2>
          <p className="text-gray-300 text-sm mt-1">Enter your email to receive a password reset link</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 pl-10 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200"
                placeholder="Enter your email"
              />
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-3 rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200 shadow-lg flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            <span>Send Reset Link</span>
          </button>

          {message && (
            <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
              <p className="text-green-300 text-sm">{message}</p>
            </div>
          )}
          
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}
        </form>

        {/* Sign In Link */}
        <div className="text-center mt-6 pt-6 border-t border-white/20">
          <p className="text-gray-300 text-sm">
            Remember your password?{" "}
            <Link 
              to="/sign-in" 
              className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors duration-200"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  </div>
);
}
