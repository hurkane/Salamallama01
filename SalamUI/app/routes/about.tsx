import { Link } from "@remix-run/react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-900 text-white flex flex-col items-center justify-center p-6">
      {/* Decorative Blurs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
      </div>

      <div className="relative z-10 w-full max-w-3xl text-center">
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

        {/* Content */}
        <h1 className="text-4xl md:text-5xl font-bold mb-6">About Salama Llama</h1>
        <p className="text-lg text-gray-300 mb-4">
          Salama Llama is a next-generation digital society platform designed to bring
          people together through safe, secure, and meaningful social interaction.
        </p>
        <p className="text-gray-400 mb-4">
          Our mission is to empower users with tools that respect privacy, promote
          creativity, and foster real human connection. Whether you're sharing ideas,
          expressing yourself, or discovering new perspectives — Salama Llama is built for you.
        </p>
        <p className="text-gray-400 mb-8">
          We're currently working hard on launching features that will redefine how
          online communities interact — stay tuned!
        </p>

      </div>
    </div>
  );
}
