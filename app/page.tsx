import StackSimulator from "./stack-simulator";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-between py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-orange-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-4xl flex flex-col items-center space-y-12">
        {/* Header */}
        <header className="w-full text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-blue-600 mb-4">
            Bitcoin Script Parser & Stack Simulator
          </h1>
          <p className="text-xl text-gray-700 dark:text-gray-300 max-w-2xl mx-auto">
            Explore and understand Bitcoin scripts interactively
          </p>
        </header>

        {/* Main content */}
        <StackSimulator />

        {/* Footer */}
        <footer className="w-full text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Project built by{" "}
            <Link 
              href="https://bitcoindev.xyz" 
              className="text-orange-500 hover:text-orange-600 transition-colors font-semibold"
              target="_blank"
              rel="noopener noreferrer"
            >
              The Bitcoin Dev Project
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
