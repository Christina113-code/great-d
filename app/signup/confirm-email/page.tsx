"use client";

import Link from "next/link";

export default function ConfirmEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-100 to-blue-200 px-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8 text-center">
        <div className="text-6xl mb-4">📧</div>
        <h1 className="text-3xl font-extrabold text-blue-600">
          Check Your Email!
        </h1>
        <p className="text-gray-500 mt-2 mb-6">
          We've sent a confirmation link to your email address. Please click the
          link to verify your account.
        </p>

        <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left">
          <p className="text-sm text-gray-700">
            <strong>Next steps:</strong>
          </p>
          <ol className="list-decimal list-inside mt-2 text-sm text-gray-600 space-y-1">
            <li>Check your inbox (and spam folder)</li>
            <li>Click the confirmation link</li>
            <li>Come back here to log in</li>
          </ol>
        </div>

        <Link
          href="/login"
          className="inline-block w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition"
        >
          Go to Login
        </Link>

        <p className="mt-6 text-sm text-gray-600">
          Didn't receive the email?{" "}
          <a
            href="/signup"
            className="text-blue-500 font-semibold hover:underline"
          >
            Try signing up again
          </a>
        </p>
      </div>
    </div>
  );
}

